param(
  [switch]$DryRun,
  [switch]$SkipPlaywrightInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$McpDir = Join-Path $RootDir "mcp-server"
$DistEntry = Join-Path $McpDir "dist/index.js"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Invoke-InMcp([string]$Command, [string[]]$Arguments) {
  $argsText = if ($Arguments) { $Arguments -join ' ' } else { '' }
  Write-Host "+ (cd $McpDir && $Command $argsText)"
  if ($DryRun) {
    return
  }

  Push-Location $McpDir
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed: $Command $argsText"
    }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $McpDir)) {
  throw "mcp-server directory not found: $McpDir"
}

Require-Command node
Require-Command npm
Require-Command npx

Invoke-InMcp -Command "npm" -Arguments @("install")

if (-not $SkipPlaywrightInstall) {
  Invoke-InMcp -Command "npx" -Arguments @("playwright", "install", "chromium")
}

Invoke-InMcp -Command "npm" -Arguments @("run", "build")

$distPath = if ($DryRun) { "<ABSOLUTE_PATH_TO_REPO>/mcp-server/dist/index.js" } else { (Resolve-Path $DistEntry).Path }

Write-Host ""
Write-Host "Done. Add this MCP server block to your client config:"
Write-Host ""
Write-Host '{'
Write-Host '  "mcpServers": {'
Write-Host '    "playwright-browser-mcp": {'
Write-Host '      "command": "node",'
Write-Host ('      "args": ["{0}"]' -f $distPath)
Write-Host '    }'
Write-Host '  }'
Write-Host '}'
Write-Host ""
Write-Host "Next:"
Write-Host "1) Restart your CLI client."
Write-Host "2) Run: scripts/doctor-browser-mcp.ps1"
Write-Host "3) In chat, smoke test:"
Write-Host '   - browser_launch {"profile":"default"}'
Write-Host '   - browser_navigate {"url":"https://example.com"}'
Write-Host '   - browser_snapshot {}'
Write-Host '   - browser_close {}'
