param(
  [Parameter(Position = 0)]
  [string]$Command,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args,
  [switch]$InstallNode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptPath = Join-Path $PSScriptRoot 'aios.mjs'

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { return $cmd.Source }
  return $null
}

function Install-NodeNow {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host '+ winget install OpenJS.NodeJS.LTS'
    winget install --accept-package-agreements --accept-source-agreements OpenJS.NodeJS.LTS
    return
  }

  throw 'Node.js 22+ is required. Install it manually or use winget.'
}

$nodePath = Get-NodePath
if (-not $nodePath) {
  if ($InstallNode) {
    Install-NodeNow
    $nodePath = Get-NodePath
  } elseif ($Host.Name -and $Host.UI) {
    $reply = Read-Host 'Node.js 22+ is required. Install now with winget? [y/N]'
    if ($reply -match '^(y|yes)$') {
      Install-NodeNow
      $nodePath = Get-NodePath
    }
  }
}

if (-not $nodePath) {
  throw 'AIOS now uses Node.js as the unified lifecycle runtime. Install Node.js 22 LTS and rerun.'
}

$nodeMajor = (& $nodePath -p "process.versions.node.split('.')[0]")
if ([int]$nodeMajor -lt 22) {
  throw "Node.js 22+ is required (found $(& $nodePath -v))."
}

$forward = @()
if ($PSBoundParameters.ContainsKey('Command') -and $Command) {
  $forward += $Command
}
if ($Args) {
  $forward += $Args
}

& $nodePath $ScriptPath @forward
exit $LASTEXITCODE
