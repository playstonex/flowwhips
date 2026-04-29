import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import type { ThemeColors } from './TypingIndicator';
import { TypingIndicator } from './TypingIndicator';
import { humanizeCommand } from './CommandHumanizer';

interface Props {
  command: string;
  output?: string;
  exitCode?: number;
  isStreaming?: boolean;
  colors: ThemeColors;
}

export function CommandExecCard({ command, output, exitCode, isStreaming, colors }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const hasOutput = output && output.trim().length > 0;

  if (!command && !hasOutput && exitCode == null) return null;

  const display = humanizeCommand(command, isStreaming ?? false);
  const isFailed = exitCode != null && exitCode !== 0;
  const statusLabel = isStreaming ? 'running' : isFailed ? 'failed' : 'completed';

  return (
    <View style={styles.container}>
      <View style={[styles.row, { backgroundColor: colors.subtle }]}>
        <Text style={[styles.verb, { color: colors.textSecondary }]} numberOfLines={1}>
          {display.verb}
          <Text style={[styles.target, { color: colors.textTertiary }]}>
            {' '}
            {display.target}
          </Text>
        </Text>
        <Text
          style={[
            styles.statusLabel,
            { color: isFailed ? '#F04545' : colors.textTertiary },
          ]}
        >
          {statusLabel}
        </Text>
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
      </View>
      {expanded && command && (
        <View style={[styles.rawRow, { backgroundColor: colors.subtle }]}>
          <Text style={styles.rawLabel}>Command</Text>
          <Text style={[styles.rawCommand, { color: colors.textPrimary }]}>
            {command}
          </Text>
        </View>
      )}
      {hasOutput && (
        <Pressable onPress={toggle}>
          <Text
            style={[styles.output, { color: colors.textTertiary }]}
            numberOfLines={expanded ? undefined : 5}
          >
            {output}
          </Text>
          {!expanded && output.length > 300 && (
            <Text style={[styles.more, { color: colors.textTertiary }]}>
              Show more
            </Text>
          )}
        </Pressable>
      )}
      {isStreaming && <TypingIndicator colors={colors} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  verb: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  target: {
    fontWeight: '400',
  },
  statusLabel: {
    fontSize: 12,
    marginLeft: 8,
  },
  chevron: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    opacity: 0.4,
  },
  rawRow: {
    borderRadius: 6,
    padding: 8,
    gap: 2,
  },
  rawLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#21C45E',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rawCommand: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  output: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  more: {
    fontSize: 11,
    paddingHorizontal: 8,
    marginTop: 2,
  },
});
