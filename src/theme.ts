// ============================================================
// src/theme.ts — Material Design 3 theme for React Native Paper
// ============================================================

import { MD3DarkTheme } from 'react-native-paper';

/** Custom MD3 dark theme colour palette */
export const AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Primary brand colour: orange
    primary: '#FF5C1C',
    onPrimary: '#0D0402',
    primaryContainer: '#51200D',
    onPrimaryContainer: '#FFC6A7',

    // Secondary
    secondary: '#FFAA72',
    onSecondary: '#321306',
    secondaryContainer: '#51200D',
    onSecondaryContainer: '#FFD4B9',

    // Surface / Background
    background: '#0D0402',
    onBackground: '#FFFFFF',
    surface: '#211711',
    onSurface: '#FFFFFF',
    surfaceVariant: '#2C2019',
    onSurfaceVariant: '#B8ADA7',

    // Outline / border
    outline: '#574338',
    outlineVariant: '#211711',

    // Error
    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#7F1D1D',
    onErrorContainer: '#FECACA',

    // Misc
    inverseSurface: '#FFFFFF',
    inverseOnSurface: '#0D0402',
    inversePrimary: '#C3430D',
    elevation: {
      level0: 'transparent',
      level1: '#211711',
      level2: '#2C2019',
      level3: '#35271F',
      level4: '#402E24',
      level5: '#493429',
    },
  },
};

/** Convenience raw colour values (for StyleSheet / NativeWind fallbacks) */
export const COLORS = {
  background: '#0D0402',
  surface: '#211711',
  surfaceElevated: '#2C2019',
  accent: '#FF5C1C',
  accentDim: '#C3430D',
  accentGlow: 'rgba(255,92,28,0.15)',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  textPrimary: '#FFFFFF',
  textSecondary: '#B8ADA7',
  border: '#574338',
  recordActive: '#F43F5E',
  recordGlow: 'rgba(244,63,94,0.25)',
};
