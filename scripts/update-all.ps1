param(
  [string]$Components = 'all',
  [ValidateSet('all', 'repo-only', 'opt-in', 'off')]
  [string]$Mode = 'opt-in',
  [ValidateSet('all', 'codex', 'claude', 'gemini', 'opencode')]
  [string]$Client = 'all',
  [switch]$WithPlaywrightInstall,
  [switch]$SkipDoctor,
  [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$wrapper = Join-Path $PSScriptRoot 'aios.ps1'
$forward = @('update')
if ($Help) {
  $forward += '--help'
} else {
  $forward += @('--components', $Components, '--mode', $Mode, '--client', $Client)
  if ($WithPlaywrightInstall) { $forward += '--with-playwright-install' }
  if ($SkipDoctor) { $forward += '--skip-doctor' }
}

& $wrapper @forward
exit $LASTEXITCODE
