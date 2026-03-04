param(
  [string]$Workspace = "",
  [switch]$Global,
  [switch]$Strict
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$scriptPath = Join-Path $ScriptDir 'doctor-security-config.mjs'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[warn] node not found; cannot run security config doctor"
  exit 0
}

$args = @()
if ($Workspace) {
  $args += @('--workspace', $Workspace)
}
if ($Global) {
  $args += '--global'
}
if ($Strict) {
  $args += '--strict'
}

$rendered = @('node', $scriptPath) + $args
Write-Host ("+ " + ($rendered -join ' '))

& node $scriptPath @args
exit $LASTEXITCODE

