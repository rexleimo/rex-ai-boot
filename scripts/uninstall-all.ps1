param(
  [string]$Components = "shell,skills",
  [ValidateSet("all", "codex", "claude", "gemini", "opencode")]
  [string]$Client = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot

function Get-ComponentSet {
  param([string]$Raw)

  $parts = $Raw.ToLower().Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  if (-not $parts -or $parts.Count -eq 0) {
    throw "components cannot be empty"
  }

  foreach ($item in $parts) {
    if ($item -notin @('all', 'browser', 'shell', 'skills')) {
      throw "Unsupported component: $item. Allowed: browser,shell,skills (or all)"
    }
  }

  return $parts
}

function Has-Component {
  param(
    [string[]]$Set,
    [string]$Needle
  )

  return ($Set -contains 'all' -or $Set -contains $Needle)
}

function Run-Script {
  param(
    [string]$Path,
    [string[]]$Args = @()
  )

  $rendered = if ($Args.Count -gt 0) { "$Path $($Args -join ' ')" } else { $Path }
  Write-Host "+ $rendered"
  & $Path @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $rendered"
  }
}

$componentSet = Get-ComponentSet -Raw $Components
Write-Host "Uninstall components: $($componentSet -join ',')"

if (Has-Component -Set $componentSet -Needle 'shell') {
  Run-Script -Path (Join-Path $ScriptDir 'uninstall-contextdb-shell.ps1')
}

if (Has-Component -Set $componentSet -Needle 'skills') {
  Run-Script -Path (Join-Path $ScriptDir 'uninstall-contextdb-skills.ps1') -Args @('-Client', $Client)
}

if (Has-Component -Set $componentSet -Needle 'browser') {
  Write-Host '[info] Browser MCP has no destructive auto-uninstall script.'
  Write-Host '[info] It is safe to keep mcp-server build/runtime artifacts.'
  Write-Host '[info] For manual cleanup, remove mcp-server/node_modules and mcp-server/dist if needed.'
}

if (Has-Component -Set $componentSet -Needle 'shell') {
  Write-Host ""
  Write-Host 'Run: . $PROFILE'
}

Write-Host 'Done.'
