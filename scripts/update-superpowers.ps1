Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installer = Join-Path $PSScriptRoot "install-superpowers.ps1"
& powershell -ExecutionPolicy Bypass -File $installer -Update -Force @args
