import { useState, type ReactNode } from 'react';
import { Button, Input } from '@heroui/react';
import { wsService, type ConnectionMode } from '../services/websocket.js';

const CONNECTION_MODES = [
  {
    key: 'local' as const,
    label: 'Local',
    title: 'Direct daemon access',
    body: 'Best on the same network when you want the fastest response and the least moving parts.',
  },
  {
    key: 'remote' as const,
    label: 'Remote',
    title: 'Relay-backed access',
    body: 'Use pairing and relay routing to reach your host securely from anywhere.',
  },
] as const;

export function SettingsScreen() {
  const [mode, setMode] = useState<ConnectionMode>(wsService.mode);
  const [localHttpUrl, setLocalHttpUrl] = useState(`http://${window.location.hostname}:3210`);
  const [relayUrl, setRelayUrl] = useState('');
  const [hostId, setHostId] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [status, setStatus] = useState('');

  function applyLocal() {
    const hostname = new URL(localHttpUrl).hostname;
    wsService.configure({
      mode: 'local',
      localWsUrl: `ws://${hostname}:3211`,
      localHttpUrl,
    });
    wsService.disconnect();
    wsService.connect();
    setMode('local');
    setStatus('Connecting to local daemon...');
  }

  async function applyRemote() {
    if (pairingCode && !hostId) {
      try {
        const gatewayUrl = `${relayUrl.replace('ws', 'http')}`.replace(/:\d+/, ':3220');
        const res = await fetch(`${gatewayUrl}/api/v1/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: pairingCode }),
        });

        if (!res.ok) {
          setStatus('Invalid pairing code');
          return;
        }

        const data = await res.json();
        setHostId(data.hostId);
        wsService.configure({
          mode: 'remote',
          relayUrl,
          hostId: data.hostId,
          token: data.token,
        });
        wsService.disconnect();
        wsService.connect();
        setMode('remote');
        setStatus('Connected to relay!');
      } catch {
        setStatus('Failed to connect to gateway');
      }
      return;
    }

    if (hostId) {
      wsService.configure({ mode: 'remote', relayUrl, hostId });
      wsService.disconnect();
      wsService.connect();
      setMode('remote');
      setStatus('Reconnecting...');
    }
  }

  const isSuccess = status.includes('Connected') || status.includes('Connecting');

  return (
    <div className="space-y-8">
      <section className="ambient-grid relative overflow-hidden rounded-[32px] border border-white/60 bg-white/72 px-6 py-6 shadow-2xl shadow-surface-900/8 backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/72 dark:shadow-black/25 md:px-8 md:py-8">
        <div className="pointer-events-none absolute -left-20 top-8 h-48 w-48 rounded-full bg-primary-500/12 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-primary-200/80 bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-700 dark:border-primary-800/70 dark:bg-primary-950/40 dark:text-primary-300">
              Connection Control
            </div>
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white">
                Tune the way Baton reaches every agent.
              </h1>
              <p className="mt-3 text-sm leading-7 text-surface-600 dark:text-surface-300">
                The settings experience now reads like a product control room: clearer transport
                choices, stronger grouping, and better signal when pairing succeeds or fails.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] bg-surface-950 px-6 py-6 text-white shadow-xl shadow-surface-950/30">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
              Current Mode
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              {mode === 'local' ? 'Local Network' : 'Remote Relay'}
            </div>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {mode === 'local'
                ? 'Direct HTTP and WebSocket connectivity for the lowest latency setup.'
                : 'Relay and pairing flow for secure access outside the local environment.'}
            </p>
            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                Protocol Stack
              </div>
              <div className="mt-2 text-sm text-white/75">
                HTTP 3210, WebSocket 3211, relay routing, and NaCl encryption support.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]">
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            {CONNECTION_MODES.map((item) => {
              const active = mode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMode(item.key)}
                  className={`rounded-[26px] border p-5 text-left transition-all duration-200 ${
                    active
                      ? 'border-primary-400 bg-primary-50 shadow-lg shadow-primary-500/10 dark:border-primary-500 dark:bg-primary-950/40'
                      : 'glass-panel'
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
                    {item.label}
                  </div>
                  <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-surface-900 dark:text-white">
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-surface-500 dark:text-surface-400">
                    {item.body}
                  </p>
                </button>
              );
            })}
          </div>

          {mode === 'local' ? (
            <div className="glass-panel rounded-[28px] px-6 py-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
                Local Connection
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white">
                Point Baton at the daemon
              </div>
              <div className="mt-5 space-y-4">
                <FieldBlock
                  label="Daemon HTTP URL"
                  hint="The HTTP endpoint where your Baton daemon is listening."
                >
                  <Input
                    value={localHttpUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLocalHttpUrl(e.target.value)
                    }
                    className="font-mono text-sm"
                  />
                </FieldBlock>
                <Button variant="primary" onPress={applyLocal} className="h-12 w-full">
                  Connect to Local Daemon
                </Button>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-[28px] px-6 py-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
                Remote Pairing
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-surface-900 dark:text-white">
                Pair through the relay
              </div>
              <div className="mt-5 space-y-4">
                <FieldBlock
                  label="Relay WebSocket URL"
                  hint="The public WebSocket address of your Baton relay server."
                >
                  <Input
                    placeholder="ws://relay.example.com:3230"
                    value={relayUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRelayUrl(e.target.value)
                    }
                    className="font-mono text-sm"
                  />
                </FieldBlock>

                <FieldBlock
                  label="Pairing Code"
                  hint="Use the 6-digit code displayed by the host daemon."
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="000000"
                        value={pairingCode}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPairingCode(e.target.value)
                        }
                        className="font-mono text-center text-sm tracking-[0.4em]"
                        maxLength={6}
                      />
                    </div>
                    <Button variant="primary" onPress={applyRemote} className="h-12 px-5">
                      Pair & Connect
                    </Button>
                  </div>
                </FieldBlock>

                {hostId && (
                  <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/70 dark:bg-emerald-950/25">
                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      Paired host
                    </div>
                    <div className="mt-1 font-mono text-xs text-emerald-700/80 dark:text-emerald-400/85">
                      {hostId.slice(0, 8)}...
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {status && (
            <div
              className={`rounded-[24px] border px-4 py-4 ${
                isSuccess
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:text-emerald-400'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/25 dark:text-rose-400'
              }`}
            >
              <div className="text-sm font-semibold">
                {isSuccess ? 'Connection Status' : 'Action Required'}
              </div>
              <div className="mt-1 text-sm opacity-90">{status}</div>
            </div>
          )}
        </div>

        <aside className="glass-panel rounded-[28px] px-6 py-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
            Environment
          </div>
          <div className="mt-4 space-y-4">
            <InfoRow label="Application" value="Baton" />
            <InfoRow label="Version" value="0.1.0" />
            <InfoRow label="Transport" value="WebSocket + HTTP" />
            <InfoRow label="Encryption" value="NaCl box" />
          </div>
        </aside>
      </section>
    </div>
  );
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400 dark:text-surface-500">
        {label}
      </label>
      {children}
      <p className="text-xs leading-6 text-surface-500 dark:text-surface-400">{hint}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-surface-200/80 bg-white/70 px-4 py-4 dark:border-surface-800 dark:bg-surface-900/60">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-400 dark:text-surface-500">
        {label}
      </div>
      <div className="mt-2 font-mono text-sm text-surface-700 dark:text-surface-200">{value}</div>
    </div>
  );
}
