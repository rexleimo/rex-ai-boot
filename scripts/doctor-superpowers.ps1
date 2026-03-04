Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

[int]$ErrCount = 0
[int]$WarnCount = 0

function Ok([string]$Message) {
  Write-Host "OK   $Message"
}

function Warn([string]$Message) {
  $script:WarnCount += 1
  Write-Host "WARN $Message"
}

function Err([string]$Message) {
  $script:ErrCount += 1
  Write-Host "ERR  $Message"
}

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

Write-Host "Superpowers Doctor"
Write-Host "------------------"

if (Get-Command git -ErrorAction SilentlyContinue) {
  Ok "command exists: git"
} else {
  Err "missing command: git"
}

$codexHome = Normalize-HomeDir -Raw $env:CODEX_HOME -Fallback (Join-Path $HOME ".codex")
$agentsHome = Normalize-HomeDir -Raw $env:AGENTS_HOME -Fallback (Join-Path $HOME ".agents")
$superpowersDir = Join-Path $codexHome "superpowers"
$skillsSource = Join-Path $superpowersDir "skills"
$skillsTarget = Join-Path (Join-Path $agentsHome "skills") "superpowers"

Write-Host "codex_home: $codexHome"
Write-Host "agents_home: $agentsHome"
Write-Host "superpowers_dir: $superpowersDir"

if (Test-Path -LiteralPath (Join-Path $superpowersDir ".git")) {
  Ok "superpowers git repo found"
  try {
    $remote = (& git -C $superpowersDir config --get remote.origin.url).Trim()
    if ($remote) { Ok "origin: $remote" } else { Warn "origin URL is not configured" }
  } catch {
    Warn "cannot read origin URL"
  }
  try {
    $head = (& git -C $superpowersDir rev-parse --short HEAD).Trim()
    if ($head) { Ok "HEAD: $head" } else { Warn "cannot read HEAD" }
  } catch {
    Warn "cannot read HEAD"
  }
} else {
  Err "missing superpowers git repo: $superpowersDir"
}

if (Test-Path -LiteralPath $skillsSource) {
  Ok "skills source found: $skillsSource"
} else {
  Err "missing skills source directory: $skillsSource"
}

if (Test-ManagedLink -TargetPath $skillsTarget -SourcePath $skillsSource) {
  Ok "skills link valid: $skillsTarget -> $skillsSource"
} elseif (Test-Path -LiteralPath $skillsTarget) {
  Err "skills target exists but not linked to superpowers source: $skillsTarget"
} else {
  Err "skills link missing: $skillsTarget"
}

if ($ErrCount -gt 0) {
  Write-Host "Result: FAILED ($ErrCount errors, $WarnCount warnings)"
  exit 1
}

Write-Host "Result: OK ($WarnCount warnings)"
exit 0
