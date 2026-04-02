// scripts/lib/tui-ink/components/ScrollableSelect.tsx

import { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

interface ScrollableSelectItem {
  name: string;
  description?: string;
  installed?: boolean;
  isCore?: boolean;
}

interface ScrollableSelectProps {
  items: ScrollableSelectItem[];
  selected: string[];
  pageSize: number;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onDone: () => void;
  onBack: () => void;
}

export function ScrollableSelect({
  items,
  selected,
  pageSize,
  onToggle,
  onSelectAll,
  onClearAll,
  onDone,
  onBack,
}: ScrollableSelectProps) {
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Split items into core and optional groups
  const coreItems = items.filter(item => item.isCore);
  const optionalItems = items.filter(item => !item.isCore);
  const groupedItems = [...coreItems, ...optionalItems];

  const maxOffset = Math.max(0, groupedItems.length - pageSize);
  const totalItems = groupedItems.length;

  // Footer actions cursor positions
  const selectAllCursor = totalItems;
  const clearAllCursor = totalItems + 1;
  const doneCursor = totalItems + 2;
  const maxCursor = doneCursor;

  // Sync scroll offset with cursor
  useEffect(() => {
    let newOffset = scrollOffset;
    if (cursor < scrollOffset) {
      newOffset = cursor;
    } else if (cursor >= scrollOffset + pageSize) {
      newOffset = cursor - pageSize + 1;
    }
    newOffset = Math.max(0, Math.min(newOffset, maxOffset));
    if (newOffset !== scrollOffset) {
      setScrollOffset(newOffset);
    }
  }, [cursor, pageSize, maxOffset, scrollOffset]);

  useInput(
    useCallback(
      (input, key) => {
        if (key.upArrow) {
          setCursor(prev => Math.max(0, prev - 1));
        } else if (key.downArrow) {
          setCursor(prev => Math.min(maxCursor, prev + 1));
        } else if (key.return || input === ' ') {
          if (cursor === selectAllCursor) {
            onSelectAll();
          } else if (cursor === clearAllCursor) {
            onClearAll();
          } else if (cursor === doneCursor) {
            onDone();
          } else if (cursor < totalItems) {
            onToggle(groupedItems[cursor].name);
          }
        } else if (input === 'b' || input === 'B') {
          onBack();
        }
      },
      [cursor, selectAllCursor, clearAllCursor, doneCursor, totalItems, groupedItems, onSelectAll, onClearAll, onDone, onBack, onToggle]
    )
  );

  const visibleItems = groupedItems.slice(scrollOffset, scrollOffset + pageSize);
  const visibleCoreItems = visibleItems.filter(item => item.isCore);
  const visibleOptionalItems = visibleItems.filter(item => !item.isCore);

  const renderItem = (item: ScrollableSelectItem, globalIdx: number) => {
    const isActive = cursor === globalIdx;
    const isSelected = selected.includes(item.name);
    const prefix = isActive ? '▸ ' : '  ';
    const mark = isSelected ? '[x]' : '[ ]';
    let label = item.name;
    if (item.installed) {
      label += ' (installed)';
    }

    return (
      <Box flexDirection="column" key={item.name}>
        <Text color={isActive ? 'cyan' : undefined} bold={isActive}>
          {prefix}{mark} {label}
        </Text>
        {item.description && isActive && (
          <Text dimColor>
            {'      '}{item.description.slice(0, 56)}
          </Text>
        )}
      </Box>
    );
  };

  const renderFooterAction = (label: string, actionCursor: number) => {
    const isActive = cursor === actionCursor;
    return (
      <Text color={isActive ? 'cyan' : undefined} bold={isActive}>
        {isActive ? '▸ ' : '  '}{label}
      </Text>
    );
  };

  // Calculate the starting global index for optional items
  const optionalStartIdx = coreItems.length;

  return (
    <Box flexDirection="column">
      {coreItems.length > 0 && scrollOffset < coreItems.length && (
        <Box flexDirection="column">
          <Text color="yellow" bold>
            Core
          </Text>
          {visibleCoreItems.map((item, idx) => {
            const globalIdx = scrollOffset + idx;
            return renderItem(item, globalIdx);
          })}
        </Box>
      )}
      {optionalItems.length > 0 && (
        <Box flexDirection="column">
          <Text color="yellow" bold>
            Optional
          </Text>
          {visibleOptionalItems.map((item, idx) => {
            // Calculate global index for this optional item
            const visibleCoreCount = visibleCoreItems.length;
            const globalIdx = scrollOffset + visibleCoreCount + idx;
            return renderItem(item, globalIdx);
          })}
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Showing {scrollOffset + 1}-{Math.min(scrollOffset + pageSize, totalItems)} of {totalItems}
        </Text>
        {renderFooterAction('Select all', selectAllCursor)}
        {renderFooterAction('Clear all', clearAllCursor)}
        {renderFooterAction('Done', doneCursor)}
      </Box>
    </Box>
  );
}