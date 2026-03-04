param(
  [ValidateSet("all", "codex", "claude", "gemini", "opencode")]
  [string]$Client = "all",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Normalize-HomeDir {
  param(
    [string]$Raw,
    [string]$Fallback
  )

  if (-not $Raw) {
    return $Fallback
  }

  if (-not [System.IO.Path]::IsPathRooted($Raw)) {
    return $Fallback
  }

  return $Raw
}

function Get-ConfigHome {
  if ($env:XDG_CONFIG_HOME -and [System.IO.Path]::IsPathRooted($env:XDG_CONFIG_HOME)) {
    return $env:XDG_CONFIG_HOME
  }

  return (Join-Path $HOME '.config')
}

function Warn-RelativeHome {
  param(
    [string]$EnvName,
    [string]$Fallback
  )

  $raw = [Environment]::GetEnvironmentVariable($EnvName)
  if ($raw -and -not [System.IO.Path]::IsPathRooted($raw)) {
    Write-Host "[warn] $EnvName is relative ($raw); using $Fallback"
  }
}

function Trim-Path {
  param([string]$Path)
  return $Path.TrimEnd('\\', '/')
}

function Test-ManagedLink {
  param(
    [string]$TargetPath,
    [string]$SourcePath
  )

  if (-not (Test-Path -LiteralPath $TargetPath)) {
    return $false
  }

  $item = Get-Item -LiteralPath $TargetPath -Force
  $isReparse = (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
  if (-not $isReparse) {
    return $false
  }

  try {
    $resolvedTarget = (Resolve-Path -LiteralPath $TargetPath).Path
    $resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
    return [string]::Equals((Trim-Path $resolvedTarget), (Trim-Path $resolvedSource), [System.StringComparison]::OrdinalIgnoreCase)
  } catch {
    return $false
  }
}

function New-ManagedLink {
  param(
    [string]$SourcePath,
    [string]$TargetPath
  )

  try {
    New-Item -Path $TargetPath -ItemType Junction -Target $SourcePath | Out-Null
    return
  } catch {
  }

  New-Item -Path $TargetPath -ItemType SymbolicLink -Target $SourcePath | Out-Null
}

function Client-Enabled {
  param([string]$Candidate)

  return ($Client -eq 'all' -or $Client -eq $Candidate)
}

function Get-ClientSourceRoots {
  param([string]$ClientName)

  switch ($ClientName) {
    'codex' {
      return @((Join-Path $RootDir '.codex/skills'))
    }
    'claude' {
      return @((Join-Path $RootDir '.claude/skills'))
    }
    'gemini' {
      return @(
        (Join-Path $RootDir '.gemini/skills'),
        (Join-Path $RootDir '.agents/skills'),
        (Join-Path $RootDir '.codex/skills'),
        (Join-Path $RootDir '.claude/skills')
      )
    }
    'opencode' {
      return @(
        (Join-Path $RootDir '.opencode/skills'),
        (Join-Path $RootDir '.agents/skills'),
        (Join-Path $RootDir '.codex/skills'),
        (Join-Path $RootDir '.claude/skills')
      )
    }
  }

  return @()
}

function Get-SkillEntries {
  param([string[]]$SourceRoots)

  $entries = New-Object System.Collections.Generic.List[object]
  $seen = @{}

  foreach ($root in $SourceRoots) {
    if (-not (Test-Path -LiteralPath $root)) {
      continue
    }

    $skillDirs = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -notmatch '^\.' -and (Test-Path (Join-Path $_.FullName 'SKILL.md'))
    }

    foreach ($skillDir in $skillDirs) {
      $skillName = $skillDir.Name
      if ($seen.ContainsKey($skillName)) {
        continue
      }

      $sourceAbs = (Resolve-Path -LiteralPath $skillDir.FullName).Path
      $entries.Add([PSCustomObject]@{
        Name = $skillName
        SourcePath = $sourceAbs
        SourceRoot = $root
      })
      $seen[$skillName] = $true
    }
  }

  return $entries
}

function Install-ForClient {
  param(
    [string]$ClientName,
    [string]$TargetRoot,
    [string[]]$SourceRoots
  )

  New-Item -Path $TargetRoot -ItemType Directory -Force | Out-Null

  $entries = Get-SkillEntries -SourceRoots $SourceRoots
  if ($entries.Count -eq 0) {
    Write-Host "[warn] $ClientName no skill sources found. Checked roots:"
    foreach ($root in $SourceRoots) {
      Write-Host "  - $root"
    }
    return
  }

  [int]$installed = 0
  [int]$reused = 0
  [int]$replaced = 0
  [int]$skipped = 0

  foreach ($entry in $entries) {
    $targetPath = Join-Path $TargetRoot $entry.Name

    if (Test-Path -LiteralPath $targetPath) {
      if (Test-ManagedLink -TargetPath $targetPath -SourcePath $entry.SourcePath) {
        Write-Host "[ok] $ClientName skill already linked: $($entry.Name)"
        $reused += 1
        continue
      }

      if ($Force) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
        $replaced += 1
      } else {
        Write-Host "[skip] $ClientName skill exists (use -Force to replace): $($entry.Name)"
        $skipped += 1
        continue
      }
    }

    New-ManagedLink -SourcePath $entry.SourcePath -TargetPath $targetPath
    Write-Host "[link] $ClientName skill installed: $($entry.Name)"
    $installed += 1
  }

  Write-Host "[done] $ClientName skills -> installed=$installed reused=$reused replaced=$replaced skipped=$skipped"
}

$configHome = Get-ConfigHome
$homeMap = @{
  codex = Normalize-HomeDir -Raw $env:CODEX_HOME -Fallback (Join-Path $HOME '.codex')
  claude = Normalize-HomeDir -Raw $env:CLAUDE_HOME -Fallback (Join-Path $HOME '.claude')
  gemini = Normalize-HomeDir -Raw $env:GEMINI_HOME -Fallback (Join-Path $HOME '.gemini')
  opencode = Normalize-HomeDir -Raw $env:OPENCODE_HOME -Fallback (Join-Path $configHome 'opencode')
}

Warn-RelativeHome -EnvName 'CODEX_HOME' -Fallback $homeMap.codex
Warn-RelativeHome -EnvName 'CLAUDE_HOME' -Fallback $homeMap.claude
Warn-RelativeHome -EnvName 'GEMINI_HOME' -Fallback $homeMap.gemini
Warn-RelativeHome -EnvName 'OPENCODE_HOME' -Fallback $homeMap.opencode

if (Client-Enabled 'codex') {
  Install-ForClient -ClientName 'codex' -TargetRoot (Join-Path $homeMap.codex 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'codex')
}

if (Client-Enabled 'claude') {
  Install-ForClient -ClientName 'claude' -TargetRoot (Join-Path $homeMap.claude 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'claude')
}

if (Client-Enabled 'gemini') {
  Install-ForClient -ClientName 'gemini' -TargetRoot (Join-Path $homeMap.gemini 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'gemini')
}

if (Client-Enabled 'opencode') {
  Install-ForClient -ClientName 'opencode' -TargetRoot (Join-Path $homeMap.opencode 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'opencode')
}
