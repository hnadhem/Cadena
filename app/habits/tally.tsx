import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatRelativeDay } from '../../utils/dateUtils';
import {
  decrementTodayTallyCount,
  getTodayTallyProgressPercent,
  getTodayTallyRowsForDate,
  incrementTodayTallyCount,
  type TodayTallyLogsByDate,
  type TodayTallyRow,
} from '../../utils/todayTally';

interface LastIncrement {
  tallyItemId: string;
  itemName: string;
}

export default function HabitsTallyScreen() {
  const dateKey = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const [tallyLogsByDate, setTallyLogsByDate] = useState<TodayTallyLogsByDate>({});
  const [lastIncrement, setLastIncrement] = useState<LastIncrement | null>(null);

  useEffect(() => {
    if (!lastIncrement) return undefined;

    const timeout = setTimeout(() => {
      setLastIncrement(null);
    }, 3500);

    return () => clearTimeout(timeout);
  }, [lastIncrement]);

  const handleIncrement = useCallback(
    (row: TodayTallyRow) => {
      setTallyLogsByDate((currentLogs) => {
        const result = incrementTodayTallyCount(currentLogs, dateKey, row.item.id);
        if (!result.ok) {
          Alert.alert('Could not update tally', result.error);
          return currentLogs;
        }

        return result.tallyLogsByDate;
      });
      setLastIncrement({ tallyItemId: row.item.id, itemName: row.item.name });
    },
    [dateKey]
  );

  const handleUndo = useCallback(() => {
    if (!lastIncrement) return;

    const { tallyItemId } = lastIncrement;
    setTallyLogsByDate((currentLogs) => {
      const result = decrementTodayTallyCount(currentLogs, dateKey, tallyItemId);
      if (!result.ok) {
        Alert.alert('Could not update tally', result.error);
        return currentLogs;
      }

      return result.tallyLogsByDate;
    });
    setLastIncrement(null);
  }, [dateKey, lastIncrement]);

  const rows = getTodayTallyRowsForDate(tallyLogsByDate, dateKey);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Tally' }} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.dateLabel}>{formatRelativeDay(dateKey)}</Text>

        <View style={styles.rowList}>
          {rows.map((row, index) => (
            <TallyRow
              key={row.item.id}
              row={row}
              first={index === 0}
              onIncrement={handleIncrement}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.undoPillBar}>
        {lastIncrement && (
          <View style={styles.undoPill}>
            <Text style={styles.undoText} numberOfLines={1}>
              Added 1 to {lastIncrement.itemName}
            </Text>
            <Text style={styles.undoSeparator}>|</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Undo ${lastIncrement.itemName} tally increment`}
              onPress={handleUndo}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.undoButtonText}>Undo</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function TallyRow({
  row,
  first,
  onIncrement,
}: {
  row: TodayTallyRow;
  first: boolean;
  onIncrement: (row: TodayTallyRow) => void;
}) {
  const unitLabel = row.item.unit ? ` ${row.item.unit}` : '';
  const target = row.item.target;
  const hasTarget = target !== undefined && target > 0;
  const progressPercent = getTodayTallyProgressPercent(row.log.count, target);

  return (
    <View style={[styles.row, first && styles.firstRow]}>
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text style={styles.itemName} numberOfLines={1}>
            {row.item.name}
          </Text>
          <Text style={styles.periodLabel}>{row.item.periodLabel}</Text>
        </View>

        <View style={styles.countLine}>
          <Text style={styles.countText}>{formatNumber(row.log.count)}</Text>
          {row.item.unit && <Text style={styles.unitText}>{row.item.unit}</Text>}
          {hasTarget && (
            <Text style={styles.targetText}>
              Goal {formatNumber(target)}
              {unitLabel}
            </Text>
          )}
        </View>

        {hasTarget ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        ) : (
          <View style={[styles.progressTrack, styles.progressTrackGhost]} />
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one to ${row.item.name}`}
        onPress={() => onIncrement(row)}
        style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={24} color={colors.textSecondaryLight} />
      </Pressable>
    </View>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
  },
  dateLabel: {
    marginBottom: spacing[3],
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  rowList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  row: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  periodLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondaryLight,
  },
  plusButton: {
    flexShrink: 0,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
  },
  countLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1],
  },
  countText: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
    fontVariant: ['tabular-nums'],
  },
  unitText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textTertiaryLight,
  },
  targetText: {
    marginLeft: spacing[1],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textTertiaryLight,
  },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.neutral200,
  },
  progressTrackGhost: {
    opacity: 0.45,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.neutral800,
  },
  undoPillBar: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  undoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    paddingLeft: spacing[4],
    paddingRight: spacing[1],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: colors.textPrimaryLight,
  },
  undoText: {
    flexShrink: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.white,
  },
  undoSeparator: {
    marginHorizontal: spacing[2],
    fontSize: typography.size.sm,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  undoButtonText: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: 'rgba(255, 255, 255, 0.72)',
  },
  pressed: {
    opacity: 0.75,
  },
});
