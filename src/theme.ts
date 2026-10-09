// ============================================================
// src/theme.ts — Material Design 3 theme for React Native Paper
// ============================================================

import { MD3DarkTheme } from 'react-native-paper';

/** Custom MD3 dark theme colour palette */
export const AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Primary brand colour: teal/cyan
    primary: '#06B6D4',
    onPrimary: '#0F172A',
    primaryContainer: '#083344',
    onPrimaryContainer: '#67E8F9',

    // Secondary
    secondary: '#818CF8',
    onSecondary: '#1E1B4B',
    secondaryContainer: '#312E81',
    onSecondaryContainer: '#C7D2FE',

    // Surface / Background
    background: '#0F172A',
    onBackground: '#E2E8F0',
    surface: '#1E293B',
    onSurface: '#E2E8F0',
    surfaceVariant: '#263348',
    onSurfaceVariant: '#94A3B8',

    // Outline / border
    outline: '#334155',
    outlineVariant: '#1E293B',

    // Error
    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#7F1D1D',
    onErrorContainer: '#FECACA',

    // Misc
    inverseSurface: '#E2E8F0',
    inverseOnSurface: '#0F172A',
    inversePrimary: '#0E7490',
    elevation: {
      level0: 'transparent',
      level1: '#1E293B',
      level2: '#263348',
      level3: '#2D3D57',
      level4: '#344666',
      level5: '#3B5075',
    },
  },
};

/** Convenience raw colour values (for StyleSheet / NativeWind fallbacks) */
export const COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceElevated: '#263348',
  accent: '#06B6D4',
  accentDim: '#0E7490',
  accentGlow: 'rgba(6,182,212,0.15)',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  border: '#334155',
  recordActive: '#F43F5E',
  recordGlow: 'rgba(244,63,94,0.25)',
};
