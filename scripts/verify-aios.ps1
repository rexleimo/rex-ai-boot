param(
  [switch]$Strict,
  [switch]$GlobalSecurity
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$RootDir = (Resolve-Path (Join-Path $ScriptDir '..')).Path

function Get-PowerShellExe {
  $cmd = Get-Command powershell -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) {
    return $cmd.Source
  }
  $cmd = Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) {
    return $cmd.Source
  }
  return $null
}

function Invoke-ScriptInSubprocess {
  param(
    [string]$ScriptPath,
    [string[]]$Args = @()
  )

  $exe = Get-PowerShellExe
  if (-not $exe) {
    throw "PowerShell executable not found (powershell/pwsh)"
  }

  & $exe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Args 2>&1
  $global:LASTEXITCODE = $LASTEXITCODE
}

function Count-EffectiveWarns {
  param([string[]]$Lines)

  $warnLines = $Lines | Where-Object { $_ -match '^\[warn\]' }
  if (-not $warnLines) {
    return 0
  }

  $filtered = $warnLines | Where-Object { $_ -notmatch '^\[warn\] (codex|claude|gemini) not found in PATH$' }
  if (-not $filtered) {
    return 0
  }

  return $filtered.Count
}

function Invoke-Doctor {
  param(
    [string]$Label,
    [string]$Path,
    [string[]]$Args = @()
  )

  Write-Host ""
  Write-Host "== $Label =="

  if (-not (Test-Path -LiteralPath $Path)) {
    return 0
  }

  $rendered = if ($Args.Count -gt 0) { "$Path $($Args -join ' ')" } else { $Path }
  Write-Host "+ $rendered"

  $lines = Invoke-ScriptInSubprocess -ScriptPath $Path -Args $Args
  if ($LASTEXITCODE -ne 0) {
    throw "$Label exited non-zero ($LASTEXITCODE)"
  }

  if ($lines) {
    $lines | ForEach-Object { Write-Host $_ }
  }

  return (Count-EffectiveWarns -Lines ($lines | ForEach-Object { [string]$_ }))
}

Write-Host "AIOS Verify"
Write-Host "-----------"
Write-Host "Repo: $RootDir"
Write-Host "Strict: $Strict"

[int]$effectiveWarns = 0

$effectiveWarns += Invoke-Doctor -Label 'doctor-contextdb-shell' -Path (Join-Path $ScriptDir 'doctor-contextdb-shell.ps1')
$effectiveWarns += Invoke-Doctor -Label 'doctor-contextdb-skills' -Path (Join-Path $ScriptDir 'doctor-contextdb-skills.ps1') -Args @('-Client', 'all')
$effectiveWarns += Invoke-Doctor -Label 'doctor-superpowers' -Path (Join-Path $ScriptDir 'doctor-superpowers.ps1')

$securityArgs = @()
if ($GlobalSecurity) {
  $securityArgs += '-Global'
}
if ($Strict) {
  $securityArgs += '-Strict'
}
$effectiveWarns += Invoke-Doctor -Label 'doctor-security-config' -Path (Join-Path $ScriptDir 'doctor-security-config.ps1') -Args $securityArgs
$effectiveWarns += Invoke-Doctor -Label 'doctor-bootstrap-task' -Path (Join-Path $ScriptDir 'doctor-bootstrap-task.ps1') -Args @('--workspace', $RootDir)

Write-Host ""
Write-Host "== doctor-browser-mcp =="
$browserDoctor = Join-Path $ScriptDir 'doctor-browser-mcp.ps1'
if (Test-Path -LiteralPath $browserDoctor) {
  try {
    Write-Host "+ $browserDoctor"
    & $browserDoctor
  } catch {
    Write-Host "[warn] doctor-browser-mcp failed; continuing"
    $effectiveWarns += 1
  }
}

Write-Host ""
Write-Host "== mcp-server build =="
$mcpDir = Join-Path $RootDir 'mcp-server'
if (Test-Path -LiteralPath $mcpDir) {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[warn] npm not found; skipping mcp-server build"
    $effectiveWarns += 1
  } else {
    Push-Location $mcpDir
    try {
      Write-Host "+ npm run typecheck"
      npm run typecheck
      if ($LASTEXITCODE -ne 0) { throw "typecheck failed ($LASTEXITCODE)" }

      Write-Host "+ npm run build"
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "build failed ($LASTEXITCODE)" }
    } finally {
      Pop-Location
    }
  }
} else {
  Write-Host "[warn] missing mcp-server directory; skipping"
  $effectiveWarns += 1
}

Write-Host ""
Write-Host "[summary] effective_warn=$effectiveWarns"
if ($Strict -and $effectiveWarns -gt 0) {
  Write-Host "[fail] strict mode: warnings found"
  exit 1
}

Write-Host "[ok] verify-aios complete"
exit 0
