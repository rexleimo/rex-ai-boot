param(
  [switch]$Strict,
  [switch]$GlobalSecurity,
  [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$wrapper = Join-Path $PSScriptRoot 'aios.ps1'
$forward = @('doctor')
if ($Help) {
  $forward += '--help'
} else {
  if ($Strict) { $forward += '--strict' }
  if ($GlobalSecurity) { $forward += '--global-security' }
}

& $wrapper @forward
exit $LASTEXITCODE
