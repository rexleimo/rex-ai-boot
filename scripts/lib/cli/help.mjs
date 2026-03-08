export function getRootHelpText() {
  return `AIOS unified entry (Node-first CLI + TUI)

Usage:
  node scripts/aios.mjs
  node scripts/aios.mjs <command> [options]

Commands:
  setup       Install AIOS integrations
  update      Update AIOS integrations
  uninstall   Remove selected AIOS integrations
  doctor      Verify AIOS installation and repo health

Examples:
  node scripts/aios.mjs setup --components all --mode opt-in --client all
  node scripts/aios.mjs update --components shell,skills --skip-doctor
  node scripts/aios.mjs uninstall --components shell,skills
  node scripts/aios.mjs doctor --strict
`;
}

export function getCommandHelpText(command) {
  switch (command) {
    case 'setup':
      return `Usage:
  node scripts/aios.mjs setup [options]

Options:
  --components <list>            Comma list: browser,shell,skills,superpowers (default: browser,shell,skills,superpowers)
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
  --components <list>            Comma list: browser,shell,skills,superpowers (default: browser,shell,skills,superpowers)
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
  --components <list>            Comma list: shell,skills,browser,superpowers (default: shell,skills)
  --client <all|codex|claude|gemini|opencode>
  -h, --help
`;
    case 'doctor':
      return `Usage:
  node scripts/aios.mjs doctor [options]

Options:
  --strict
  --global-security
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
