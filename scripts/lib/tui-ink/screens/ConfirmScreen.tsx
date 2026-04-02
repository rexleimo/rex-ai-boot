// scripts/lib/tui-ink/screens/ConfirmScreen.tsx

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Box, Text } from 'ink';
import { ConfirmInput } from '@inkjs/ui';
import { Header } from '../components/Header';
import type { Action, AllOptions } from '../types';

interface ConfirmScreenProps {
  rootDir: string;
  options: AllOptions;
  onRun: (action: Action, actionOptions: unknown) => Promise<void>;
}

function formatComponents(components: Record<string, boolean>): string {
  return Object.entries(components)
    .filter(([, selected]) => selected)
    .map(([name]) => name)
    .join(', ') || '<none>';
}

function formatSkills(skills: string[]): string {
  return skills.length <= 3
    ? skills.join(', ') || '<none>'
    : `${skills.length} selected`;
}

export function ConfirmScreen({ rootDir, options, onRun }: ConfirmScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action') as Action | null;

  const [status, setStatus] = useState<'confirming' | 'running' | 'done' | 'error'>('confirming');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!action) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: missing action parameter</Text>
      </Box>
    );
  }

  const actionOptions = options[action];

  const handleConfirm = async () => {
    setStatus('running');
    try {
      await onRun(action, actionOptions);
      setStatus('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  const handleCancel = () => {
    navigate(`/${action}`);
  };

  const handleBack = () => {
    navigate('/');
  };

  if (status === 'running') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header rootDir={rootDir} />
        <Text>Running {action}...</Text>
      </Box>
    );
  }

  if (status === 'done') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header rootDir={rootDir} />
        <Text color="green" bold>{action} completed successfully</Text>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to return to main menu</Text>
        </Box>
        <ConfirmInput
          onConfirm={handleBack}
          onCancel={handleBack}
        />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header rootDir={rootDir} />
        <Text color="red" bold>{action} failed</Text>
        <Text color="red">{errorMessage}</Text>
        <Box marginTop={1}>
          <ConfirmInput
            onConfirm={handleBack}
            onCancel={handleCancel}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header rootDir={rootDir} />
      <Text bold>Confirm {action}</Text>
      <Box flexDirection="column" marginY={1}>
        {actionOptions && 'components' in actionOptions && (
          <Text>Selected components: {formatComponents(actionOptions.components as Record<string, boolean>)}</Text>
        )}
        {actionOptions && 'wrapMode' in actionOptions && (
          <Text>Mode: {actionOptions.wrapMode}</Text>
        )}
        {actionOptions && 'client' in actionOptions && (
          <Text>Client: {actionOptions.client}</Text>
        )}
        {actionOptions && 'scope' in actionOptions && (
          <Text>Scope: {actionOptions.scope}</Text>
        )}
        {actionOptions && 'selectedSkills' in actionOptions && (
          <Text>Selected skills: {formatSkills(actionOptions.selectedSkills as string[])}</Text>
        )}
        {action === 'doctor' && (
          <>
            <Text>Strict: {options.doctor.strict ? 'true' : 'false'}</Text>
            <Text>Global security: {options.doctor.globalSecurity ? 'true' : 'false'}</Text>
          </>
        )}
      </Box>
      <Box marginTop={1}>
        <Text bold>Run {action}?</Text>
        <ConfirmInput
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </Box>
    </Box>
  );
}