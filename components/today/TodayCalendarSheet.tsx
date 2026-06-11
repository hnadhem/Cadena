import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../constants/theme';
import {
  getTodayCalendarDays,
  getTodayCalendarMonthTitle,
  getTodayCalendarWeekdayLabels,
  type TodayCalendarDay,
} from '../../utils/todayCalendar';

interface TodayCalendarSheetProps {
  visible: boolean;
  selectedDate: string;
  weekStartDay?: number;
  onClose: () => void;
  onSelectDate: (date: string) => void;
}

export function TodayCalendarSheet({
  visible,
  selectedDate,
  weekStartDay = 0,
  onClose,
  onSelectDate,
}: TodayCalendarSheetProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    dayjs(selectedDate || new Date()).startOf('month')
  );

  useEffect(() => {
    if (!visible) return;

    setVisibleMonth(dayjs(selectedDate || new Date()).startOf('month'));
  }, [selectedDate, visible]);

  const weekdayLabels = useMemo(
    () => getTodayCalendarWeekdayLabels(weekStartDay),
    [weekStartDay]
  );
  const calendarDays = useMemo(
    () =>
      getTodayCalendarDays(visibleMonth, selectedDate || new Date(), {
        weekStartDay,
      }),
    [selectedDate, visibleMonth, weekStartDay]
  );

  function handlePreviousMonth() {
    setVisibleMonth((month) => month.subtract(1, 'month'));
  }

  function handleNextMonth() {
    setVisibleMonth((month) => month.add(1, 'month'));
  }

  function handleSelectDate(date: string) {
    onSelectDate(date);
    onClose();
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
          accessibilityLabel="Close calendar"
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>{getTodayCalendarMonthTitle(visibleMonth)}</Text>
            <View style={styles.navGroup}>
              <MonthNavButton
                accessibilityLabel="Previous month"
                icon="chevron-back"
                onPress={handlePreviousMonth}
              />
              <MonthNavButton
                accessibilityLabel="Next month"
                icon="chevron-forward"
                onPress={handleNextMonth}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close calendar"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondaryLight} />
              </Pressable>
            </View>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {calendarDays.map((day) => (
              <CalendarDayButton
                key={day.date}
                day={day}
                onPress={handleSelectDate}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MonthNavButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: 'chevron-back' | 'chevron-forward';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navButton,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.textSecondaryLight} />
    </Pressable>
  );
}

function CalendarDayButton({
  day,
  onPress,
}: {
  day: TodayCalendarDay;
  onPress: (date: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={day.date}
      accessibilityState={{ selected: day.isSelected }}
      onPress={() => onPress(day.date)}
      style={({ pressed }) => [
        styles.dayButton,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.dayNumberCircle,
          day.isToday && !day.isSelected && styles.todayCircle,
          day.isSelected && styles.selectedCircle,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            !day.inCurrentMonth && styles.outsideMonthDayNumber,
            day.isSelected && styles.selectedDayNumber,
          ]}
        >
          {day.dayNumber}
        </Text>
      </View>
    </Pressable>
  );
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
    paddingBottom: spacing[8],
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
    flex: 1,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  weekdayLabel: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textTertiaryLight,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  todayCircle: {
    borderWidth: 1.5,
    borderColor: colors.textPrimaryLight,
  },
  selectedCircle: {
    backgroundColor: colors.textPrimaryLight,
  },
  dayNumber: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textPrimaryLight,
    fontVariant: ['tabular-nums'],
  },
  outsideMonthDayNumber: {
    color: colors.textTertiaryLight,
  },
  selectedDayNumber: {
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
  pressed: {
    opacity: 0.7,
  },
});
