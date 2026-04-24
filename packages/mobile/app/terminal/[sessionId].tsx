import { StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useCallback, useState } from 'react';
import { Button, Chip } from 'heroui-native';
import { wsService } from '../../src/services/websocket';
import { STATUS_COLORS, Colors } from '../../src/constants/theme';
import { XtermWebView, type XtermWebViewRef } from '../../src/components/XtermWebView';

const BG = '#09090b';
const TOOLBAR_BG = '#111113';
const ELEVATED = '#1a1a1e';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#f4f4f5';
const TEXT_SECONDARY = '#a1a1aa';
const TEXT_MUTED = '#71717a';

export default function TerminalScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const xtermRef = useRef<XtermWebViewRef>(null);
  const [status, setStatus] = useState('running');
  const [xtermStatus, setXtermStatus] = useState<string>('loading...');
  const [wsConnected, setWsConnected] = useState(wsService.connected);

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (!sessionId) return;
      wsService.send({
        type: 'control',
        action: 'resize',
        sessionId,
        payload: { cols, rows },
      });
    },
    [sessionId],
  );

  useEffect(() => {
    if (!sessionId) return;

    const unsubOutput = wsService.on('terminal_output', (msg) => {
      if (msg.type === 'terminal_output' && msg.sessionId === sessionId) {
        xtermRef.current?.write(msg.data);
      }
    });

    const unsubStatus = wsService.on('status_update', (msg) => {
      if (msg.type === 'status_update' && msg.sessionId === sessionId && 'status' in msg) {
        setStatus(msg.status as string);
      }
    });

    const unsubState = wsService.on('_state', () => {
      setWsConnected(wsService.connected);
    });

    const unsubError = wsService.on('error', (msg) => {
      if ('message' in msg) {
        xtermRef.current?.write(`\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
      }
    });

    return () => {
      unsubOutput();
      unsubStatus();
      unsubState();
      unsubError();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !wsConnected) return;

    wsService.send({ type: 'control', action: 'attach_session', sessionId });

    return () => {
      wsService.send({ type: 'control', action: 'detach_session', sessionId });
    };
  }, [sessionId, wsConnected]);

  const handleInput = useCallback(
    (data: string) => {
      if (!sessionId || !wsService.connected) return;
      wsService.send({ type: 'terminal_input', sessionId, data });
    },
    [sessionId],
  );

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

  const statusColor = STATUS_COLORS[status] ?? Colors.surface[400];
  const isActive = status === 'running' || status === 'thinking' || status === 'executing';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.toolbar}>
        <View style={[styles.statusDotOuter, { borderColor: statusColor }]}>
          {isActive && <View style={[styles.statusDotPulse, { backgroundColor: statusColor }]} />}
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
        <Text style={styles.sessionId}>{sessionId?.slice(0, 8)}</Text>
        <View style={[styles.statusChip, { backgroundColor: statusColor + '18' }]}>
          <Text style={[styles.statusChipText, { color: statusColor }]}>{status}</Text>
        </View>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => router.push(`/agent/${sessionId}`)}
          style={styles.toolbarButton}
        >
          <Text style={styles.toolbarButtonText}>Events</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          style={styles.doneButton}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      <XtermWebView
        ref={xtermRef}
        onInput={handleInput}
        onResize={handleResize}
        onStatus={(loaded, error) => {
          setXtermStatus(loaded ? 'xterm loaded' : `xterm error: ${error}`);
        }}
      />

      {!wsConnected && (
        <View style={styles.disconnectBanner}>
          <View style={styles.disconnectBannerContent}>
            <Text style={styles.disconnectIcon}>{'\u{26A0}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.disconnectTitle}>Not Connected</Text>
              <Text style={styles.disconnectDesc}>
                Go to Settings and configure your daemon connection
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              style={styles.disconnectButton}
            >
              <Text style={styles.disconnectButtonText}>Settings</Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: TOOLBAR_BG,
    gap: 6,
    minHeight: 44,
  },
  statusDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  statusDotPulse: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    opacity: 0.3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  sessionId: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderCurve: 'continuous',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spacer: { flex: 1 },
  toolbarButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderCurve: 'continuous',
    minHeight: 32,
    justifyContent: 'center',
  },
  toolbarButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: ELEVATED,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 32,
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  disconnectBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  disconnectBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  disconnectIcon: {
    fontSize: 18,
  },
  disconnectTitle: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
  },
  disconnectDesc: {
    color: '#fca5a5',
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
  },
  disconnectButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(239,68,68,0.2)',
    minHeight: 32,
    justifyContent: 'center',
  },
  disconnectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f87171',
  },
});
