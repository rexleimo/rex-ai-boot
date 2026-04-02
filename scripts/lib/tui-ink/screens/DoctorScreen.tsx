// scripts/lib/tui-ink/screens/DoctorScreen.tsx

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Box, Text, useInput } from 'ink';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Checkbox } from '../components/Checkbox';
import type { DoctorOptions } from '../types';

interface DoctorScreenProps {
  rootDir: string;
  options: DoctorOptions;
  onToggleStrict: () => void;
  onToggleGlobalSecurity: () => void;
  onRun: () => void;
}

export function DoctorScreen({
  rootDir,
  options,
  onToggleStrict,
  onToggleGlobalSecurity,
  onRun,
}: DoctorScreenProps) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(0);
  const maxCursor = 3;

  useInput(
    useCallback(
      (input, key) => {
        if (key.upArrow) {
          setCursor(prev => Math.max(0, prev - 1));
        } else if (key.downArrow) {
          setCursor(prev => Math.min(maxCursor, prev + 1));
        } else if (input === ' ' || key.rightArrow) {
          if (cursor === 0) {
            onToggleStrict();
          } else if (cursor === 1) {
            onToggleGlobalSecurity();
          }
        } else if (key.return) {
          if (cursor === 2) {
            onRun();
          } else if (cursor === 3) {
            navigate('/');
          }
        } else if (input === 'b' || input === 'B') {
          navigate('/');
        }
      },
      [cursor, onToggleStrict, onToggleGlobalSecurity, onRun, navigate]
    )
  );

  const renderActionItem = (label: string, idx: number) => (
    <Text color={cursor === idx ? 'cyan' : undefined} bold={cursor === idx}>
      {cursor === idx ? '▸ ' : '  '}{label}
    </Text>
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Header rootDir={rootDir} />
      <Text bold>Doctor configuration</Text>
      <Box flexDirection="column" marginY={1}>
        <Checkbox label="Strict" checked={options.strict} active={cursor === 0} />
        <Checkbox label="Global security scan" checked={options.globalSecurity} active={cursor === 1} />
        {renderActionItem('Run doctor', 2)}
        {renderActionItem('Back', 3)}
      </Box>
      <Footer />
    </Box>
  );
}