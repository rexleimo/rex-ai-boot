Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProfileFile = $PROFILE
$BeginMark = "# >>> contextdb-shell >>>"
$EndMark = "# <<< contextdb-shell <<<"

if (-not (Test-Path $ProfileFile)) {
  Write-Host "Nothing to uninstall: $ProfileFile does not exist."
  exit 0
}

$content = Get-Content -Path $ProfileFile -Raw
$escapedBeginMark = [regex]::Escape($BeginMark)
$escapedEndMark = [regex]::Escape($EndMark)
$blockPattern = "(?ms)^$escapedBeginMark\r?\n.*?^$escapedEndMark\r?\n?"
$content = [regex]::Replace($content, $blockPattern, "")
$content = (
  $content -split "`r?`n" | Where-Object {
    $_ -notmatch '^\.\s+.*scripts/contextdb-shell\.ps1\s*$' -and
    $_ -notmatch '^# ContextDB transparent CLI wrappers \(codex/claude/gemini, PowerShell\)$'
  }
) -join "`n"

Set-Content -Path $ProfileFile -Value ($content.TrimEnd() + "`n") -NoNewline

Write-Host "Removed ContextDB managed block from $ProfileFile"
Write-Host "Run: . `$PROFILE"
