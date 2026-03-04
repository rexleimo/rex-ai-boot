param(
  [string]$Components = "all",
  [ValidateSet("all", "repo-only", "opt-in", "off")]
  [string]$Mode = "opt-in",
  [ValidateSet("all", "codex", "claude", "gemini", "opencode")]
  [string]$Client = "all",
  [switch]$WithPlaywrightInstall,
  [switch]$SkipDoctor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot

function Get-ComponentSet {
  param([string]$Raw)

  if ([string]::IsNullOrWhiteSpace($Raw)) {
    throw "components cannot be empty"
  }

  [string[]]$parts = @(
    $Raw.ToLower().Split(',') |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ }
  )
  if (-not $parts -or $parts.Count -eq 0) {
    throw "components cannot be empty"
  }

  foreach ($item in $parts) {
    if ($item -notin @('all', 'browser', 'shell', 'skills', 'superpowers')) {
      throw "Unsupported component: $item. Allowed: browser,shell,skills,superpowers (or all)"
    }
  }

  return $parts
}

function Has-Component {
  param(
    [string[]]$Set,
    [string]$Needle
  )

  return ($Set -contains 'all' -or $Set -contains $Needle)
}

function Run-Script {
  param(
    [string]$Path,
    [string[]]$Args = @()
  )

  $rendered = if ($Args.Count -gt 0) { "$Path $($Args -join ' ')" } else { $Path }
  Write-Host "+ $rendered"
  & $Path @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $rendered"
  }
}

$componentSet = Get-ComponentSet -Raw $Components
Write-Host "Update components: $($componentSet -join ',')"

if (Has-Component -Set $componentSet -Needle 'browser') {
  $args = @()
  if (-not $WithPlaywrightInstall) {
    $args += '-SkipPlaywrightInstall'
  }
  Run-Script -Path (Join-Path $ScriptDir 'install-browser-mcp.ps1') -Args $args
  if (-not $SkipDoctor) {
    Run-Script -Path (Join-Path $ScriptDir 'doctor-browser-mcp.ps1')
  }
}

if (Has-Component -Set $componentSet -Needle 'shell') {
  Run-Script -Path (Join-Path $ScriptDir 'update-contextdb-shell.ps1') -Args @('-Mode', $Mode)
  if (-not $SkipDoctor) {
    Run-Script -Path (Join-Path $ScriptDir 'doctor-contextdb-shell.ps1')
  }
}

if (Has-Component -Set $componentSet -Needle 'skills') {
  Run-Script -Path (Join-Path $ScriptDir 'update-contextdb-skills.ps1') -Args @('-Client', $Client)
  if (-not $SkipDoctor) {
    Run-Script -Path (Join-Path $ScriptDir 'doctor-contextdb-skills.ps1') -Args @('-Client', $Client)
  }
}

if (Has-Component -Set $componentSet -Needle 'superpowers') {
  Run-Script -Path (Join-Path $ScriptDir 'update-superpowers.ps1')
  if (-not $SkipDoctor) {
    Run-Script -Path (Join-Path $ScriptDir 'doctor-superpowers.ps1')
  }
}

if (Has-Component -Set $componentSet -Needle 'shell') {
  Write-Host ""
  Write-Host 'Run: . $PROFILE'
}

Write-Host 'Done.'
