param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProfileFile = $PROFILE
$BeginMark = "# >>> contextdb-shell >>>"
$EndMark = "# <<< contextdb-shell <<<"

if (-not (Test-Path $ProfileFile)) {
  $parent = Split-Path -Parent $ProfileFile
  if (-not (Test-Path $parent)) {
    New-Item -Path $parent -ItemType Directory -Force | Out-Null
  }
  New-Item -Path $ProfileFile -ItemType File -Force | Out-Null
}

$content = Get-Content -Path $ProfileFile -Raw
if ($content -match [regex]::Escape($BeginMark)) {
  Write-Host "Already installed ($BeginMark)."
  Write-Host "Run: . `$PROFILE"
  exit 0
}

$block = @"
$BeginMark
if (-not `$env:ROOTPATH) { `$env:ROOTPATH = "$RootDir" }
`$ctxShell = Join-Path `$env:ROOTPATH "scripts/contextdb-shell.ps1"
if (Test-Path `$ctxShell) {
  . `$ctxShell
}
$EndMark
"@

Add-Content -Path $ProfileFile -Value "`n# ContextDB transparent CLI wrappers (codex/claude/gemini, PowerShell)"
Add-Content -Path $ProfileFile -Value $block

Write-Host "Installed into $ProfileFile"
Write-Host "Run: . `$PROFILE"
Write-Host "Then direct commands auto-use contextdb in repo: codex / claude / gemini"
