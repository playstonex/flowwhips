import { create } from 'zustand';

const MAX_LINES = 5000;

interface TerminalState {
  sessions: Record<string, string[]>;
  addOutput: (sessionId: string, text: string) => void;
  clearSession: (sessionId: string) => void;
  getSession: (sessionId: string) => string[];
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  sessions: {},
  addOutput: (sessionId, text) =>
    set((state) => {
      const existing = state.sessions[sessionId] ?? [];
      const lines = text.split('\n');
      const updated = [...existing, ...lines].slice(-MAX_LINES);
      return { sessions: { ...state.sessions, [sessionId]: updated } };
    }),
  clearSession: (sessionId) =>
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[sessionId];
      return { sessions };
    }),
  getSession: (sessionId) => get().sessions[sessionId] ?? [],
}));
