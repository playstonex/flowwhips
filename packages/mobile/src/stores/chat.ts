import { create } from 'zustand';
import type { ParsedEvent } from '@baton/shared';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  eventType?: string;
  meta?: Record<string, unknown>;
}

interface ChatState {
  messages: ChatMessage[];
  agentStatus: string;
  waitingApproval: boolean;
  addEvent: (event: ParsedEvent) => void;
  addUserMessage: (content: string) => void;
  setStatus: (status: string) => void;
  setWaitingApproval: (waiting: boolean) => void;
  clear: () => void;
}

let counter = 0;

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  agentStatus: 'unknown',
  waitingApproval: false,

  addEvent: (event) =>
    set((state) => {
      const id = `m-${++counter}`;
      const ts = event.timestamp;

      if (event.type === 'status_change') {
        return { agentStatus: event.status };
      }

      if (event.type === 'waiting_approval') {
        return { waitingApproval: true };
      }

      if (event.type === 'chat_message') {
        return {
          messages: [...state.messages, { id, role: event.role, content: event.content, timestamp: ts, eventType: 'chat_message' }],
        };
      }

      if (event.type === 'raw_output') {
        if (!event.content?.trim()) return state;
        const messages = [...state.messages];
        const last = messages[messages.length - 1];
        if (last?.eventType === 'raw_output') {
          messages[messages.length - 1] = {
            ...last,
            content: last.content + event.content,
          };
        } else {
          messages.push({
            id: `m-${++counter}`,
            role: 'assistant',
            content: event.content,
            timestamp: ts,
            eventType: 'raw_output',
          });
        }
        return { messages };
      }

      if (event.type === 'thinking') {
        const last = state.messages[state.messages.length - 1];
        if (last?.eventType === 'thinking') return state;
        return {
          messages: [...state.messages, { id, role: 'system', content: 'Thinking...', timestamp: ts, eventType: 'thinking' }],
        };
      }

      if (event.type === 'tool_use') {
        const hint = event.args?.filePath ? ` \u2192 ${event.args.filePath}` : '';
        return {
          messages: [...state.messages, { id, role: 'system', content: `\uD83D\uDD27 ${event.tool}${hint}`, timestamp: ts, eventType: 'tool_use', meta: event.args as Record<string, unknown> }],
        };
      }

      if (event.type === 'file_change') {
        const icons: Record<string, string> = { create: '+', modify: '~', delete: '-' };
        return {
          messages: [...state.messages, { id, role: 'system', content: `${icons[event.changeType] ?? '~'} ${event.changeType} ${event.path}`, timestamp: ts, eventType: 'file_change' }],
        };
      }

      if (event.type === 'command_exec') {
        return {
          messages: [...state.messages, { id, role: 'system', content: `$ ${event.command}`, timestamp: ts, eventType: 'command_exec' }],
        };
      }

      if (event.type === 'error') {
        return {
          messages: [...state.messages, { id, role: 'system', content: `${event.message}`, timestamp: ts, eventType: 'error' }],
        };
      }

      return state;
    }),

  addUserMessage: (content) =>
    set((state) => ({
      messages: [...state.messages, { id: `m-${++counter}`, role: 'user', content, timestamp: Date.now(), eventType: 'chat_message' }],
    })),

  setStatus: (status) => set({ agentStatus: status }),

  setWaitingApproval: (waiting) => set({ waitingApproval: waiting }),

  clear: () => set({ messages: [], agentStatus: 'unknown', waitingApproval: false }),
}));
