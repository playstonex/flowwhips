import { create } from 'zustand';
import type { SavedConnection } from '../services/secure-storage';

interface ConnectionState {
  mode: 'local' | 'remote';
  connected: boolean;
  relayUrl: string;
  hostId: string;
  token: string;
  localHttpUrl: string;
  localWsUrl: string;
  setMode: (mode: 'local' | 'remote') => void;
  setConnected: (connected: boolean) => void;
  setCredentials: (config: SavedConnection) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  mode: 'remote',
  connected: false,
  relayUrl: '',
  hostId: '',
  token: '',
  localHttpUrl: 'http://192.168.1.100:3210',
  localWsUrl: 'ws://192.168.1.100:3211',
  setMode: (mode) => set({ mode }),
  setConnected: (connected) => set({ connected }),
  setCredentials: (config) =>
    set({
      mode: config.mode,
      relayUrl: config.relayUrl ?? '',
      hostId: config.hostId ?? '',
      token: config.token ?? '',
      localHttpUrl: config.localHttpUrl ?? 'http://192.168.1.100:3210',
      localWsUrl: config.localWsUrl ?? 'ws://192.168.1.100:3211',
    }),
}));
