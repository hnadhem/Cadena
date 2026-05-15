import { useColorScheme as useRNColorScheme } from 'react-native';

export const colors = {
  // Base palette
  white: '#FFFFFF',
  black: '#000000',

  // Neutral scale
  neutral50: '#FAFAFA',
  neutral100: '#F5F5F5',
  neutral200: '#E5E5E5',
  neutral300: '#D4D4D4',
  neutral400: '#A3A3A3',
  neutral500: '#737373',
  neutral600: '#525252',
  neutral700: '#404040',
  neutral800: '#262626',
  neutral900: '#171717',

  // Brand
  brand500: '#6366F1',
  brand600: '#4F46E5',
  brand700: '#4338CA',

  // Semantic backgrounds
  backgroundLight: '#F8F7F4',
  backgroundDark: '#111111',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#1C1C1E',
  surfaceElevatedLight: '#FFFFFF',
  surfaceElevatedDark: '#2C2C2E',

  // Text
  textPrimaryLight: '#1A1A1A',
  textPrimaryDark: '#F5F5F5',
  textSecondaryLight: '#525252',
  textSecondaryDark: '#A3A3A3',
  textTertiaryLight: '#A3A3A3',
  textTertiaryDark: '#525252',

  // Borders
  borderLight: '#E5E5E5',
  borderDark: '#3A3A3C',

  // Completion states — classic scheme
  classic: {
    complete: '#22C55E',
    completeSurface: '#F0FDF4',
    completeBorder: '#86EFAC',
    partial: '#F59E0B',
    partialSurface: '#FFFBEB',
    partialBorder: '#FCD34D',
    over_threshold: '#3B82F6',
    over_thresholdSurface: '#EFF6FF',
    over_thresholdBorder: '#93C5FD',
    pending: '#A3A3A3',
    pendingSurface: '#F5F5F5',
    pendingBorder: '#D4D4D4',
    missed: '#EF4444',
    missedSurface: '#FEF2F2',
    missedBorder: '#FCA5A5',
  },

  // Completion states — muted scheme
  muted: {
    complete: '#4ADE80',
    completeSurface: '#F0FDF4',
    completeBorder: '#BBF7D0',
    partial: '#FBBF24',
    partialSurface: '#FEFCE8',
    partialBorder: '#FEF08A',
    over_threshold: '#60A5FA',
    over_thresholdSurface: '#EFF6FF',
    over_thresholdBorder: '#BFDBFE',
    pending: '#D4D4D4',
    pendingSurface: '#FAFAFA',
    pendingBorder: '#E5E5E5',
    missed: '#F87171',
    missedSurface: '#FFF1F2',
    missedBorder: '#FECACA',
  },

  // Activity type colors
  activity: {
    workout: '#6366F1',
    cardio: '#EC4899',
    habit: '#22C55E',
    check_in: '#F59E0B',
  },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const typography = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export type ColorScheme = 'classic' | 'muted';
export type CompletionState = 'complete' | 'partial' | 'over_threshold' | 'pending' | 'missed';
export type ActivityType = 'workout' | 'cardio' | 'habit' | 'check_in';

export function useColorScheme() {
  return useRNColorScheme() ?? 'light';
}

export function getCompletionColors(state: CompletionState, scheme: ColorScheme = 'muted') {
  return colors[scheme][state];
}
