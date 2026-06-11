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
          <View style={styles.grabber} />

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
            <View style={styles.rowList}>
              {visibleRows.map((row, index) => (
                <TallyRow
                  key={row.item.id}
                  row={row}
                  first={index === 0}
                  onIncrement={handleIncrement}
                />
              ))}

              {hiddenCount > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllItems }}
                  onPress={() => setShowAllItems((showAll) => !showAll)}
                  style={({ pressed }) => [
                    styles.showMoreButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.showMoreText}>
                    {showAllItems ? 'Show fewer' : `Show ${hiddenCount} more`}
                  </Text>
                  <Ionicons
                    name={showAllItems ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={colors.textTertiaryLight}
                  />
                </Pressable>
              )}
            </View>
          </ScrollView>

          <View style={styles.undoPillBar}>
            {lastIncrement && (
              <View style={styles.undoPill}>
                <Text style={styles.undoText}>
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
      </View>
    </Modal>
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
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
        ) : (
          <View style={[styles.progressTrack, styles.progressTrackGhost]} />
        )}
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
        <Ionicons name="add" size={24} color={colors.textSecondaryLight} />
      </Pressable>
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
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginBottom: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.neutral300,
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
    paddingTop: spacing[3],
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
  showMoreButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  showMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textTertiaryLight,
  },
  undoPillBar: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
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
