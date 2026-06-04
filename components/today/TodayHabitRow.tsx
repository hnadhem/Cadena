import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { colors, spacing, typography, radius } from '../../constants/theme';
import type { CompletionState } from '../../constants/theme';
import type { TodayHabitItem, TodayHabitStatus } from '../../types/today';

interface TodayHabitRowProps {
  item: TodayHabitItem;
  onPress?: (item: TodayHabitItem) => void;
}

const STATUS_LABELS: Record<TodayHabitStatus, string> = {
  pending: 'Pending',
  completed: 'Done',
  missed: 'Missed',
};

const STATUS_STATES: Record<TodayHabitStatus, CompletionState> = {
  pending: 'pending',
  completed: 'complete',
  missed: 'missed',
};

export function TodayHabitRow({ item, onPress }: TodayHabitRowProps) {
  const completed = item.status === 'completed';

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        completed && styles.completedRow,
        pressed && styles.pressed,
        !onPress && styles.disabled,
      ]}
    >
      <View style={[styles.iconWrap, completed && styles.completedIconWrap]}>
        <Ionicons
          name={completed ? 'checkmark' : 'ellipse-outline'}
          size={18}
          color={completed ? colors.neutral500 : colors.activity.habit}
        />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, completed && styles.completedText]}>{item.title}</Text>
        {item.scheduledTime && <Text style={styles.meta}>{item.scheduledTime}</Text>}
      </View>
      <Badge label={STATUS_LABELS[item.status]} state={STATUS_STATES[item.status]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  completedRow: {
    backgroundColor: colors.neutral50,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted.completeSurface,
  },
  completedIconWrap: {
    backgroundColor: colors.neutral100,
  },
  body: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textPrimaryLight,
  },
  completedText: {
    color: colors.textSecondaryLight,
  },
  meta: {
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
});
