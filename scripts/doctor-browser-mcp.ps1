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

function Get-OptionalPropertyValue {
  param(
    [Parameter(Mandatory = $false)]$Object,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $prop = $Object.PSObject.Properties[$Name]
  if ($null -ne $prop) {
    return $prop.Value
  }

  return $null
}

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

# Advisory: Playwright + our build scripts expect a modern Node runtime.
try {
  $nodeVersion = (& node -p "process.versions.node" 2>$null)
  if ($LASTEXITCODE -eq 0 -and $nodeVersion) {
    $majorText = ($nodeVersion.Trim().Split('.')[0])
    $major = 0
    if ([int]::TryParse($majorText, [ref]$major) -and $major -lt 20) {
      Warn "node version is $nodeVersion (recommended: >= 20)"
    }
  }
} catch {
}

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
  $cfg = $null
  try {
    $cfg = Get-Content -Path $ProfileConfig -Raw | ConvertFrom-Json
  }
  catch {
    Err "profile config JSON parse failed: $($_.Exception.Message)"
  }

  if ($cfg) {
    $profiles = Get-OptionalPropertyValue -Object $cfg -Name "profiles"
    $defaultProfile = Get-OptionalPropertyValue -Object $profiles -Name "default"
    if (-not $defaultProfile) {
      Warn "profile config has no profiles.default entry"
    } else {
      $executablePath = Get-OptionalPropertyValue -Object $defaultProfile -Name "executablePath"
      if ($executablePath) {
        if (Test-Path $executablePath) { Ok "default executablePath exists" }
        else { Warn "default executablePath not found: $executablePath" }
      }

      $userDataDir = Get-OptionalPropertyValue -Object $defaultProfile -Name "userDataDir"
      if ($userDataDir) {
        Ok "default userDataDir set: $userDataDir"
      }
    }
  }
}

Write-Host ""
Write-Host "[5/6] default profile mode"
if (-not $defaultProfile) {
  Warn "default profile not configured; skipping CDP mode checks"
}
else {
  $cdpUrl = Get-OptionalPropertyValue -Object $defaultProfile -Name "cdpUrl"
  $cdpPortValue = Get-OptionalPropertyValue -Object $defaultProfile -Name "cdpPort"

  if ($cdpUrl) {
    Ok "default profile uses cdpUrl: $cdpUrl"
  }
  elseif ($cdpPortValue) {
    $port = 0
    if (-not [int]::TryParse([string]$cdpPortValue, [ref]$port)) {
      Warn "default cdpPort is not a valid integer: $cdpPortValue"
    }
    elseif (Test-PortOpen -Port $port) {
      Ok "default CDP port is reachable: $port"
    }
    else {
      Warn "default CDP port is not reachable: $port (profile=default will auto-fallback to local launch)"
    }
  }
  else {
    Ok "default profile uses local launch mode (no CDP dependency)"
  }
}

Write-Host ""
Write-Host "[6/6] quick next steps"
Write-Host "- If ERR exists: run install script first"
Write-Host "  scripts/install-browser-mcp.ps1"
Write-Host "- Then smoke test in client chat: browser_launch -> browser_navigate -> browser_snapshot"
Write-Host "  Read pageSummary/regions/elements first; use browser_screenshot(selector) only for visual fallback"
Write-Host "  Finally browser_close"

Write-Host ""
if ($ErrCount -gt 0) {
  Write-Host "Result: FAILED ($ErrCount errors, $WarnCount warnings)"
  exit 1
}

Write-Host "Result: OK ($WarnCount warnings)"
exit 0
