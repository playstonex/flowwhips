import { StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useState } from 'react';
import { Button, Input, Spinner } from 'heroui-native';
import { useConnectionStore } from '../../src/stores/connection';
import { wsService } from '../../src/services/websocket';
import { saveCredentials, clearCredentials } from '../../src/services/secure-storage';
import { useThemeStore, type ThemeMode } from '../../src/stores/theme';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: string; desc: string }[] = [
  { key: 'dark', label: 'Dark', icon: '\u{1F319}', desc: 'Always dark' },
  { key: 'light', label: 'Light', icon: '\u2600\uFE0F', desc: 'Always light' },
  { key: 'system', label: 'System', icon: '\u{1F4BB}', desc: 'Follow system' },
];

export default function SettingsScreen() {
  const mode = useConnectionStore((s) => s.mode);
  const setMode = useConnectionStore((s) => s.setMode);
  const relayUrl = useConnectionStore((s) => s.relayUrl);
  const hostId = useConnectionStore((s) => s.hostId);
  const localHttpUrl = useConnectionStore((s) => s.localHttpUrl);
  const localWsUrl = useConnectionStore((s) => s.localWsUrl);
  const connected = useConnectionStore((s) => s.connected);
  const setCredentials = useConnectionStore((s) => s.setCredentials);
  const setConnected = useConnectionStore((s) => s.setConnected);

  const themeMode = useThemeStore((s) => s.theme);
  const setThemeMode = useThemeStore((s) => s.setTheme);
  const c = useThemeColors();

  const [inputRelayUrl, setInputRelayUrl] = useState(relayUrl);
  const [inputPairingCode, setInputPairingCode] = useState('');
  const [inputLocalHttp, setInputLocalHttp] = useState(localHttpUrl);
  const [inputLocalWs, setInputLocalWs] = useState(localWsUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function pairAndConnect() {
    if (!inputRelayUrl.trim() || !inputPairingCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const gatewayUrl = inputRelayUrl
        .replace(/^wss?/, 'http')
        .replace(/:\d+/, ':3220');
      const res = await fetch(`${gatewayUrl}/api/v1/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputPairingCode.trim() }),
      });
      const data = (await res.json()) as {
        token?: string;
        hostId?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Pairing failed');
        return;
      }
      const config = {
        mode: 'remote' as const,
        relayUrl: inputRelayUrl.trim(),
        hostId: data.hostId,
        token: data.token,
      };
      setCredentials(config);
      await saveCredentials(config);
      wsService.configure(config);
      wsService.connect();
      setInputPairingCode('');
    } catch (err) {
      setError(`Connection failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function connectLocal() {
    if (!inputLocalHttp.trim()) return;
    setLoading(true);
    setError('');
    const config = {
      mode: 'local' as const,
      localHttpUrl: inputLocalHttp.trim(),
      localWsUrl:
        inputLocalWs.trim() ||
        inputLocalHttp.trim().replace(/^http/, 'ws').replace(/:\d+/, ':3211'),
    };
    setCredentials(config);
    await saveCredentials(config);
    wsService.configure(config);
    wsService.connect();
    setLoading(false);
  }

  async function disconnect() {
    wsService.disconnect();
    setConnected(false);
    await clearCredentials();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.pageTitle, { color: c.textPrimary }]}>Settings</Text>
        <Text style={[styles.pageSubtitle, { color: c.textTertiary }]}>
          Configure your connection to the daemon
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.textTertiary }]}>Theme</Text>
          <View style={styles.modeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setThemeMode(opt.key)}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: active ? '#3b82f610' : c.card,
                      borderColor: active ? '#3b82f6' : c.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.modeIconContainer,
                      { backgroundColor: c.elevated },
                    ]}
                  >
                    <Text style={styles.modeIcon}>{opt.icon}</Text>
                  </View>
                  <Text
                    style={[
                      styles.modeTitle,
                      { color: active ? '#3b82f6' : c.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={[styles.modeDesc, { color: c.textTertiary }]}>
                    {opt.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.textTertiary }]}>
            Connection Mode
          </Text>
          <View style={styles.modeRow}>
            {(['remote', 'local'] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: active ? '#3b82f610' : c.card,
                      borderColor: active ? '#3b82f6' : c.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.modeIconContainer,
                      { backgroundColor: c.elevated },
                    ]}
                  >
                    <Text style={styles.modeIcon}>
                      {m === 'remote' ? '\u{1F310}' : '\u{1F5A7}'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.modeTitle,
                      { color: active ? '#3b82f6' : c.textSecondary },
                    ]}
                  >
                    {m === 'remote' ? 'Remote' : 'Local'}
                  </Text>
                  <Text style={[styles.modeDesc, { color: c.textTertiary }]}>
                    {m === 'remote' ? 'Via relay server' : 'Same network'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />

        {mode === 'remote' ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.textTertiary }]}>
              Remote Connection
            </Text>
            <Text style={[styles.sectionDesc, { color: c.textTertiary }]}>
              Enter relay URL and 6-digit pairing code from the host machine
            </Text>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                Relay URL
              </Text>
              <Input
                placeholder="ws://192.168.1.100:3230"
                value={inputRelayUrl}
                onChangeText={setInputRelayUrl}
                autoCapitalize="none"
                autoCorrect={false}
                variant="secondary"
              />
              <Text style={[styles.fieldHint, { color: c.textTertiary }]}>
                WebSocket address of your relay server
              </Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                Pairing Code
              </Text>
              <Input
                placeholder="000000"
                value={inputPairingCode}
                onChangeText={setInputPairingCode}
                keyboardType="number-pad"
                maxLength={6}
                variant="secondary"
              />
              <Text style={[styles.fieldHint, { color: c.textTertiary }]}>
                6-digit code shown on the host terminal
              </Text>
            </View>
            <Pressable
              onPress={pairAndConnect}
              style={[
                styles.primaryButton,
                (loading ||
                  !inputRelayUrl.trim() ||
                  inputPairingCode.length < 6) &&
                  styles.primaryButtonDisabled,
              ]}
              disabled={
                loading ||
                !inputRelayUrl.trim() ||
                inputPairingCode.length < 6
              }
            >
              {loading ? (
                <Spinner size="sm" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Pair & Connect</Text>
              )}
            </Pressable>
            {connected && hostId ? (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>{'\u2705'}</Text>
                <View>
                  <Text style={styles.successTitle}>Connected</Text>
                  <Text style={styles.successText}>
                    Host: {hostId.slice(0, 8)}...
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.textTertiary }]}>
              Local Connection
            </Text>
            <Text style={[styles.sectionDesc, { color: c.textTertiary }]}>
              Connect directly to the daemon on the same network
            </Text>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                HTTP URL
              </Text>
              <Input
                placeholder="http://192.168.1.100:3210"
                value={inputLocalHttp}
                onChangeText={setInputLocalHttp}
                autoCapitalize="none"
                autoCorrect={false}
                variant="secondary"
              />
              <Text style={[styles.fieldHint, { color: c.textTertiary }]}>
                Daemon HTTP endpoint
              </Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                WebSocket URL
              </Text>
              <Input
                placeholder="Auto-derived from HTTP URL"
                value={inputLocalWs}
                onChangeText={setInputLocalWs}
                autoCapitalize="none"
                autoCorrect={false}
                variant="secondary"
              />
              <Text style={[styles.fieldHint, { color: c.textTertiary }]}>
                Leave empty to auto-derive
              </Text>
            </View>
            <Pressable
              onPress={connectLocal}
              style={[
                styles.primaryButton,
                (loading || !inputLocalHttp.trim()) &&
                  styles.primaryButtonDisabled,
              ]}
              disabled={loading || !inputLocalHttp.trim()}
            >
              {loading ? (
                <Spinner size="sm" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Connect</Text>
              )}
            </Pressable>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>{'\u26A0'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Connection Failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        ) : null}

        {connected && (
          <Pressable onPress={disconnect} style={styles.disconnectButton}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 4 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    minHeight: 100,
  },
  modeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  modeIcon: {
    fontSize: 20,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modeDesc: {
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  fieldHint: {
    fontSize: 11,
    marginLeft: 2,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  successIcon: {
    fontSize: 16,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ade80',
  },
  successText: {
    fontSize: 12,
    color: '#4ade80',
    opacity: 0.8,
    fontFamily: 'monospace',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginTop: 10,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f87171',
  },
  errorText: {
    fontSize: 12,
    color: '#f87171',
    opacity: 0.8,
    lineHeight: 16,
  },
  disconnectButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 10,
  },
  disconnectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f87171',
  },
});
