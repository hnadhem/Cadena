import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../constants/theme';
import type { CompletionState } from '../../constants/theme';

interface BadgeProps {
  label: string;
  state?: CompletionState;
  scheme?: 'classic' | 'muted';
}

export function Badge({ label, state = 'pending', scheme = 'muted' }: BadgeProps) {
  const stateColors = colors[scheme][state];
  return (
    <View style={[styles.badge, { backgroundColor: colors[scheme][`${state}Surface` as never] ?? colors.neutral100 }]}>
      <Text style={[styles.label, { color: stateColors }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
