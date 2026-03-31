param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$wrapper = Join-Path $PSScriptRoot 'aios.ps1'

# Build argument list, filtering out empty strings
$passArgs = @()
if ($Args -and @($Args).Count -gt 0) {
  $passArgs = @($Args) | Where-Object { $_ -and $_.Trim() }
}

& $wrapper internal shell install @passArgs
exit $LASTEXITCODE
