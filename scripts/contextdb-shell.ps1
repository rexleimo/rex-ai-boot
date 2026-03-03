# ContextDB transparent command wrappers for PowerShell.
# Source this file in PowerShell profile to make codex/claude/gemini auto-load context packets.
# Optional env vars:
# - ROOTPATH
# - CTXDB_RUNNER
# - CTXDB_REPO_NAME
# - CTXDB_WRAP_MODE: all|repo-only|opt-in|off
# - CTXDB_MARKER_FILE (default: .contextdb-enable)

$script:CTXDB_LAST_WORKSPACE = ""

function Get-CtxRunner {
  if ($env:CTXDB_RUNNER -and (Test-Path $env:CTXDB_RUNNER)) {
    return $env:CTXDB_RUNNER
  }

  if ($env:ROOTPATH) {
    $candidate = Join-Path $env:ROOTPATH "scripts/ctx-agent.mjs"
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Get-WorkspaceRoot {
  try {
    $gitRoot = (& git -C (Get-Location).Path rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -eq 0 -and $gitRoot) {
      return ($gitRoot | Select-Object -First 1).Trim()
    }
  } catch {
    return $null
  }

  return $null
}

function Should-Wrap-Workspace {
  param([string]$Workspace)

  $mode = if ($env:CTXDB_WRAP_MODE) { $env:CTXDB_WRAP_MODE } else { "all" }

  switch ($mode) {
    "all" { return $true }
    "repo-only" {
      if (-not $env:ROOTPATH) { return $false }
      try {
        $root = (Resolve-Path $env:ROOTPATH).Path
        return [string]::Equals($Workspace, $root, [System.StringComparison]::OrdinalIgnoreCase)
      } catch {
        return $false
      }
    }
    "opt-in" {
      $marker = if ($env:CTXDB_MARKER_FILE) { $env:CTXDB_MARKER_FILE } else { ".contextdb-enable" }
      return (Test-Path (Join-Path $Workspace $marker))
    }
    "off" { return $false }
    "disabled" { return $false }
    "none" { return $false }
    default { return $true }
  }
}

function Invoke-NativeCommand {
  param(
    [string]$Name,
    [string[]]$Arguments
  )

  $cmd = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) {
    Write-Error "Command not found: $Name"
    return 127
  }

  & $cmd.Source @Arguments
  return $LASTEXITCODE
}

function Test-FirstArgNotInList {
  param(
    [string]$First,
    [string[]]$Blocked
  )

  if (-not $First) {
    return $true
  }

  return -not ($Blocked -contains $First)
}

function Should-Wrap-Codex {
  param([string]$First)
  $blocked = @("exec","review","login","logout","mcp","mcp-server","app-server","app","completion","sandbox","debug","apply","resume","fork","cloud","features","help","-h","--help","-V","--version")
  return (Test-FirstArgNotInList -First $First -Blocked $blocked)
}

function Should-Wrap-Claude {
  param([string]$First)
  $blocked = @("agents","auth","doctor","install","mcp","plugin","setup-token","update","upgrade","-h","--help","-v","--version")
  return (Test-FirstArgNotInList -First $First -Blocked $blocked)
}

function Should-Wrap-Gemini {
  param([string]$First)
  $blocked = @("mcp","extensions","skills","hooks","-h","--help","-v","--version")
  return (Test-FirstArgNotInList -First $First -Blocked $blocked)
}

function Invoke-CtxOrPassthrough {
  param(
    [string]$Agent,
    [string]$Passthrough,
    [string[]]$Arguments
  )

  $runner = Get-CtxRunner
  if (-not $runner) {
    return (Invoke-NativeCommand -Name $Passthrough -Arguments $Arguments)
  }

  $workspace = Get-WorkspaceRoot
  if (-not $workspace) {
    return (Invoke-NativeCommand -Name $Passthrough -Arguments $Arguments)
  }

  if (-not (Should-Wrap-Workspace -Workspace $workspace)) {
    return (Invoke-NativeCommand -Name $Passthrough -Arguments $Arguments)
  }

  $project = if ($env:CTXDB_REPO_NAME) { $env:CTXDB_REPO_NAME } else { Split-Path -Leaf $workspace }
  $script:CTXDB_LAST_WORKSPACE = $workspace

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    return (Invoke-NativeCommand -Name $Passthrough -Arguments $Arguments)
  }

  $nodeArgs = @(
    $runner,
    "--workspace", $workspace,
    "--agent", $Agent,
    "--project", $project,
    "--"
  ) + $Arguments

  & node @nodeArgs
  return $LASTEXITCODE
}

function codex {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Args)

  $first = if ($Args.Count -gt 0) { $Args[0] } else { "" }
  if (-not (Should-Wrap-Codex -First $first)) {
    $code = Invoke-NativeCommand -Name "codex" -Arguments $Args
    $global:LASTEXITCODE = $code
    return
  }

  $code = Invoke-CtxOrPassthrough -Agent "codex-cli" -Passthrough "codex" -Arguments $Args
  $global:LASTEXITCODE = $code
}

function claude {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Args)

  $first = if ($Args.Count -gt 0) { $Args[0] } else { "" }
  if (-not (Should-Wrap-Claude -First $first)) {
    $code = Invoke-NativeCommand -Name "claude" -Arguments $Args
    $global:LASTEXITCODE = $code
    return
  }

  $code = Invoke-CtxOrPassthrough -Agent "claude-code" -Passthrough "claude" -Arguments $Args
  $global:LASTEXITCODE = $code
}

function gemini {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Args)

  $first = if ($Args.Count -gt 0) { $Args[0] } else { "" }
  if (-not (Should-Wrap-Gemini -First $first)) {
    $code = Invoke-NativeCommand -Name "gemini" -Arguments $Args
    $global:LASTEXITCODE = $code
    return
  }

  $code = Invoke-CtxOrPassthrough -Agent "gemini-cli" -Passthrough "gemini" -Arguments $Args
  $global:LASTEXITCODE = $code
}
