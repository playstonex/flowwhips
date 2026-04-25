import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, CardContent, Chip, Input } from '@heroui/react';
import type { AgentProcess, AgentType } from '@baton/shared';
import { SystemStats } from '../components/SystemStats.js';
import { wsService } from '../services/websocket.js';
import { useAgentStore } from '../stores/connection.js';

const AGENT_OPTIONS: {
  type: AgentType;
  label: string;
  desc: string;
  eyebrow: string;
  accent: string;
}[] = [
  {
    type: 'claude-code',
    label: 'Claude Code',
    desc: 'Deep reasoning for large code changes and reviews.',
    eyebrow: 'Flagship',
    accent: 'from-primary-500 to-primary-700',
  },
  {
    type: 'codex',
    label: 'Codex',
    desc: 'Fast execution loops for shipping product work quickly.',
    eyebrow: 'Fast lane',
    accent: 'from-cyan-500 to-primary-600',
  },
  {
    type: 'opencode',
    label: 'OpenCode',
    desc: 'Flexible open-source runtime for portable workflows.',
    eyebrow: 'Open stack',
    accent: 'from-amber-400 to-orange-500',
  },
] as const;

const STATUS_COLORS: Record<string, 'success' | 'accent' | 'default' | 'warning' | 'danger'> = {
  running: 'success',
  thinking: 'accent',
  executing: 'default',
  waiting_input: 'warning',
  idle: 'default',
  stopped: 'danger',
  starting: 'default',
  error: 'danger',
};

const STATUS_TONE: Record<string, string> = {
  running: 'bg-emerald-500',
  thinking: 'bg-primary-500',
  executing: 'bg-violet-500',
  waiting_input: 'bg-amber-500',
  idle: 'bg-surface-400',
  stopped: 'bg-rose-500',
  starting: 'bg-surface-400',
  error: 'bg-rose-500',
};

