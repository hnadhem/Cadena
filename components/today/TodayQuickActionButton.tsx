import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../../constants/theme';
import type { TodayQuickAction } from '../../types/today';

interface TodayQuickActionButtonProps {
  action: TodayQuickAction;
  onPress?: (action: TodayQuickAction) => void;
}

const ACTION_ICONS: Record<TodayQuickAction['kind'], keyof typeof Ionicons.glyphMap> = {
  checkIn: 'happy-outline',
  nutrition: 'restaurant-outline',
  medication: 'medical-outline',
  tally: 'add-circle-outline',
};

export function TodayQuickActionButton({ action, onPress }: TodayQuickActionButtonProps) {
  return (
    <Pressable
      onPress={() => onPress?.(action)}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        !onPress && styles.disabled,
      ]}
    >
      <Ionicons name={ACTION_ICONS[action.kind]} size={22} color={colors.brand600} />
      <Text style={styles.label} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 72,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.65,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.textSecondaryLight,
  },
});
