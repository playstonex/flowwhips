import { Alert, StyleSheet } from 'react-native';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, Input, Spinner } from 'heroui-native';
import type { AgentProcess, AgentType } from '@baton/shared';
import { useAgentStore } from '../../src/stores/agents';
import { useConnectionStore } from '../../src/stores/connection';
import { wsService } from '../../src/services/websocket';
import { apiFetch } from '../../src/services/api';
import { Colors, STATUS_COLORS } from '../../src/constants/theme';

const AGENT_OPTIONS: { type: AgentType; label: string; icon: string }[] = [
  { type: 'claude-code', label: 'Claude', icon: '\u{1F9E0}' },
  { type: 'codex', label: 'Codex', icon: '\u{1F422}' },
  { type: 'opencode', label: 'OpenCode', icon: '\u{1F527}' },
];

const STATUS_CHIP_COLOR: Record<string, 'success' | 'accent' | 'default' | 'warning' | 'danger'> = {
  running: 'success',
  thinking: 'accent',
  executing: 'default',
  waiting_input: 'warning',
  idle: 'default',
  stopped: 'danger',
  starting: 'default',
  error: 'danger',
};

export default function DashboardScreen() {
  const router = useRouter();
  const agents = useAgentStore((s) => s.agents);
  const setAgents = useAgentStore((s) => s.setAgents);
  const updateAgentStatus = useAgentStore((s) => s.updateAgentStatus);
  const addAgent = useAgentStore((s) => s.addAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const connected = useConnectionStore((s) => s.connected);
  const [projectPath, setProjectPath] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('claude-code');
  const [loading, setLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const list = await apiFetch<AgentProcess[]>('/api/agents');
      setAgents(list);
    } catch {
      // offline
    }
  }, [setAgents]);

  useEffect(() => {
    fetchAgents();
    const unsubList = wsService.on('agent_list', (msg) => {
      if (msg.type === 'agent_list') {
        setAgents(msg.agents.map((a) => ({ id: a.id, type: a.type as AgentProcess['type'], projectPath: a.projectPath, status: a.status as AgentProcess['status'], startedAt: '' })));
      }
    });
    const unsubStatus = wsService.on('status_update', (msg) => {
      if (msg.type === 'status_update' && 'status' in msg) updateAgentStatus(msg.sessionId, msg.status as AgentProcess['status']);
    });
    return () => { unsubList(); unsubStatus(); };
  }, [fetchAgents, setAgents, updateAgentStatus]);

  async function startAgent() {
    if (!projectPath.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ sessionId: string }>('/api/agents/start', { method: 'POST', body: JSON.stringify({ agentType, projectPath: projectPath.trim() }) });
      addAgent({ id: data.sessionId, type: agentType, projectPath: projectPath.trim(), status: 'running', startedAt: new Date().toISOString() });
      router.push(`/terminal/${data.sessionId}`);
    } catch (err) { Alert.alert('Error', `Failed: ${err}`); }
    finally { setLoading(false); }
  }

  async function stopAgent(id: string) {
    try { await apiFetch('/api/agents/' + id + '/stop', { method: 'POST' }); removeAgent(id); } catch { /* ignore */ }
  }

  const running = agents.filter((a) => a.status !== 'stopped').length;

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>Agents</Text>
            <Text style={styles.heroSubtitle}>
              <Text style={styles.heroStat}>{running}</Text> running{'  '}
              <Text style={styles.heroStat}>{agents.length}</Text> total
            </Text>
          </View>
          <View style={styles.connectionBadge}>
            <View style={[styles.connectionDot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
            <Text style={styles.connectionText}>{connected ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Agent Type</Text>
        <View style={styles.typeRow}>
          {AGENT_OPTIONS.map((opt) => {
            const active = agentType === opt.type;
            return (
              <Pressable
                key={opt.type}
                onPress={() => setAgentType(opt.type)}
                style={[styles.typePill, active && styles.typePillActive]}
              >
                <Text style={styles.typePillIcon}>{opt.icon}</Text>
                <Text style={[styles.typePillLabel, active && styles.typePillLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Project Path</Text>
        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="/path/to/project"
              value={projectPath}
              onChangeText={setProjectPath}
              onSubmitEditing={startAgent}
              variant="secondary"
            />
          </View>
          <Button
            variant="primary"
            size="md"
            onPress={startAgent}
            isDisabled={loading || !projectPath.trim() || !connected}
          >
            {loading ? <Spinner size="sm" color="#fff" /> : 'Launch'}
          </Button>
        </View>
      </View>

      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F680}'}</Text>
            <Text style={styles.emptyTitle}>No agents yet</Text>
            <Text style={styles.emptySubtitle}>
              Enter a project path above to launch your first agent
            </Text>
          </View>
        }
        renderItem={({ item: agent }) => {
          const statusColor = STATUS_COLORS[agent.status] ?? Colors.surface[400];
          const isActive = agent.status === 'running' || agent.status === 'thinking' || agent.status === 'executing';
          return (
            <Pressable
              onPress={() => agent.status !== 'stopped' && router.push(`/terminal/${agent.id}`)}
              style={({ pressed }) => [
                styles.agentCard,
                { borderLeftColor: statusColor },
                pressed && styles.agentCardPressed,
                agent.status === 'stopped' && styles.agentCardStopped,
              ]}
            >
              <View style={styles.agentCardContent}>
                <View style={styles.agentCardTop}>
                  <View style={styles.agentCardLeft}>
                    <View style={[styles.statusDotOuter, { borderColor: statusColor }]}>
                      {isActive && <View style={[styles.statusDotPulse, { backgroundColor: statusColor }]} />}
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    </View>
                    <View style={styles.agentInfo}>
                      <Text style={styles.agentName}>
                        {AGENT_OPTIONS.find((o) => o.type === agent.type)?.label ?? agent.type}
                      </Text>
                      <Text style={styles.agentPath} numberOfLines={1}>{agent.projectPath}</Text>
                    </View>
                  </View>
                  <View style={styles.agentCardRight}>
                    <View style={[styles.statusChip, { backgroundColor: statusColor + '18' }]}>
                      <Text style={[styles.statusChipText, { color: statusColor }]}>{agent.status}</Text>
                    </View>
                    {agent.status !== 'stopped' && (
                      <Pressable onPress={() => stopAgent(agent.id)} style={styles.stopButton}>
                        <Text style={styles.stopButtonText}>Stop</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const BG = '#09090b';
const CARD = '#111113';
const ELEVATED = '#1a1a1e';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#f4f4f5';
const TEXT_SECONDARY = '#a1a1aa';
const TEXT_MUTED = '#71717a';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  heroSection: {
    backgroundColor: CARD,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
  heroStat: {
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ELEVATED,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: ELEVATED,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 44,
  },
  typePillActive: {
    backgroundColor: '#3b82f618',
    borderColor: '#3b82f6',
  },
  typePillIcon: {
    fontSize: 14,
  },
  typePillLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  typePillLabelActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  emptySubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  agentCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  agentCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }] as any,
  },
  agentCardStopped: {
    opacity: 0.35,
  },
  agentCardContent: {
    padding: 14,
    paddingLeft: 16,
  },
  agentCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  statusDotPulse: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    opacity: 0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontWeight: '700',
    fontSize: 15,
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  agentPath: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontFamily: 'monospace',
    marginTop: 2,
    fontWeight: '500',
  },
  agentCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stopButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(239,68,68,0.12)',
    minHeight: 28,
    justifyContent: 'center',
  },
  stopButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f87171',
  },
});
