param(
  [string]$Repo = "https://github.com/obra/superpowers.git",
  [switch]$Update,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Missing required command: git"
}

$codexHome = Normalize-HomeDir -Raw $env:CODEX_HOME -Fallback (Join-Path $HOME ".codex")
$agentsHome = Normalize-HomeDir -Raw $env:AGENTS_HOME -Fallback (Join-Path $HOME ".agents")
Warn-RelativeHome -EnvName "CODEX_HOME" -Fallback $codexHome
Warn-RelativeHome -EnvName "AGENTS_HOME" -Fallback $agentsHome

$superpowersDir = Join-Path $codexHome "superpowers"
$skillsSource = Join-Path $superpowersDir "skills"
$skillsTarget = Join-Path (Join-Path $agentsHome "skills") "superpowers"

$gitDir = Join-Path $superpowersDir ".git"
if (Test-Path -LiteralPath $gitDir) {
  Write-Host "[ok] superpowers repo found: $superpowersDir"
  if ($Update) {
    Write-Host "+ git -C `"$superpowersDir`" pull --ff-only"
    & git -C $superpowersDir pull --ff-only
    if ($LASTEXITCODE -ne 0) {
      throw "git pull failed: $superpowersDir"
    }
  }
} elseif (Test-Path -LiteralPath $superpowersDir) {
  if ($Force) {
    Write-Host "[warn] replacing non-repo path: $superpowersDir"
    Remove-Item -LiteralPath $superpowersDir -Recurse -Force
    New-Item -Path (Split-Path -Parent $superpowersDir) -ItemType Directory -Force | Out-Null
    Write-Host "+ git clone `"$Repo`" `"$superpowersDir`""
    & git clone $Repo $superpowersDir
    if ($LASTEXITCODE -ne 0) {
      throw "git clone failed: $Repo -> $superpowersDir"
    }
  } else {
    throw "Path exists but is not a git repo: $superpowersDir (rerun with -Force to replace)"
  }
} else {
  New-Item -Path (Split-Path -Parent $superpowersDir) -ItemType Directory -Force | Out-Null
  Write-Host "+ git clone `"$Repo`" `"$superpowersDir`""
  & git clone $Repo $superpowersDir
  if ($LASTEXITCODE -ne 0) {
    throw "git clone failed: $Repo -> $superpowersDir"
  }
}

if (-not (Test-Path -LiteralPath $skillsSource)) {
  throw "Missing skills directory in repo: $skillsSource"
}

New-Item -Path (Split-Path -Parent $skillsTarget) -ItemType Directory -Force | Out-Null

if (Test-ManagedLink -TargetPath $skillsTarget -SourcePath $skillsSource) {
  Write-Host "[ok] superpowers link already configured: $skillsTarget"
} elseif (Test-Path -LiteralPath $skillsTarget) {
  if ($Force) {
    Remove-Item -LiteralPath $skillsTarget -Recurse -Force
    New-ManagedLink -SourcePath $skillsSource -TargetPath $skillsTarget
    Write-Host "[link] replaced existing path with superpowers link: $skillsTarget -> $skillsSource"
  } else {
    throw "Existing path blocks superpowers link: $skillsTarget (rerun with -Force)"
  }
} else {
  New-ManagedLink -SourcePath $skillsSource -TargetPath $skillsTarget
  Write-Host "[link] superpowers linked: $skillsTarget -> $skillsSource"
}

Write-Host "[done] superpowers install complete"
