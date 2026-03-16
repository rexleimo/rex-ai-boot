export function getRootHelpText() {
  return `AIOS unified entry (Node-first CLI + TUI)

Usage:
  node scripts/aios.mjs
  node scripts/aios.mjs <command> [options]

Commands:
  setup         Install AIOS integrations
  update        Update AIOS integrations
  uninstall     Remove selected AIOS integrations
  doctor        Verify AIOS installation and repo health
  memo          Workspace memo + pinned memory helpers
  quality-gate  Run repo quality checks with harness profiles
  orchestrate   Preview reusable subagent workflow blueprints
  learn-eval    Turn checkpoint telemetry into operator recommendations
  entropy-gc    Auto-archive stale ContextDB artifacts with rollback manifests

Examples:
  node scripts/aios.mjs setup --components all --mode opt-in --client all
  node scripts/aios.mjs update --components shell,skills --skip-doctor
  node scripts/aios.mjs uninstall --components shell,skills
  node scripts/aios.mjs doctor --strict --profile standard
  node scripts/aios.mjs memo add "note #tag"
  node scripts/aios.mjs quality-gate pre-pr --profile strict
  node scripts/aios.mjs orchestrate feature --task "Ship orchestrator blueprints"
  node scripts/aios.mjs orchestrate --session codex-cli-20260303T080437-065e16c0 --format json
  node scripts/aios.mjs learn-eval --limit 5
  node scripts/aios.mjs entropy-gc auto --session codex-cli-20260303T080437-065e16c0
`;
}

export function getCommandHelpText(command) {
  switch (command) {
    case 'setup':
      return `Usage:
  node scripts/aios.mjs setup [options]

Options:
  --components <list>            Comma list: browser,shell,skills,agents,superpowers (default: browser,shell,skills,agents,superpowers)
  --mode <all|repo-only|opt-in|off>
  --client <all|codex|claude|gemini|opencode>
  --skip-playwright-install
  --skip-doctor
  -h, --help
`;
    case 'update':
      return `Usage:
  node scripts/aios.mjs update [options]

Options:
  --components <list>            Comma list: browser,shell,skills,agents,superpowers (default: browser,shell,skills,agents,superpowers)
  --mode <all|repo-only|opt-in|off>
  --client <all|codex|claude|gemini|opencode>
  --with-playwright-install
  --skip-doctor
  -h, --help
`;
    case 'uninstall':
      return `Usage:
  node scripts/aios.mjs uninstall [options]

Options:
  --components <list>            Comma list: shell,skills,agents,browser,superpowers (default: shell,skills)
  --client <all|codex|claude|gemini|opencode>
  -h, --help
`;
    case 'doctor':
      return `Usage:
  node scripts/aios.mjs doctor [options]

Options:
  --strict
  --global-security
  --profile <minimal|standard|strict>
  -h, --help
`;
    case 'memo':
      return `Usage:
  node scripts/aios.mjs memo <subcommand> [options]

Subcommands:
  use <space>                         Set active workspace memory space
  space list                          List existing spaces
  add <text>                          Append memo event (supports #tag)
  list [--limit N]                    List recent memos (default: 20)
  search <query> [--limit N] [--semantic]
                                      Search memos in current space
  pin show                            Print pinned memory for current space
  pin set <text>                      Replace pinned memory for current space
  pin add <text>                      Append to pinned memory for current space

Environment:
  WORKSPACE_MEMORY_SPACE              Override active space for this run
`;
    case 'quality-gate':
      return `Usage:
  node scripts/aios.mjs quality-gate [quick|full|pre-pr] [options]

Options:
  --profile <minimal|standard|strict>
  --global-security
  --session <id>
  -h, --help
`;
    case 'orchestrate':
      return `Usage:
  node scripts/aios.mjs orchestrate [feature|bugfix|refactor|security] [options]
  node scripts/aios.mjs orchestrate --session <id> [options]

Options:
  --task <title>
  --context <summary>
  --session <id>                 Load structured learn-eval recommendations for this session
  --limit <n>                   Number of checkpoints to inspect when loading learn-eval
  --recommendation <targetId>   Pin a specific learn-eval recommendation to the overlay
  --dispatch <none|local>       Build a local dispatch skeleton (defaults to local when omitted)
  --execute <none|dry-run|live> Execute dispatch through the selected runtime (defaults to dry-run; live is opt-in via AIOS_EXECUTE_LIVE=1 + AIOS_SUBAGENT_CLIENT=codex-cli)
  --preflight <none|auto>       Run supported local gate/runbook actions before final DAG selection
  --format <text|json>
  -h, --help
`;
    case 'learn-eval':
      return `Usage:
  node scripts/aios.mjs learn-eval [options]

Options:
  --session <id>
  --limit <n>
  --format <text|json>
  -h, --help
`;
    case 'entropy-gc':
      return `Usage:
  node scripts/aios.mjs entropy-gc [dry-run|auto|off] [options]

Options:
  --session <id>                 Required session id to clean
  --retain <n>                   Keep latest n dispatch artifacts (default: 5)
  --min-age-hours <n>            Only archive files older than n hours (default: 24)
  --format <text|json>
  -h, --help
`;
    default:
      return getRootHelpText();
  }
}

export function getInternalHelpText(target, action) {
  if (target === 'shell' && (action === 'install' || action === 'update')) {
    return `Usage:
  node scripts/aios.mjs internal shell ${action} [--force] [--mode <all|repo-only|opt-in|off>] [--rc-file <path>]
`;
  }

  if (target === 'shell' && action === 'uninstall') {
    return `Usage:
  node scripts/aios.mjs internal shell uninstall [--rc-file <path>]
`;
  }

  if (target === 'shell' && action === 'doctor') {
    return `Usage:
  node scripts/aios.mjs internal shell doctor [--rc-file <path>]
`;
  }

  if (target === 'skills' && (action === 'install' || action === 'update')) {
    return `Usage:
  node scripts/aios.mjs internal skills ${action} [--client <all|codex|claude|gemini|opencode>] [--force]
`;
  }

  if (target === 'skills' && (action === 'uninstall' || action === 'doctor')) {
    return `Usage:
  node scripts/aios.mjs internal skills ${action} [--client <all|codex|claude|gemini|opencode>]
`;
  }

  if (target === 'superpowers' && action === 'install') {
    return `Usage:
  node scripts/aios.mjs internal superpowers install [--repo <url>] [--update] [--force]
`;
  }

  if (target === 'superpowers' && action === 'update') {
    return `Usage:
  node scripts/aios.mjs internal superpowers update [--repo <url>] [--force]
`;
  }

  if (target === 'superpowers' && action === 'doctor') {
    return `Usage:
  node scripts/aios.mjs internal superpowers doctor
`;
  }

  if (target === 'browser' && action === 'install') {
    return `Usage:
  node scripts/aios.mjs internal browser install [--dry-run] [--skip-playwright-install]
`;
  }

  if (target === 'browser' && action === 'doctor') {
    return `Usage:
  node scripts/aios.mjs internal browser doctor
`;
  }

  if (target === 'privacy' && action === 'install') {
    return `Usage:
  node scripts/aios.mjs internal privacy install [--enable] [--disable] [--mode <regex|ollama|hybrid>]
`;
  }

  return getRootHelpText();
}
