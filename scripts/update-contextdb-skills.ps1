param(
  [ValidateSet("all", "codex", "claude")]
  [string]$Client = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installer = Join-Path $PSScriptRoot "install-contextdb-skills.ps1"
& powershell -ExecutionPolicy Bypass -File $installer -Client $Client -Force
