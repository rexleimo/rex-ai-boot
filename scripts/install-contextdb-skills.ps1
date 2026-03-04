param(
  [ValidateSet("all", "codex", "claude")]
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

function Trim-Path {
  param([string]$Path)
  return $Path.TrimEnd('\', '/')
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

function Install-ForClient {
  param(
    [string]$ClientName,
    [string]$SourceRoot,
    [string]$TargetRoot
  )

  if (-not (Test-Path -LiteralPath $SourceRoot)) {
    Write-Host "[warn] $ClientName source skills directory not found: $SourceRoot"
    return
  }

  New-Item -Path $TargetRoot -ItemType Directory -Force | Out-Null

  [int]$installed = 0
  [int]$reused = 0
  [int]$replaced = 0
  [int]$skipped = 0

  $skillDirs = Get-ChildItem -LiteralPath $SourceRoot -Directory | Where-Object {
    $_.Name -notmatch '^\.' -and (Test-Path (Join-Path $_.FullName 'SKILL.md'))
  }

  foreach ($skillDir in $skillDirs) {
    $sourceAbs = (Resolve-Path -LiteralPath $skillDir.FullName).Path
    $targetPath = Join-Path $TargetRoot $skillDir.Name

    if (Test-Path -LiteralPath $targetPath) {
      if (Test-ManagedLink -TargetPath $targetPath -SourcePath $sourceAbs) {
        Write-Host "[ok] $ClientName skill already linked: $($skillDir.Name)"
        $reused += 1
        continue
      }

      if ($Force) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
        $replaced += 1
      } else {
        Write-Host "[skip] $ClientName skill exists (use -Force to replace): $($skillDir.Name)"
        $skipped += 1
        continue
      }
    }

    New-ManagedLink -SourcePath $sourceAbs -TargetPath $targetPath
    Write-Host "[link] $ClientName skill installed: $($skillDir.Name)"
    $installed += 1
  }

  Write-Host "[done] $ClientName skills -> installed=$installed reused=$reused replaced=$replaced skipped=$skipped"
}

$codexHome = Normalize-HomeDir -Raw $env:CODEX_HOME -Fallback (Join-Path $HOME '.codex')
$claudeHome = Normalize-HomeDir -Raw $env:CLAUDE_HOME -Fallback (Join-Path $HOME '.claude')

if ($env:CODEX_HOME -and -not [System.IO.Path]::IsPathRooted($env:CODEX_HOME)) {
  Write-Host "[warn] CODEX_HOME is relative ($($env:CODEX_HOME)); using $codexHome"
}
if ($env:CLAUDE_HOME -and -not [System.IO.Path]::IsPathRooted($env:CLAUDE_HOME)) {
  Write-Host "[warn] CLAUDE_HOME is relative ($($env:CLAUDE_HOME)); using $claudeHome"
}

if ($Client -eq 'all' -or $Client -eq 'codex') {
  Install-ForClient -ClientName 'codex' -SourceRoot (Join-Path $RootDir '.codex/skills') -TargetRoot (Join-Path $codexHome 'skills')
}

if ($Client -eq 'all' -or $Client -eq 'claude') {
  Install-ForClient -ClientName 'claude' -SourceRoot (Join-Path $RootDir '.claude/skills') -TargetRoot (Join-Path $claudeHome 'skills')
}
