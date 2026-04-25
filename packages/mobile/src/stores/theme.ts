import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'fw_theme';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: 'dark',
  setTheme: (theme) => {
    set({ theme });
    SecureStore.setItemAsync(THEME_KEY, theme);
  },
  loadTheme: async () => {
    const saved = await SecureStore.getItemAsync(THEME_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      set({ theme: saved });
    }
  },
}));
