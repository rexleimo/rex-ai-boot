Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "ContextDB Shell Doctor"
Write-Host "----------------------"

$profileFile = $PROFILE
Write-Host "Profile file: $profileFile"

if (Test-Path $profileFile) {
  $content = Get-Content -Path $profileFile -Raw
  if ($content -match [regex]::Escape("# >>> contextdb-shell >>>")) {
    Write-Host "[ok] contextdb managed block found in profile"
  } else {
    Write-Host "[warn] contextdb managed block not found in profile"
  }
} else {
  Write-Host "[warn] profile file does not exist"
}

$rootPath = if ($env:ROOTPATH) { $env:ROOTPATH } else { "<unset>" }
$wrapMode = if ($env:CTXDB_WRAP_MODE) { $env:CTXDB_WRAP_MODE } else { "<unset>" }
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { "<unset>" }

Write-Host "ROOTPATH: $rootPath"
Write-Host "CTXDB_WRAP_MODE: $wrapMode"
Write-Host "CODEX_HOME: $codexHome"

if ($env:CODEX_HOME) {
  if (-not [System.IO.Path]::IsPathRooted($env:CODEX_HOME)) {
    Write-Host "[warn] CODEX_HOME is relative ($($env:CODEX_HOME)); recommend: `$env:CODEX_HOME = Join-Path `$HOME '.codex'"
  } elseif (-not (Test-Path $env:CODEX_HOME)) {
    Write-Host "[warn] CODEX_HOME directory does not exist ($($env:CODEX_HOME))"
  } else {
    Write-Host "[ok] CODEX_HOME looks valid"
  }
}

if (Get-Command codex -ErrorAction SilentlyContinue) {
  Write-Host "[ok] codex found"
} else {
  Write-Host "[warn] codex not found in PATH"
}

if (Get-Command claude -ErrorAction SilentlyContinue) {
  Write-Host "[ok] claude found"
} else {
  Write-Host "[warn] claude not found in PATH"
}

if (Get-Command gemini -ErrorAction SilentlyContinue) {
  Write-Host "[ok] gemini found"
} else {
  Write-Host "[warn] gemini not found in PATH"
}