export function DashboardScreen() {
  const navigate = useNavigate();
  const agents = useAgentStore((s) => s.agents);
  const { addAgent, removeAgent, setAgents, updateAgentStatus } = useAgentStore();
  const [projectPath, setProjectPath] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('claude-code');
  const [loading, setLoading] = useState(false);
  const [daemonOnline, setDaemonOnline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/agents', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((list: AgentProcess[]) => {
        setAgents(list);
        setDaemonOnline(true);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setDaemonOnline(false);
      });

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

    const unsubState = wsService.on('_state', () => {
      setDaemonOnline(wsService.connected);
    });

    wsService.connect();

    return () => {
      controller.abort();
      unsubList();
      unsubStatus();
      unsubState();
    };
  }, [setAgents, updateAgentStatus]);

  async function startAgent() {
    if (!projectPath.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/agents/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, projectPath: projectPath.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to start agent: ${err.error ?? 'Unknown error'}`);
        return;
      }

      const data = await res.json();
      addAgent({
        id: data.sessionId,
        type: agentType,
        projectPath: projectPath.trim(),
        status: 'running',
        startedAt: new Date().toISOString(),
      });
      navigate(`/terminal/${data.sessionId}`);
    } catch (err) {
      alert(`Failed to connect to Daemon: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function stopAgent(id: string) {
    try {
      await fetch(`/api/agents/${id}/stop`, { method: 'POST' });
      removeAgent(id);
    } catch {
      // ignore
    }
  }

  const running = agents.filter((agent) => agent.status !== 'stopped').length;
  const thinking = agents.filter((agent) => agent.status === 'thinking').length;
  const waiting = agents.filter((agent) => agent.status === 'waiting_input').length;
  const selectedAgent =
    AGENT_OPTIONS.find((option) => option.type === agentType) ?? AGENT_OPTIONS[0];

  const metrics = useMemo(
    () => [
      {
        label: 'Running Sessions',
        value: running.toString().padStart(2, '0'),
        note: 'Live terminals under orchestration',
      },
      {
        label: 'Thinking Now',
        value: thinking.toString().padStart(2, '0'),
        note: 'Agents reasoning before execution',
      },
      {
        label: 'Waiting Input',
        value: waiting.toString().padStart(2, '0'),
        note: 'Agents paused for a decision',
      },
    ],
    [running, thinking, waiting],
  );

  return (
    <div className="space-y-8">
      <section className="ambient-grid relative overflow-hidden rounded-[32px] border border-white/60 bg-white/70 px-6 py-6 shadow-2xl shadow-surface-900/8 backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/72 dark:shadow-black/25 md:px-8 md:py-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-primary-500/18 via-transparent to-purple-500/18" />
        <div className="pointer-events-none absolute -left-16 top-12 h-48 w-48 rounded-full bg-primary-500/12 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-56 w-56 rounded-full bg-purple-500/12 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Chip size="sm" variant="soft" color="accent">
                Baton Control Plane
              </Chip>
              <Chip size="sm" variant="soft" color={daemonOnline ? 'success' : 'danger'}>
                {daemonOnline ? 'Daemon Online' : 'Daemon Offline'}
              </Chip>
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white md:text-5xl">
                Orchestrate agents from a dashboard that feels worthy of the work.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-surface-600 dark:text-surface-300 md:text-[15px]">
                Launch coding sessions, monitor live execution, and move between agents with a
                clearer visual hierarchy. This refresh shifts Baton from utilitarian to premium
                control room.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {metrics.map((metric, index) => (
                <Card
                  key={metric.label}
                  className={`glass-panel overflow-hidden rounded-[24px] transition-transform duration-300 hover:-translate-y-0.5 ${
                    index === 0 ? 'md:translate-y-4' : ''
                  }`}
                >
                  <CardContent className="space-y-3 px-5 py-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400 dark:text-surface-500">
                      {metric.label}
                    </div>
                    <div className="text-4xl font-semibold tracking-[-0.05em] text-surface-900 dark:text-white">
                      {metric.value}
                    </div>
                    <p className="text-xs leading-6 text-surface-500 dark:text-surface-400">
                      {metric.note}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="glass-panel rounded-[28px] border border-white/60 dark:border-white/10">
            <CardContent className="space-y-6 px-6 py-6">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-surface-400 dark:text-surface-500">
                  Focus
                </div>
                <div className="text-2xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white">
                  {selectedAgent.label}
                </div>
                <p className="text-sm leading-6 text-surface-500 dark:text-surface-400">
                  {selectedAgent.desc}
                </p>
              </div>

              <div className={`rounded-[24px] bg-gradient-to-br ${selectedAgent.accent} p-[1px]`}>
                <div className="rounded-[23px] bg-surface-950/92 px-5 py-5 text-white">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                    {selectedAgent.eyebrow}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-white/80">
                    Best for teams that want richer context, calmer monitoring, and more obvious
                    next actions.
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                        Coverage
                      </div>
                      <div className="mt-1 text-xl font-semibold tracking-[-0.04em]">
                        {agents.length || 0} active sessions
                      </div>
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                      {daemonOnline ? 'Ready to launch' : 'Reconnect daemon'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Total Agents" value={String(agents.length).padStart(2, '0')} />
                <MiniStat label="Online Rate" value={daemonOnline ? '100%' : '0%'} />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <SystemStats />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <Card className="glass-panel rounded-[28px]">
          <CardContent className="space-y-6 px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
                  Launch Studio
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white">
                  Start a new coding session
                </h2>
              </div>
              <Chip size="sm" variant="soft" color="accent">
                Guided launch
              </Chip>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {AGENT_OPTIONS.map((opt) => {
                const isActive = agentType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setAgentType(opt.type)}
                    className={`rounded-[24px] border p-4 text-left transition-all duration-200 ${
                      isActive
                        ? 'border-primary-400 bg-primary-50 shadow-lg shadow-primary-500/10 dark:border-primary-500 dark:bg-primary-950/40'
                        : 'border-surface-200/80 bg-white/70 hover:-translate-y-0.5 hover:border-surface-300 dark:border-surface-800 dark:bg-surface-900/60 dark:hover:border-surface-700'
                    }`}
                  >
                    <div
                      className={`inline-flex rounded-full bg-gradient-to-br ${opt.accent} px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white`}
                    >
                      {opt.eyebrow}
                    </div>
                    <div className="mt-4 text-base font-semibold text-surface-900 dark:text-white">
                      {opt.label}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-surface-500 dark:text-surface-400">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
                  Project Path
                </label>
                <Input
                  placeholder="/Volumes/y/lei/Projects/FlowWhips"
                  value={projectPath}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setProjectPath(e.target.value)
                  }
                  onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && startAgent()}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  isDisabled={loading || !projectPath.trim() || !daemonOnline}
                  onPress={startAgent}
                  className="h-12 min-w-[180px] px-6"
                >
                  {loading ? 'Starting...' : `Launch ${selectedAgent.label}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel rounded-[28px]">
          <CardContent className="space-y-5 px-6 py-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
              Launch Advice
            </div>
            <div className="space-y-4">
              <InsightRow
                title="Pick by tempo"
                body="Use Claude Code for deep changes, Codex for fast iteration, and OpenCode for portable stacks."
              />
              <InsightRow
                title="Path hygiene"
                body="Point each session to a clean project root so file watching and worktree operations stay predictable."
              />
              <InsightRow
                title="Session focus"
                body="Keep one agent per objective to make timeline events and terminal state much easier to scan."
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
              Session Fleet
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white">
              Active agents
            </h2>
          </div>
          <div className="ml-auto rounded-full border border-surface-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-surface-500 dark:border-surface-800 dark:bg-surface-900/60 dark:text-surface-400">
            {agents.length} total
          </div>
        </div>

        {agents.length === 0 ? (
          <Card className="glass-panel rounded-[28px] border border-dashed border-surface-300/80 dark:border-surface-800">
            <CardContent className="flex flex-col items-center py-20 text-center">
              <div className="rounded-full bg-gradient-to-br from-primary-500 to-purple-500 p-[1px]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-surface-950">
                  <span className="text-3xl">⌘</span>
                </div>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-surface-900 dark:text-white">
                No sessions in flight
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-surface-500 dark:text-surface-400">
                Start from the launch studio above to turn this into a live operations view.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => navigate(`/terminal/${agent.id}`)}
                onStop={() => stopAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-surface-200/80 bg-white/70 px-4 py-3 dark:border-surface-800 dark:bg-surface-900/60">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-400 dark:text-surface-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function InsightRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-surface-200/80 bg-white/65 px-4 py-4 dark:border-surface-800 dark:bg-surface-900/60">
      <div className="text-sm font-semibold text-surface-900 dark:text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-surface-500 dark:text-surface-400">{body}</p>
    </div>
  );
}

function AgentCard({
  agent,
  onOpen,
  onStop,
}: {
  agent: AgentProcess;
  onOpen: () => void;
  onStop: () => void;
}) {
  const isStopped = agent.status === 'stopped';
  const isActive =
    agent.status === 'running' || agent.status === 'thinking' || agent.status === 'executing';
  const label = AGENT_OPTIONS.find((option) => option.type === agent.type)?.label ?? agent.type;

  return (
    <Card
      className={`glass-panel rounded-[26px] transition-all duration-200 ${
        isStopped
          ? 'opacity-55'
          : 'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-surface-900/10 dark:hover:shadow-black/20'
      }`}
    >
      <CardContent className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <div className="relative">
            {isActive && (
              <span
                className={`absolute inset-0 rounded-full opacity-35 blur-sm ${STATUS_TONE[agent.status] ?? 'bg-surface-400'}`}
              />
            )}
            <span
              className={`relative block h-3.5 w-3.5 rounded-full ${STATUS_TONE[agent.status] ?? 'bg-surface-400'}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-surface-900 dark:text-white">
                {label}
              </span>
              <Chip size="sm" variant="soft" color={STATUS_COLORS[agent.status] ?? 'default'}>
                {agent.status.replace('_', ' ')}
              </Chip>
            </div>
            <div className="mt-1 truncate font-mono text-xs text-surface-500 dark:text-surface-400">
              {agent.projectPath}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-surface-200/80 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-surface-500 dark:border-surface-800 dark:bg-surface-900/60 dark:text-surface-400">
            {agent.startedAt ? new Date(agent.startedAt).toLocaleTimeString() : 'Pending'}
          </div>
          {!isStopped && (
            <Button size="sm" variant="danger-soft" onPress={onStop}>
              Stop
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
