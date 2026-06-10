import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { colors, radius, spacing, typography } from '../../constants/theme';
import {
  TODAY_TALLY_VISIBLE_LIMIT,
  getTodayTallyProgressPercent,
  type TodayTallyRow,
} from '../../utils/todayTally';

interface TodayTallySheetProps {
  visible: boolean;
  date: string;
  rows: TodayTallyRow[];
  onClose: () => void;
  onIncrement: (tallyItemId: string) => void;
  onUndoIncrement: (tallyItemId: string) => void;
}

interface LastIncrement {
  tallyItemId: string;
  itemName: string;
}

export function TodayTallySheet({
  visible,
  date,
  rows,
  onClose,
  onIncrement,
  onUndoIncrement,
}: TodayTallySheetProps) {
  const [showAllItems, setShowAllItems] = useState(false);
  const [lastIncrement, setLastIncrement] = useState<LastIncrement | null>(null);

  useEffect(() => {
    if (!visible) return;

    setShowAllItems(false);
    setLastIncrement(null);
  }, [date, visible]);

  useEffect(() => {
    if (!lastIncrement) return undefined;

    const timeout = setTimeout(() => {
      setLastIncrement(null);
    }, 3500);

    return () => clearTimeout(timeout);
  }, [lastIncrement]);

  const visibleRows = showAllItems ? rows : rows.slice(0, TODAY_TALLY_VISIBLE_LIMIT);
  const hiddenCount = Math.max(0, rows.length - TODAY_TALLY_VISIBLE_LIMIT);

  function handleIncrement(row: TodayTallyRow) {
    onIncrement(row.item.id);
    setLastIncrement({
      tallyItemId: row.item.id,
      itemName: row.item.name,
    });
  }

  function handleUndo() {
    if (!lastIncrement) return;

    onUndoIncrement(lastIncrement.tallyItemId);
    setLastIncrement(null);
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close tally"
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Tally</Text>
              <Text style={styles.dateLabel}>{date}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close tally"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.textSecondaryLight} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {visibleRows.map((row) => (
              <TallyRow
                key={row.item.id}
                row={row}
                onIncrement={handleIncrement}
              />
            ))}

            {!showAllItems && hiddenCount > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAllItems(true)}
                style={({ pressed }) => [
                  styles.showMoreButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.showMoreText}>Show {hiddenCount} more</Text>
                <Ionicons name="chevron-down" size={16} color={colors.brand600} />
              </Pressable>
            )}
          </ScrollView>

          {lastIncrement && (
            <View style={styles.undoPill}>
              <Text style={styles.undoText}>Added 1 to {lastIncrement.itemName}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleUndo}
                hitSlop={8}
              >
                <Text style={styles.undoButtonText}>Undo</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.footer}>
            <Button label="Close" onPress={onClose} variant="secondary" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TallyRow({
  row,
  onIncrement,
}: {
  row: TodayTallyRow;
  onIncrement: (row: TodayTallyRow) => void;
}) {
  const unitLabel = row.item.unit ? ` ${row.item.unit}` : '';
  const target = row.item.target;
  const hasTarget = target !== undefined && target > 0;
  const progressPercent = getTodayTallyProgressPercent(row.log.count, target);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowTitleGroup}>
          <Text style={styles.itemName}>{row.item.name}</Text>
          <Text style={styles.periodLabel}>{row.item.periodLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add one to ${row.item.name}`}
          onPress={() => onIncrement(row)}
          style={({ pressed }) => [
            styles.plusButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.countLine}>
        <Text style={styles.countText}>
          {formatNumber(row.log.count)}
          {unitLabel}
        </Text>
        {hasTarget && (
          <Text style={styles.targetText}>
            Goal {formatNumber(target)}
            {unitLabel}
          </Text>
        )}
      </View>

      {hasTarget && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%` },
            ]}
          />
        </View>
      )}
    </View>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  sheet: {
    maxHeight: '88%',
    gap: spacing[4],
    padding: spacing[4],
    paddingBottom: spacing[5],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surfaceLight,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  dateLabel: {
    marginTop: spacing[1],
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.neutral100,
  },
  content: {
    gap: spacing[3],
  },
  row: {
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.neutral50,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  rowTitleGroup: {
    flex: 1,
    gap: spacing[1],
  },
  itemName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  periodLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondaryLight,
  },
  plusButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.brand600,
  },
  countLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  countText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  targetText: {
    flexShrink: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
    textAlign: 'right',
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.neutral200,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.brand600,
  },
  showMoreButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  showMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.brand600,
  },
  undoPill: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.neutral100,
  },
  undoText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  undoButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.brand600,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  pressed: {
    opacity: 0.75,
  },
});
