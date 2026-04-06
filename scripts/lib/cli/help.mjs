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
  team          One-click multi-client live team runtime (codex/claude/gemini)
  hud           Show ContextDB + dispatch HUD (CLI/TUI)
  learn-eval    Turn checkpoint telemetry into operator recommendations
  entropy-gc    Auto-archive stale ContextDB artifacts with rollback manifests

Examples:
  node scripts/aios.mjs setup --components all --mode opt-in --client all
  node scripts/aios.mjs update --components shell,skills,native --skip-doctor
  node scripts/aios.mjs uninstall --components shell,skills,native
  node scripts/aios.mjs doctor --strict --native --verbose --profile standard
  node scripts/aios.mjs doctor --native --fix --dry-run
  node scripts/aios.mjs internal native repair list --limit 20
  node scripts/aios.mjs internal native repair show --repair-id latest
  node scripts/aios.mjs internal native rollback --repair-id latest
  node scripts/aios.mjs memo add "note #tag"
  node scripts/aios.mjs quality-gate pre-pr --profile strict
  node scripts/aios.mjs orchestrate feature --task "Ship orchestrator blueprints"
  node scripts/aios.mjs team 3:codex "Ship orchestrator blueprints"
  node scripts/aios.mjs team 2:claude --session codex-cli-20260303T080437-065e16c0 --dry-run
  node scripts/aios.mjs hud --provider codex
  node scripts/aios.mjs hud --watch --preset focused
  node scripts/aios.mjs team status --provider codex --watch
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
  --components <list>            Comma list: browser,shell,skills,native,agents,superpowers (default: browser,shell,skills,native,superpowers)
  --mode <all|repo-only|opt-in|off>
  --client <all|codex|claude|gemini|opencode>
  --scope <global|project>       Skills install scope (default: global)
  --install-mode <copy|link>     Skills install mode (default: copy)
  --skills <list>                Comma list of skill names to install
  --skip-playwright-install
  --skip-doctor
  -h, --help
`;
    case 'update':
      return `Usage:
  node scripts/aios.mjs update [options]

Options:
  --components <list>            Comma list: browser,shell,skills,native,agents,superpowers (default: browser,shell,skills,native,superpowers)
  --mode <all|repo-only|opt-in|off>
  --client <all|codex|claude|gemini|opencode>
  --scope <global|project>       Skills install scope (default: global)
  --install-mode <copy|link>     Skills install mode (default: copy)
  --skills <list>                Comma list of skill names to install
  --with-playwright-install
  --skip-doctor
  -h, --help
`;
    case 'uninstall':
      return `Usage:
  node scripts/aios.mjs uninstall [options]

Options:
  --components <list>            Comma list: shell,skills,native,agents,browser,superpowers (default: shell,skills)
  --client <all|codex|claude|gemini|opencode>
  --scope <global|project>       Skills uninstall scope (default: global)
  --skills <list>                Comma list of skill names to uninstall
  -h, --help
`;
    case 'doctor':
      return `Usage:
  node scripts/aios.mjs doctor [options]

Options:
  --strict
  --global-security
  --native
  --verbose
  --fix
  --dry-run
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
  --execute <none|dry-run|live> Execute dispatch through the selected runtime (defaults to dry-run; live is opt-in via AIOS_EXECUTE_LIVE=1 + AIOS_SUBAGENT_CLIENT=<codex-cli|claude-code|gemini-cli>)
  --preflight <none|auto>       Run supported local gate/runbook actions before final DAG selection
  --format <text|json>
  -h, --help
`;
    case 'team':
      return `Usage:
  node scripts/aios.mjs team [<workers:provider>] [task] [options]
  node scripts/aios.mjs team status [options]
  node scripts/aios.mjs team history [options]

Examples:
  node scripts/aios.mjs team 3:codex "Ship X"
  node scripts/aios.mjs team 2:claude --session <id>
  node scripts/aios.mjs team --resume <id> --retry-blocked --provider codex --workers 2
  node scripts/aios.mjs team --provider gemini --workers 2 --task "Refactor Y" --dry-run
  node scripts/aios.mjs team status --provider codex --watch
  node scripts/aios.mjs team history --provider claude --limit 10

Options:
  --workers <n>                 Team worker concurrency (default: 3)
  --provider <codex|claude|gemini>
  --blueprint <feature|bugfix|refactor|security>
  --task <title>
  --context <summary>
  --session <id>
  --resume <id>                 Resume from a prior orchestration session
  --limit <n>
  --recommendation <targetId>
  --preflight <none|auto>
  --retry-blocked               Replay only blocked jobs from latest dispatch artifact in the session
  --force                       Allow live --retry-blocked even when dispatch hindsight is unstable
  --format <text|json>
  --dry-run                     Local dispatch dry-run (no model calls)
  --live                        Force live execution (default)
  --watch                       (team status) Refresh display on an interval (TTY-only)
  --json                        (team status/history) Output structured JSON instead of text
  --concurrency <n>             (team history) Process sessions concurrently (default: 4)
  --fast                        (team history) Skip dispatch hindsight evaluation for faster scans
  --fast                        (team status/hud) In --watch + minimal preset, skip heavy reads and throttle state refresh to ~1s
  --since <iso>                 (team history) Only include sessions updated at/after ISO timestamp
  --status <value>              (team history) Only include sessions with matching meta.status
  --preset <minimal|focused|full> (team status) Rendering preset (default: focused; with --watch defaults to minimal unless --preset provided)
  --interval-ms <n>             (team status) Watch refresh interval in ms (default: 1000)
  -h, --help
`;
    case 'hud':
      return `Usage:
  node scripts/aios.mjs hud [options]

Options:
  --session <id>                Explicit ContextDB session id
  --provider <codex|claude|gemini>
  --preset <minimal|focused|full> Rendering preset (default: focused; with --watch defaults to minimal unless --preset provided)
  --watch                       Refresh display on an interval (TTY-only)
  --fast                        In --watch + minimal preset, skip heavy reads and throttle state refresh to ~1s
  --interval-ms <n>             Watch refresh interval in ms (default: 1000)
  --json                        Output structured JSON instead of text
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
  node scripts/aios.mjs internal skills ${action} [--client <all|codex|claude|gemini|opencode>] [--scope <global|project>] [--install-mode <copy|link>] [--skills <list>] [--force]
`;
  }

  if (target === 'skills' && (action === 'uninstall' || action === 'doctor')) {
    return `Usage:
  node scripts/aios.mjs internal skills ${action} [--client <all|codex|claude|gemini|opencode>] [--scope <global|project>] [--skills <list>]
`;
  }

  if (target === 'native' && (action === 'install' || action === 'update' || action === 'uninstall')) {
    return `Usage:
  node scripts/aios.mjs internal native ${action} [--client <all|codex|claude|gemini|opencode>]
`;
  }

  if (target === 'native' && action === 'doctor') {
    return `Usage:
  node scripts/aios.mjs internal native doctor [--client <all|codex|claude|gemini|opencode>] [--verbose] [--fix] [--dry-run]
`;
  }

  if (target === 'native' && action === 'repair') {
    return `Usage:
  node scripts/aios.mjs internal native repair [list|show] [--repair-id <id|latest>] [--limit <n>]
`;
  }

  if (target === 'native' && action === 'rollback') {
    return `Usage:
  node scripts/aios.mjs internal native rollback [--repair-id <id|latest>] [--dry-run]
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
