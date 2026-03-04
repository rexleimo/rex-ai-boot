param(
  [ValidateSet("all", "repo-only", "opt-in", "off")]
  [string]$Mode = "opt-in"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installer = Join-Path $PSScriptRoot "install-contextdb-shell.ps1"
& powershell -ExecutionPolicy Bypass -File $installer -Mode $Mode -Force
