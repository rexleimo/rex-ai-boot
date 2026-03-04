param(
  [ValidateSet("all", "codex", "claude", "gemini", "opencode")]
  [string]$Client = "all"
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

function Check-Client {
  param(
    [string]$ClientName,
    [string]$TargetRoot,
    [string[]]$SourceRoots
  )

  Write-Host "$ClientName target root: $TargetRoot"

  $entries = Get-SkillEntries -SourceRoots $SourceRoots
  if ($entries.Count -eq 0) {
    Write-Host "[warn] $ClientName no skill sources found. Checked roots:"
    foreach ($root in $SourceRoots) {
      Write-Host "  - $root"
    }
    return
  }

  [int]$ok = 0
  [int]$warn = 0

  foreach ($entry in $entries) {
    $targetPath = Join-Path $TargetRoot $entry.Name

    if (Test-ManagedLink -TargetPath $targetPath -SourcePath $entry.SourcePath) {
      Write-Host "[ok] $ClientName: $($entry.Name) linked"
      $ok += 1
    } elseif (Test-Path -LiteralPath $targetPath) {
      Write-Host "[warn] $ClientName: $($entry.Name) exists but not linked to this repo"
      $warn += 1
    } else {
      Write-Host "[warn] $ClientName: $($entry.Name) not installed"
      $warn += 1
    }
  }

  Write-Host "[summary] $ClientName ok=$ok warn=$warn"
}

Write-Host "ContextDB Skills Doctor"
Write-Host "-----------------------"

$configHome = Get-ConfigHome
$homeMap = @{
  codex = Normalize-HomeDir -Raw $env:CODEX_HOME -Fallback (Join-Path $HOME '.codex')
  claude = Normalize-HomeDir -Raw $env:CLAUDE_HOME -Fallback (Join-Path $HOME '.claude')
  gemini = Normalize-HomeDir -Raw $env:GEMINI_HOME -Fallback (Join-Path $HOME '.gemini')
  opencode = Normalize-HomeDir -Raw $env:OPENCODE_HOME -Fallback (Join-Path $configHome 'opencode')
}

if (Client-Enabled 'codex') {
  Check-Client -ClientName 'codex' -TargetRoot (Join-Path $homeMap.codex 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'codex')
}

if (Client-Enabled 'claude') {
  Check-Client -ClientName 'claude' -TargetRoot (Join-Path $homeMap.claude 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'claude')
}

if (Client-Enabled 'gemini') {
  Check-Client -ClientName 'gemini' -TargetRoot (Join-Path $homeMap.gemini 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'gemini')
}

if (Client-Enabled 'opencode') {
  Check-Client -ClientName 'opencode' -TargetRoot (Join-Path $homeMap.opencode 'skills') -SourceRoots (Get-ClientSourceRoots -ClientName 'opencode')
}
