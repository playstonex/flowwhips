import { useColorScheme } from 'react-native';
import { useThemeStore } from '../stores/theme';
import { Colors } from '../constants/theme';

export interface ThemeColors {
  isDark: boolean;
  bg: string;
  card: string;
  cardBorder: string;
  elevated: string;
  subtle: string;
  inputBg: string;
  inputBorder: string;
  glassBg: string;
  glassBgLight: string;
  glassBorder: string;
  glassBorderLight: string;
  glassHighlight: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textAccent: string;
}

export function useThemeColors(): ThemeColors {
  const theme = useThemeStore((s) => s.theme);
  const systemScheme = useColorScheme();

  const isDark = theme === 'dark' || (theme === 'system' && systemScheme !== 'light');

  const surface = isDark ? Colors.dark : Colors.light;
  const text = isDark ? Colors.text : Colors.lightText;
  const glass = isDark ? Colors.glass : Colors.lightGlass;

  return {
    isDark,
    bg: surface.bg,
    card: surface.card,
    cardBorder: surface.cardBorder,
    elevated: surface.elevated,
    subtle: surface.subtle,
    inputBg: surface.inputBg,
    inputBorder: surface.inputBorder,
    glassBg: glass.background,
    glassBgLight: glass.backgroundLight,
    glassBorder: glass.border,
    glassBorderLight: glass.borderLight,
    glassHighlight: glass.highlight,
    textPrimary: text.primary,
    textSecondary: text.secondary,
    textTertiary: text.tertiary,
    textInverse: text.inverse,
    textAccent: text.accent,
  };
}
