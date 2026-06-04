import React from 'react';
import { Alert, Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { colors, spacing, typography, radius } from '../../constants/theme';
import type { CompletionState } from '../../constants/theme';
import type {
  TodayFitnessItem,
  TodayFitnessKind,
  TodayFitnessStatus,
} from '../../types/today';

interface TodayFitnessCardProps {
  item: TodayFitnessItem;
  actionPending?: boolean;
  onPress?: (item: TodayFitnessItem) => void;
  onSkip?: (item: TodayFitnessItem) => void;
  onMoveToTomorrow?: (item: TodayFitnessItem) => void;
}

const KIND_ICONS: Record<TodayFitnessKind, keyof typeof Ionicons.glyphMap> = {
  workout: 'barbell-outline',
  cardio: 'heart-outline',
};

const STATUS_LABELS: Record<TodayFitnessStatus, string> = {
  planned: 'Planned',
  live: 'Live',
  completed: 'Done',
  skipped: 'Skipped',
};

const STATUS_STATES: Record<TodayFitnessStatus, CompletionState> = {
  planned: 'pending',
  live: 'over_threshold',
  completed: 'complete',
  skipped: 'pending',
};

export function TodayFitnessCard({
  item,
  actionPending = false,
  onPress,
  onSkip,
  onMoveToTomorrow,
}: TodayFitnessCardProps) {
  const actionsAvailable = item.status === 'planned' || item.status === 'skipped';
  const muted = item.status === 'completed' || item.status === 'skipped';

  function openActions() {
    Alert.alert(item.title, 'Session actions', [
      {
        text: 'Skip',
        onPress: () => onSkip?.(item),
      },
      {
        text: 'Move to Tomorrow',
        onPress: () => onMoveToTomorrow?.(item),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Card style={[styles.card, muted && styles.mutedCard]}>
      <View style={styles.header}>
        <View style={[styles.kindIcon, item.kind === 'cardio' && styles.cardioIcon]}>
          <Ionicons name={KIND_ICONS[item.kind]} size={18} color={colors.white} />
        </View>
        <Text style={styles.kindLabel}>{item.kind === 'workout' ? 'Workout' : 'Cardio'}</Text>
        <Badge label={STATUS_LABELS[item.status]} state={STATUS_STATES[item.status]} />
        {actionsAvailable && (
          <Pressable
            onPress={openActions}
            disabled={actionPending}
            hitSlop={8}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressed,
              actionPending && styles.disabled,
            ]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondaryLight} />
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={() => onPress?.(item)}
        disabled={!onPress}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <Text style={[styles.title, muted && styles.mutedText]}>{item.title}</Text>
        {(item.subtitle || item.scheduledTime) && (
          <Text style={styles.subtitle}>{item.subtitle ?? item.scheduledTime}</Text>
        )}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
  },
  mutedCard: {
    backgroundColor: colors.neutral50,
  },
  header: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  kindIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.activity.workout,
  },
  cardioIcon: {
    backgroundColor: colors.activity.cardio,
  },
  kindLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondaryLight,
  },
  actionButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  body: {
    gap: spacing[1],
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  mutedText: {
    color: colors.textSecondaryLight,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
});
