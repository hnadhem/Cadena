import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../../constants/theme';

interface TodayHabitSummaryProps {
  completedHabitCount: number;
  totalVisibleHabitCount: number;
}

export function TodayHabitSummary({
  completedHabitCount,
  totalVisibleHabitCount,
}: TodayHabitSummaryProps) {
  const hasHabits = totalVisibleHabitCount > 0;
  const label = `${completedHabitCount} of ${totalVisibleHabitCount} habits done`;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View
          style={[
            styles.progress,
            { flex: hasHabits ? completedHabitCount / totalVisibleHabitCount : 0 },
          ]}
        />
        <View
          style={[
            styles.remainder,
            { flex: hasHabits ? 1 - completedHabitCount / totalVisibleHabitCount : 1 },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  label: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  track: {
    height: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.neutral200,
  },
  progress: {
    backgroundColor: colors.muted.complete,
  },
  remainder: {
    backgroundColor: colors.neutral200,
  },
});
