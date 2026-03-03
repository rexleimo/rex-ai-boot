param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$McpDir = Join-Path $RootDir "mcp-server"
$DistEntry = Join-Path $McpDir "dist/index.js"
$ProfileConfig = Join-Path $RootDir "config/browser-profiles.json"

$ErrCount = 0
$WarnCount = 0

function Ok([string]$Msg) { Write-Host "OK   $Msg" }
function Warn([string]$Msg) { $script:WarnCount += 1; Write-Host "WARN $Msg" }
function Err([string]$Msg) { $script:ErrCount += 1; Write-Host "ERR  $Msg" }

function Check-Command([string]$Name) {
  if (Get-Command $Name -ErrorAction SilentlyContinue) { Ok "command exists: $Name" }
  else { Err "missing command: $Name" }
}

function Test-PortOpen([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(300)
    if ($ok -and $client.Connected) {
      $client.EndConnect($async)
      $client.Close()
      return $true
    }
    $client.Close()
    return $false
  }
  catch {
    return $false
  }
}

Write-Host "Browser MCP Doctor"
Write-Host "Repo: $RootDir"
Write-Host ""
Write-Host "[1/6] Command checks"
Check-Command node
Check-Command npm
Check-Command npx

Write-Host ""
Write-Host "[2/6] mcp-server files"
if (Test-Path (Join-Path $McpDir "package.json")) { Ok "mcp-server/package.json found" } else { Err "missing mcp-server/package.json" }
if (Test-Path (Join-Path $McpDir "node_modules")) { Ok "mcp-server/node_modules found" } else { Err "node_modules missing. Run: cd mcp-server; npm install" }
if (Test-Path $DistEntry) { Ok "build artifact found: mcp-server/dist/index.js" } else { Err "build artifact missing. Run: cd mcp-server; npm run build" }

Write-Host ""
Write-Host "[3/6] Playwright runtime"
try {
  Push-Location $McpDir
  $pwPath = (& node -e "process.stdout.write(require('playwright').chromium.executablePath())" 2>$null)
  Pop-Location
  if ($pwPath -and (Test-Path $pwPath)) { Ok "Playwright chromium executable found" }
  else { Warn "Playwright chromium executable not installed. Run: cd mcp-server; npx playwright install chromium" }
}
catch {
  try { Pop-Location } catch {}
  Err "cannot resolve Playwright runtime. Run: cd mcp-server; npm install"
}

Write-Host ""
Write-Host "[4/6] profile config"
if (-not (Test-Path $ProfileConfig)) {
  Err "profile config missing: config/browser-profiles.json"
} else {
  Ok "profile config found: config/browser-profiles.json"
}

$defaultProfile = $null
if (Test-Path $ProfileConfig) {
  try {
    $cfg = Get-Content -Path $ProfileConfig -Raw | ConvertFrom-Json
    $defaultProfile = $cfg.profiles.default
    if ($defaultProfile.executablePath) {
      if (Test-Path $defaultProfile.executablePath) { Ok "default executablePath exists" }
      else { Warn "default executablePath not found: $($defaultProfile.executablePath)" }
    }
    if ($defaultProfile.userDataDir) {
      Ok "default userDataDir set: $($defaultProfile.userDataDir)"
    }
  }
  catch {
    Err "profile config is not valid JSON"
  }
}

Write-Host ""
Write-Host "[5/6] default profile mode"
if ($defaultProfile -and $defaultProfile.cdpUrl) {
  Ok "default profile uses cdpUrl: $($defaultProfile.cdpUrl)"
}
elseif ($defaultProfile -and $defaultProfile.cdpPort) {
  $port = [int]$defaultProfile.cdpPort
  if (Test-PortOpen -Port $port) {
    Ok "default CDP port is reachable: $port"
  }
  else {
    Warn "default CDP port is not reachable: $port (profile=default will auto-fallback to local launch)"
  }
}
else {
  Ok "default profile uses local launch mode (no CDP dependency)"
}

Write-Host ""
Write-Host "[6/6] quick next steps"
Write-Host "- If ERR exists: run install script first"
Write-Host "  scripts/install-browser-mcp.ps1"
Write-Host "- Then smoke test in client chat: browser_launch -> browser_navigate -> browser_snapshot -> browser_close"

Write-Host ""
if ($ErrCount -gt 0) {
  Write-Host "Result: FAILED ($ErrCount errors, $WarnCount warnings)"
  exit 1
}

Write-Host "Result: OK ($WarnCount warnings)"
exit 0
