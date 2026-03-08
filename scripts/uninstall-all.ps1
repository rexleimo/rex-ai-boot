param(
  [string]$Components = 'shell,skills',
  [ValidateSet('all', 'codex', 'claude', 'gemini', 'opencode')]
  [string]$Client = 'all',
  [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$wrapper = Join-Path $PSScriptRoot 'aios.ps1'
$forward = @('uninstall')
if ($Help) {
  $forward += '--help'
} else {
  $forward += @('--components', $Components, '--client', $Client)
}

& $wrapper @forward
exit $LASTEXITCODE
