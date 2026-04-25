import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { View, Text } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Input, Spinner } from 'heroui-native';
import type { AgentProcess, AgentType } from '@baton/shared';
import { apiFetch } from '../../src/services/api';
import { wsService } from '../../src/services/websocket';
import { useAgentStore } from '../../src/stores/agents';
import { useConnectionStore } from '../../src/stores/connection';
import { Colors, STATUS_COLORS } from '../../src/constants/theme';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const AGENT_OPTIONS: { type: AgentType; label: string; icon: string; caption: string }[] = [
  { type: 'claude-code', label: 'Claude', icon: '\u{1F9E0}', caption: 'Deep code work' },
  { type: 'codex', label: 'Codex', icon: '\u26A1', caption: 'Fast execution' },
  { type: 'opencode', label: 'OpenCode', icon: '\u{1F6E0}', caption: 'Open stack' },
];

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
  const c = useThemeColors();

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
        setAgents(
          msg.agents.map((agent) => ({
            id: agent.id,
            type: agent.type as AgentProcess['type'],
            projectPath: agent.projectPath,
            status: agent.status as AgentProcess['status'],
            startedAt: '',
          })),
        );
      }
    });
    const unsubStatus = wsService.on('status_update', (msg) => {
      if (msg.type === 'status_update' && 'status' in msg) {
        updateAgentStatus(msg.sessionId, msg.status as AgentProcess['status']);
      }
    });

    return () => {
      unsubList();
      unsubStatus();
    };
  }, [fetchAgents, setAgents, updateAgentStatus]);

  async function startAgent() {
    if (!projectPath.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ sessionId: string }>('/api/agents/start', {
        method: 'POST',
        body: JSON.stringify({ agentType, projectPath: projectPath.trim() }),
      });
      addAgent({
        id: data.sessionId,
        type: agentType,
        projectPath: projectPath.trim(),
        status: 'running',
        startedAt: new Date().toISOString(),
      });
      router.push(`/terminal/${data.sessionId}`);
    } catch (err) {
      Alert.alert('Error', `Failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function stopAgent(id: string) {
    try {
      await apiFetch(`/api/agents/${id}/stop`, { method: 'POST' });
      removeAgent(id);
    } catch {
      // ignore
    }
  }

  const running = agents.filter((agent) => agent.status !== 'stopped').length;
  const thinking = agents.filter((agent) => agent.status === 'thinking').length;
  const selectedAgent =
    AGENT_OPTIONS.find((option) => option.type === agentType) ?? AGENT_OPTIONS[0];
  const stats = useMemo(
    () => [
      { label: 'Running', value: String(running).padStart(2, '0') },
      { label: 'Thinking', value: String(thinking).padStart(2, '0') },
      { label: 'Fleet', value: String(agents.length).padStart(2, '0') },
    ],
    [agents.length, running, thinking],
  );

  return (
    <FlatList
      data={agents}
      keyExtractor={(item) => item.id}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.headerContent}>
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: c.card,
                borderColor: c.cardBorder,
                shadowColor: c.isDark ? '#000' : '#1d4ed8',
              },
            ]}
          >
            <View style={styles.heroGlowLeft} />
            <View
              style={[
                styles.heroGlowRight,
                { backgroundColor: c.isDark ? 'rgba(146,104,255,0.16)' : 'rgba(146,104,255,0.12)' },
              ]}
            />
            <View style={styles.heroTopRow}>
              <View>
                <Text style={[styles.eyebrow, { color: c.textAccent }]}>Baton Mobile</Text>
                <Text style={[styles.heroTitle, { color: c.textPrimary }]}>
                  Agent control, now with more presence.
                </Text>
                <Text style={[styles.heroSubtitle, { color: c.textSecondary }]}>
                  Launch sessions, monitor live state, and move through your agent fleet from a
                  cleaner mobile command surface.
                </Text>
              </View>
              <View
                style={[
                  styles.connectionPill,
                  {
                    backgroundColor: connected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    borderColor: connected ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.connectionDot,
                    { backgroundColor: connected ? Colors.success[500] : Colors.danger[500] },
                  ]}
                />
                <Text
                  style={[
                    styles.connectionText,
                    { color: connected ? Colors.success[500] : Colors.danger[500] },
                  ]}
                >
                  {connected ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  style={[
                    styles.metricCard,
                    { backgroundColor: c.elevated, borderColor: c.cardBorder },
                  ]}
                >
                  <Text style={[styles.metricValue, { color: c.textPrimary }]}>{stat.value}</Text>
                  <Text style={[styles.metricLabel, { color: c.textTertiary }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.launchCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
            <View style={styles.sectionTop}>
              <View>
                <Text style={[styles.sectionEyebrow, { color: c.textTertiary }]}>
                  Launch Studio
                </Text>
                <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
                  Start a new session
                </Text>
              </View>
              <View
                style={[
                  styles.focusBadge,
                  { backgroundColor: c.elevated, borderColor: c.cardBorder },
                ]}
              >
                <Text style={[styles.focusBadgeText, { color: c.textAccent }]}>
                  {selectedAgent.label}
                </Text>
              </View>
            </View>

            <View style={styles.agentOptionRow}>
              {AGENT_OPTIONS.map((option) => {
                const active = option.type === agentType;
                return (
                  <Pressable
                    key={option.type}
                    onPress={() => setAgentType(option.type)}
                    style={[
                      styles.agentOption,
                      {
                        backgroundColor: active ? 'rgba(52,124,255,0.14)' : c.elevated,
                        borderColor: active ? Colors.primary[500] : c.cardBorder,
                      },
                    ]}
                  >
                    <Text style={styles.agentOptionIcon}>{option.icon}</Text>
                    <Text
                      style={[
                        styles.agentOptionLabel,
                        { color: active ? c.textPrimary : c.textSecondary },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={[styles.agentOptionCaption, { color: c.textTertiary }]}>
                      {option.caption}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: c.textTertiary }]}>Project Path</Text>
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
              {loading ? <Spinner size="sm" color="#fff" /> : `Launch ${selectedAgent.label}`}
            </Button>
          </View>

          <View style={styles.fleetHeader}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: c.textTertiary }]}>Session Fleet</Text>
              <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Active agents</Text>
            </View>
            <View
              style={[styles.countPill, { backgroundColor: c.elevated, borderColor: c.cardBorder }]}
            >
              <Text style={[styles.countPillText, { color: c.textSecondary }]}>
                {agents.length}
              </Text>
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={styles.emptyIcon}>{'\u2728'}</Text>
          <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>No sessions yet</Text>
          <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
            Launch a project above to turn this screen into a live agent control board.
          </Text>
        </View>
      }
      renderItem={({ item: agent }) => (
        <AgentRow
          agent={agent}
          onOpen={() => agent.status !== 'stopped' && router.push(`/terminal/${agent.id}`)}
          onStop={() => stopAgent(agent.id)}
        />
      )}
    />
  );
}

function AgentRow({
  agent,
  onOpen,
  onStop,
}: {
  agent: AgentProcess;
  onOpen: () => void;
  onStop: () => void;
}) {
  const c = useThemeColors();
  const statusColor = STATUS_COLORS[agent.status] ?? Colors.surface[400];
  const isStopped = agent.status === 'stopped';
  const label = AGENT_OPTIONS.find((option) => option.type === agent.type)?.label ?? agent.type;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.agentRow,
        {
          backgroundColor: c.card,
          borderColor: c.cardBorder,
          opacity: isStopped ? 0.58 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={[styles.agentAccent, { backgroundColor: statusColor }]} />
      <View style={styles.agentBody}>
        <View style={styles.agentTopLine}>
          <View style={styles.agentTitleWrap}>
            <View style={[styles.agentDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.agentTitle, { color: c.textPrimary }]}>{label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {agent.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
        <Text style={[styles.agentPath, { color: c.textSecondary }]} numberOfLines={1}>
          {agent.projectPath}
        </Text>
        <View style={styles.agentFooter}>
          <Text style={[styles.agentTime, { color: c.textTertiary }]}>
            {agent.startedAt ? new Date(agent.startedAt).toLocaleTimeString() : 'Ready'}
          </Text>
          {!isStopped && (
            <Pressable
              onPress={onStop}
              style={[
                styles.stopButton,
                {
                  borderColor: `${Colors.danger[500]}30`,
                  backgroundColor: `${Colors.danger[500]}14`,
                },
              ]}
            >
              <Text style={[styles.stopButtonText, { color: Colors.danger[500] }]}>Stop</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 20,
    paddingBottom: 120,
    gap: 14,
  },
  headerContent: {
    gap: 16,
    marginBottom: 12,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 20,
    gap: 18,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
  heroGlowLeft: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(52,124,255,0.18)',
    top: -40,
    left: -24,
  },
  heroGlowRight: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 999,
    right: -28,
    bottom: -16,
  },
  heroTopRow: {
    gap: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
  },
  connectionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  launchCard: {
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  sectionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  focusBadge: {
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  focusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  agentOptionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  agentOption: {
    flex: 1,
    minHeight: 108,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 14,
    gap: 6,
    justifyContent: 'space-between',
  },
  agentOptionIcon: {
    fontSize: 20,
  },
  agentOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  agentOptionCaption: {
    fontSize: 11,
    lineHeight: 15,
  },
  inputSection: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fleetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countPill: {
    minWidth: 40,
    alignItems: 'center',
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 26,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  agentRow: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  agentAccent: {
    width: 4,
  },
  agentBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 10,
  },
  agentTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  agentTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  agentDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  agentTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  agentPath: {
    fontSize: 12,
    lineHeight: 18,
  },
  agentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  stopButton: {
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  stopButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
