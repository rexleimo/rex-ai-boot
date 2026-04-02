// scripts/lib/tui-ink/screens/SkillPickerScreen.tsx

import { useNavigate, useSearchParams } from 'react-router';
import { Box, Text } from 'ink';
import { Header } from '../components/Header';
import { ScrollableSelect } from '../components/ScrollableSelect';
import type { CatalogSkill, Client, Scope, InstalledSkills, Action } from '../types';

interface SkillPickerScreenProps {
  rootDir: string;
  catalogSkills: CatalogSkill[];
  installedSkills: InstalledSkills;
  selectedSkills: string[];
  client: Client;
  scope: Scope;
  onSetSelectedSkills: (skills: string[]) => void;
}

function getVisibleSkills(
  catalogSkills: CatalogSkill[],
  client: Client,
  scope: Scope,
  installedSkills: InstalledSkills,
  isUninstall: boolean
): CatalogSkill[] {
  const installedSet = new Set(
    installedSkills[scope]?.[client] || []
  );

  return catalogSkills
    .filter(skill => client === 'all' || skill.clients.includes(client))
    .filter(skill => skill.scopes.includes(scope))
    .filter(skill => !isUninstall || installedSet.has(skill.name));
}

function getInstalledSet(
  installedSkills: InstalledSkills,
  client: Client,
  scope: Scope
): Set<string> {
  if (client === 'all') {
    const allInstalled = Object.values(installedSkills[scope] || {}).flat();
    return new Set(allInstalled);
  }
  return new Set(installedSkills[scope]?.[client] || []);
}

export function SkillPickerScreen({
  rootDir,
  catalogSkills,
  installedSkills,
  selectedSkills,
  client,
  scope,
  onSetSelectedSkills,
}: SkillPickerScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const owner = searchParams.get('owner') as Action | null;

  if (!owner) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: missing owner parameter</Text>
      </Box>
    );
  }

  const isUninstall = owner === 'uninstall';
  const visibleSkills = getVisibleSkills(catalogSkills, client, scope, installedSkills, isUninstall);
  const installedSet = getInstalledSet(installedSkills, client, scope);

  const items = visibleSkills.map(skill => ({
    name: skill.name,
    description: skill.description,
    installed: installedSet.has(skill.name),
    isCore: skill.defaultInstall?.global,
  }));

  const handleToggle = (name: string) => {
    const newSelected = selectedSkills.includes(name)
      ? selectedSkills.filter(s => s !== name)
      : [...selectedSkills, name];
    onSetSelectedSkills(newSelected);
  };

  const handleSelectAll = () => {
    onSetSelectedSkills(visibleSkills.map(s => s.name));
  };

  const handleClearAll = () => {
    onSetSelectedSkills([]);
  };

  const handleDone = () => {
    navigate(`/${owner}`);
  };

  const handleBack = () => {
    navigate(`/${owner}`);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header rootDir={rootDir} />
      <Text bold>Select skills for {owner}</Text>
      <Box flexDirection="column" marginY={1}>
        {visibleSkills.length === 0 && isUninstall ? (
          <Text dimColor>No installed skills for current scope/client</Text>
        ) : (
          <ScrollableSelect
            items={items}
            selected={selectedSkills}
            pageSize={6}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
            onDone={handleDone}
            onBack={handleBack}
          />
        )}
      </Box>
    </Box>
  );
}