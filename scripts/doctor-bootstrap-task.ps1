param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PassThroughArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$scriptPath = Join-Path $ScriptDir 'doctor-bootstrap-task.mjs'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[warn] node not found; cannot run bootstrap task doctor"
  exit 0
}

$rendered = if ($PassThroughArgs.Count -gt 0) { "$scriptPath $($PassThroughArgs -join ' ')" } else { $scriptPath }
Write-Host "+ node $rendered"

& node $scriptPath @PassThroughArgs
exit $LASTEXITCODE
