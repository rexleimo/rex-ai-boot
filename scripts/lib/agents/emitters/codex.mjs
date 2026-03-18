import { renderManagedAgentContent } from './shared.mjs';

export function renderCodexAgent(agent) {
  return {
    targetRelPath: `.codex/agents/${agent.name}.md`,
    content: renderManagedAgentContent(agent),
  };
}
