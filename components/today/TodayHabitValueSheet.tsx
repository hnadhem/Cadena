import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { colors, radius, spacing, typography } from '../../constants/theme';
import type { TodayHabitItem } from '../../types/today';

interface TodayHabitValueSheetProps {
  visible: boolean;
  item: TodayHabitItem | null;
  onClose: () => void;
  onSave: (value: number) => void;
}

export function TodayHabitValueSheet({
  visible,
  item,
  onClose,
  onSave,
}: TodayHabitValueSheetProps) {
  const [valueText, setValueText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !item) return;

    setValueText(item.value !== undefined ? formatNumber(item.value) : '');
    setError(null);
  }, [item, visible]);

  function handleSave() {
    const trimmedValue = valueText.trim();
    const value = Number(trimmedValue);

    if (trimmedValue.length === 0 || !Number.isFinite(value) || value < 0) {
      setError('Enter a valid value.');
      return;
    }

    onSave(value);
  }

  const targetLabel = item ? formatTargetLabel(item) : null;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible && Boolean(item)}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close habit value"
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {item?.title ?? 'Habit'}
              </Text>
              {targetLabel && <Text style={styles.subtitle}>{targetLabel}</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close habit value"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={22} color={colors.textSecondaryLight} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Value</Text>
            <View style={styles.valueInputWrap}>
              <TextInput
                autoFocus
                keyboardType="decimal-pad"
                value={valueText}
                onChangeText={(nextValue) => {
                  setValueText(nextValue);
                  setError(null);
                }}
                placeholder="0"
                placeholderTextColor={colors.textTertiaryLight}
                style={styles.valueInput}
              />
              {item?.targetUnit && <Text style={styles.unitLabel}>{item.targetUnit}</Text>}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="secondary" />
            <Button label="Save" onPress={handleSave} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatTargetLabel(item: TodayHabitItem): string | null {
  if (item.targetValue === undefined) return null;

  const unit = item.targetUnit ? ` ${item.targetUnit}` : '';
  return `Goal ${formatNumber(item.targetValue)}${unit}`;
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
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  sheet: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
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
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  subtitle: {
    marginTop: spacing[1],
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  field: {
    gap: spacing[2],
    paddingVertical: spacing[5],
  },
  fieldLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textTertiaryLight,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  valueInputWrap: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundLight,
  },
  valueInput: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondaryLight,
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.muted.missed,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  pressed: {
    opacity: 0.7,
  },
});
