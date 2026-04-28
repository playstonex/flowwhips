import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  FlatList,
  Pressable,
  View,
  Text,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { wsService } from '../../src/services/websocket';
import { useChatStore } from '../../src/stores/chat';
import { STATUS_COLORS } from '../../src/constants/theme';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const isRunning = (s: string) => s === 'running' || s === 'thinking' || s === 'executing';

const HEADER_HEIGHT = 48;

export default function ChatScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { messages, agentStatus, waitingApproval, addEvent, addUserMessage, setStatus, setWaitingApproval, clear } = useChatStore();
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  const attachSession = useCallback(() => {
    if (!sessionId) return;
    wsService.send({ type: 'control', action: 'attach_session', sessionId });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    clear();

    const unsubEvent = wsService.on('parsed_event', (msg) => {
      if (msg.type === 'parsed_event' && msg.sessionId === sessionId) {
        addEvent(msg.event);
      }
    });

    const unsubStatus = wsService.on('status_update', (msg) => {
      if (msg.type === 'status_update' && msg.sessionId === sessionId) {
        setStatus(msg.status as string);
      }
    });

    const unsubState = wsService.on('_state', () => {
      if (wsService.connected) attachSession();
    });

    const unsubModels = wsService.on('model_list', (msg) => {
      if (msg.type === 'model_list' && msg.sessionId === sessionId) {
        setModels(msg.models);
        if (msg.selected) setSelectedModel(msg.selected);
      }
    });

    if (wsService.connected) {
      attachSession();
      wsService.send({ type: 'model_list_request', sessionId });
    }

    return () => {
      unsubEvent();
      unsubStatus();
      unsubState();
      unsubModels();
    };
  }, [sessionId, addEvent, setStatus, clear, attachSession]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  function sendChat() {
    if (!input.trim() || !sessionId) return;
    addUserMessage(input.trim());
    wsService.send({ type: 'chat_input', sessionId, content: input.trim(), model: selectedModel ?? undefined });
    setInput('');
  }

  function sendSteer() {
    if (!input.trim() || !sessionId) return;
    addUserMessage(input.trim());
    wsService.send({ type: 'steer_input', sessionId, content: input.trim() });
    setInput('');
  }

  function cancelTurn() {
    if (!sessionId) return;
    wsService.send({ type: 'cancel_turn', sessionId });
  }

  function approveAction() {
    if (!sessionId) return;
    wsService.send({ type: 'approve_input', sessionId });
    setWaitingApproval(false);
  }

  function rejectAction() {
    if (!sessionId) return;
    wsService.send({ type: 'reject_input', sessionId });
    setWaitingApproval(false);
  }

  const running = isRunning(agentStatus);
  const statusColor = STATUS_COLORS[agentStatus] ?? '#a8a29e';
  const sendDisabled = !input.trim();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.headerOverlay, { paddingTop: insets.top }]}>
        <BlurView
          tint={c.isDark ? 'dark' : 'light'}
          intensity={60}
          style={styles.headerBlur}
        >
          <View style={styles.headerContent}>
            <View style={[styles.statusDotOuter, { borderColor: statusColor }]}>
              {running && (
                <View style={[styles.statusDotPulse, { backgroundColor: statusColor }]} />
              )}
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
            <View style={styles.headerTitles}>
              <Text style={[styles.headerTitle, { color: c.textPrimary }]}>
                {sessionId?.slice(0, 8)}
              </Text>
              <Text style={[styles.headerSubtitle, { color: c.textTertiary }]} numberOfLines={1}>
                {agentStatus.replace('_', ' ')}
              </Text>
            </View>
            <View style={styles.spacer} />
            <Pressable
              onPress={() => router.push(`/terminal/${sessionId}`)}
              style={styles.headerAction}
              hitSlop={4}
            >
              <Ionicons name="terminal-outline" size={18} color={c.textTertiary} />
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={[styles.headerAction, { marginLeft: 2 }]}
              hitSlop={4}
            >
              <Ionicons name="chevron-down" size={20} color={c.textTertiary} />
            </Pressable>
          </View>
        </BlurView>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, { color: c.textTertiary }]}>{'\u{1F4AC}'}</Text>
          <Text style={[styles.emptyTitle, { color: c.textSecondary }]}>
            Start a conversation
          </Text>
          <Text style={[styles.emptySub, { color: c.textTertiary }]}>
            Type a message below to interact with the agent
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            { paddingTop: insets.top + HEADER_HEIGHT },
          ]}
          renderItem={({ item: msg }) => <MessageBubble msg={msg} colors={c} />}
        />
      )}

      {waitingApproval && (
        <View style={[styles.approvalBanner, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.approvalText, { color: c.textPrimary }]}>
            {'\uD83D\uDC41'} Waiting for your approval to proceed
          </Text>
          <View style={styles.approvalButtons}>
            <Pressable
              style={[styles.approvalBtn, { backgroundColor: '#22c55e' }]}
              onPress={approveAction}
              hitSlop={4}
            >
              <Text style={styles.approvalBtnText}>{'\u2713'} Approve</Text>
            </Pressable>
            <Pressable
              style={[styles.approvalBtn, { backgroundColor: '#ef4444' }]}
              onPress={rejectAction}
              hitSlop={4}
            >
              <Text style={styles.approvalBtnText}>{'\u2717'} Reject</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.composerWrapper, { paddingBottom: insets.bottom }]}>
        <View
          style={[
            styles.composerCard,
            {
              backgroundColor: c.isDark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.72)',
              borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <BlurView
            tint={c.isDark ? 'dark' : 'light'}
            intensity={40}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.composerInputRow}>
            <TextInput
              style={[
                styles.composerInput,
                { color: c.textPrimary },
              ]}
              value={input}
              onChangeText={setInput}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onSubmitEditing={running ? sendSteer : sendChat}
              returnKeyType="send"
              placeholder={running ? 'Steer the agent...' : 'Ask anything...'}
              placeholderTextColor={c.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
          </View>

          <View style={styles.bottomBar}>
            <Pressable
              style={styles.metaButton}
              hitSlop={4}
              accessibilityLabel="Attach file"
            >
              <Ionicons
                name="add"
                size={18}
                color={c.textTertiary}
              />
            </Pressable>

            <Pressable
              style={styles.modelButton}
              hitSlop={4}
              accessibilityLabel="Select model"
              onPress={() => {
                setModelPickerVisible(true);
                wsService.send({ type: 'model_list_request', sessionId });
              }}
            >
              <Text style={[styles.modelLabel, { color: c.textTertiary }]}>
                {selectedModel ?? 'Model'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={10}
                color={c.textTertiary}
                style={{ marginLeft: 2 }}
              />
            </Pressable>

            <Pressable
              style={styles.metaButton}
              hitSlop={4}
              accessibilityLabel="Reasoning effort"
            >
              <Ionicons
                name="bulb-outline"
                size={16}
                color={c.textTertiary}
              />
            </Pressable>

            <View style={styles.spacer} />

            <Pressable
              style={styles.metaButton}
              hitSlop={4}
              accessibilityLabel="Voice input"
            >
              <Ionicons
                name="mic-outline"
                size={18}
                color={c.textTertiary}
              />
            </Pressable>

            {running && (
              <Pressable
                onPress={cancelTurn}
                style={styles.stopButton}
                hitSlop={4}
                accessibilityLabel="Stop"
              >
                <Ionicons name="stop" size={12} color="#fff" />
              </Pressable>
            )}

            <Pressable
              onPress={running ? sendSteer : sendChat}
              style={[
                styles.sendButton,
                {
                  backgroundColor: sendDisabled
                    ? c.isDark
                      ? '#3a3a3c'
                      : '#d1d1d6'
                    : c.isDark
                      ? '#e8e8e8'
                      : '#1c1917',
                },
              ]}
              disabled={sendDisabled}
              hitSlop={4}
              accessibilityLabel="Send"
            >
              <Ionicons
                name="arrow-up"
                size={14}
                color={sendDisabled ? (c.isDark ? '#636366' : '#aeaeb2') : (c.isDark ? '#1c1917' : '#fff')}
              />
            </Pressable>
          </View>
        </View>

        {!inputFocused && (
          <View style={styles.secondaryBar}>
            <Pressable style={styles.secondaryPill} hitSlop={4}>
              <Ionicons name="laptop-outline" size={13} color={c.textTertiary} />
              <Text style={[styles.secondaryLabel, { color: c.textTertiary }]}>Local</Text>
              <Ionicons name="chevron-down" size={9} color={c.textTertiary} />
            </Pressable>

            <Pressable style={styles.secondaryPill} hitSlop={4}>
              <Ionicons
                name="shield-checkmark-outline"
                size={13}
                color={c.textTertiary}
              />
              <Ionicons name="chevron-down" size={9} color={c.textTertiary} />
            </Pressable>

            <View style={styles.spacer} />

            <Pressable style={styles.secondaryPill} hitSlop={4}>
              <Ionicons name="git-branch-outline" size={13} color={c.textTertiary} />
              <Text style={[styles.secondaryLabel, { color: c.textTertiary }]}>main</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal
        visible={modelPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModelPickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModelPickerVisible(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: c.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.textPrimary }]}>Select Model</Text>
              <Pressable onPress={() => setModelPickerVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={c.textTertiary} />
              </Pressable>
            </View>
            <FlatList
              data={models}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === selectedModel;
                return (
                  <Pressable
                    style={[styles.modelItem, isSelected && { backgroundColor: c.subtle }]}
                    onPress={() => {
                      setSelectedModel(item);
                      wsService.send({ type: 'model_select', sessionId, model: item });
                      setModelPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.modelItemText, { color: isSelected ? c.textPrimary : c.textSecondary }]}>
                      {item}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={c.textPrimary} />}
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.modelList}
            />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  msg,
  colors: c,
}: {
  msg: { role: string; content: string; eventType?: string };
  colors: ReturnType<typeof useThemeColors>;
}) {
  if (msg.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: '#3b82f6' }]}>
          <Text style={styles.userText}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  if (msg.role === 'assistant') {
    return (
      <View style={styles.assistantRow}>
        <View
          style={[styles.assistantBubble, { backgroundColor: c.card, borderColor: c.cardBorder }]}
        >
          <Text style={[styles.assistantText, { color: c.textPrimary }]}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  const isError = msg.eventType === 'error';

  return (
    <View style={styles.systemRow}>
      <View style={[styles.systemBubble, isError ? styles.errorBubble : { backgroundColor: c.subtle }]}>
        <Text style={[styles.systemText, isError ? styles.errorText : { color: c.textTertiary }]}>
          {isError ? `\u26A0\uFE0F ${msg.content}` : msg.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBlur: {
    overflow: 'hidden',
  },
  headerContent: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  headerTitles: {
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  headerSubtitle: {
    fontSize: 10,
    marginTop: 0,
  },
  headerAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  messageList: {
    paddingHorizontal: 12,
    paddingBottom: 20,
    gap: 8,
  },
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    borderCurve: 'continuous',
  },
  userText: { fontSize: 14, color: '#fff', lineHeight: 19 },
  assistantRow: { alignItems: 'flex-start' },
  assistantBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  assistantText: { fontSize: 14, lineHeight: 19 },
  systemRow: { alignItems: 'center' },
  systemBubble: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  systemText: { fontSize: 11, fontWeight: '500' },

  composerWrapper: {
    paddingHorizontal: 10,
    paddingTop: 6,
  },

  composerCard: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  composerInputRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  composerInput: {
    fontSize: 15,
    minHeight: 36,
    maxHeight: 120,
    lineHeight: 20,
    padding: 0,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 8,
    gap: 8,
  },

  metaButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingRight: 2,
  },
  modelLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  stopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 6,
  },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  secondaryLabel: {
    fontSize: 12,
    fontWeight: '400',
  },

  spacer: { flex: 1 },

  errorBubble: { backgroundColor: 'rgba(239,68,68,0.1)' },
  errorText: { color: '#ef4444', fontSize: 11, fontWeight: '500' },

  approvalBanner: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
  },
  approvalText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  approvalButtons: { flexDirection: 'row', gap: 12 },
  approvalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  approvalBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  modelList: { paddingHorizontal: 8 },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  modelItemText: { fontSize: 15, fontWeight: '400' },
});
