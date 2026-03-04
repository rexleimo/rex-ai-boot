param(
  [ValidateSet("all", "repo-only", "opt-in", "off")]
  [string]$Mode = "opt-in",
  [switch]$Force
)

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
$escapedBeginMark = [regex]::Escape($BeginMark)
$escapedEndMark = [regex]::Escape($EndMark)
$blockPattern = "(?ms)^$escapedBeginMark\r?\n.*?^$escapedEndMark\r?\n?"

if ($content -match [regex]::Escape($BeginMark)) {
  if ($Force) {
    $content = [regex]::Replace($content, $blockPattern, "")
  } else {
    Write-Host "Already installed ($BeginMark). Use -Force to update."
    Write-Host "Run: . `$PROFILE"
    exit 0
  }
}

# remove one-line legacy source command if present
$content = (
  $content -split "`r?`n" | Where-Object {
    $_ -notmatch '^\.\s+.*scripts/contextdb-shell\.ps1\s*$' -and
    $_ -notmatch '^# ContextDB transparent CLI wrappers \(codex/claude/gemini, PowerShell\)$'
  }
) -join "`n"

$block = @"
$BeginMark
# ContextDB transparent CLI wrappers (codex/claude/gemini, PowerShell)
if (-not `$env:ROOTPATH) { `$env:ROOTPATH = "$RootDir" }
if (-not `$env:CTXDB_WRAP_MODE) { `$env:CTXDB_WRAP_MODE = "$Mode" }
if (`$env:CODEX_HOME -and -not [System.IO.Path]::IsPathRooted(`$env:CODEX_HOME)) {
  `$env:CODEX_HOME = Join-Path `$HOME ".codex"
}
`$ctxShell = Join-Path `$env:ROOTPATH "scripts/contextdb-shell.ps1"
if (Test-Path `$ctxShell) {
  . `$ctxShell
}
$EndMark
"@

$newContent = $content.TrimEnd()
if ($newContent.Length -gt 0) {
  $newContent += "`n`n"
}
$newContent += $block + "`n"

Set-Content -Path $ProfileFile -Value $newContent -NoNewline

Write-Host "Installed into $ProfileFile"
Write-Host "Default wrap mode: $Mode"
Write-Host "Run: . `$PROFILE"
Write-Host "Uninstall: powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1"
