function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function buildCompatibilitySpec(source) {
  const agentsById = source?.agentsById && typeof source.agentsById === 'object'
    ? source.agentsById
    : {};
  const roleMap = source?.roleMap && typeof source.roleMap === 'object'
    ? source.roleMap
    : {};

  const agents = {};
  for (const agentId of Object.keys(agentsById).sort()) {
    const agent = agentsById[agentId];
    agents[agentId] = {
      name: agent.name,
      description: agent.description,
      tools: [...agent.tools],
      model: agent.model,
      role: agent.role,
      handoffTarget: agent.handoffTarget,
      systemPrompt: agent.systemPrompt,
    };
  }

  return {
    schemaVersion: 1,
    roleMap: {
      planner: roleMap.planner,
      implementer: roleMap.implementer,
      reviewer: roleMap.reviewer,
      'security-reviewer': roleMap['security-reviewer'],
    },
    agents,
  };
}

export function validateCompatibilityExport(spec, source) {
  assertCondition(spec && typeof spec === 'object' && !Array.isArray(spec), 'compatibility export must be an object');
  assertCondition(spec.schemaVersion === 1, 'compatibility export schemaVersion must be 1');

  const expectedRoleIds = ['planner', 'implementer', 'reviewer', 'security-reviewer'];
  for (const roleId of expectedRoleIds) {
    assertCondition(spec.roleMap?.[roleId], `compatibility export missing role: ${roleId}`);
  }

  const expectedAgentIds = Object.keys(source?.agentsById || {}).sort();
  const actualAgentIds = Object.keys(spec.agents || {}).sort();
  assertCondition(
    JSON.stringify(actualAgentIds) === JSON.stringify(expectedAgentIds),
    'compatibility export agent ids do not match canonical source'
  );

  return spec;
}

export function renderCompatibilityExport(source) {
  const spec = validateCompatibilityExport(buildCompatibilitySpec(source), source);
  return `${JSON.stringify(spec, null, 2)}\n`;
}
