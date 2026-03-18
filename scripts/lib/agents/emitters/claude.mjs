import { renderManagedAgentContent } from './shared.mjs';

export function renderClaudeAgent(agent) {
  return {
    targetRelPath: `.claude/agents/${agent.name}.md`,
    content: renderManagedAgentContent(agent),
  };
}
