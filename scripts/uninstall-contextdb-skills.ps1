param(
  [ValidateSet("all", "codex", "claude")]
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

function Uninstall-ForClient {
  param(
    [string]$ClientName,
    [string]$SourceRoot,
    [string]$TargetRoot
  )

  if (-not (Test-Path -LiteralPath $SourceRoot)) {
    Write-Host "[warn] $ClientName source skills directory not found: $SourceRoot"
    return
  }

  [int]$removed = 0
  [int]$skipped = 0

  $skillDirs = Get-ChildItem -LiteralPath $SourceRoot -Directory | Where-Object {
    $_.Name -notmatch '^\.' -and (Test-Path (Join-Path $_.FullName 'SKILL.md'))
  }

  foreach ($skillDir in $skillDirs) {
    $sourceAbs = (Resolve-Path -LiteralPath $skillDir.FullName).Path
    $targetPath = Join-Path $TargetRoot $skillDir.Name

    if (Test-ManagedLink -TargetPath $targetPath -SourcePath $sourceAbs) {
      Remove-Item -LiteralPath $targetPath -Recurse -Force
      Write-Host "[remove] $ClientName skill link removed: $($skillDir.Name)"
      $removed += 1
      continue
    }

    if (Test-Path -LiteralPath $targetPath) {
      Write-Host "[skip] $ClientName skill not managed by this repo: $($skillDir.Name)"
      $skipped += 1
    }
  }

  Write-Host "[done] $ClientName skills -> removed=$removed skipped=$skipped"
}

$codexHome = Normalize-HomeDir -Raw $env:CODEX_HOME -Fallback (Join-Path $HOME '.codex')
$claudeHome = Normalize-HomeDir -Raw $env:CLAUDE_HOME -Fallback (Join-Path $HOME '.claude')

if ($Client -eq 'all' -or $Client -eq 'codex') {
  Uninstall-ForClient -ClientName 'codex' -SourceRoot (Join-Path $RootDir '.codex/skills') -TargetRoot (Join-Path $codexHome 'skills')
}

if ($Client -eq 'all' -or $Client -eq 'claude') {
  Uninstall-ForClient -ClientName 'claude' -SourceRoot (Join-Path $RootDir '.claude/skills') -TargetRoot (Join-Path $claudeHome 'skills')
}
