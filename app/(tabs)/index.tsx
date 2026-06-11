import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RelativePathString } from 'expo-router';
import { TodayFitnessCard } from '../../components/today/TodayFitnessCard';
import { TodayHabitRow } from '../../components/today/TodayHabitRow';
import { TodayHabitSummary } from '../../components/today/TodayHabitSummary';
import { TodayHabitValueSheet } from '../../components/today/TodayHabitValueSheet';
import { TodayCheckInSheet } from '../../components/today/TodayCheckInSheet';
import { TodayCalendarSheet } from '../../components/today/TodayCalendarSheet';
import { TodayQuickActionRow } from '../../components/today/TodayQuickActionRow';
import { TodaySection } from '../../components/today/TodaySection';
import { TodayTallySheet } from '../../components/today/TodayTallySheet';
import { Button } from '../../components/ui/Button';
import { colors, spacing, typography } from '../../constants/theme';
import {
  completeTodayHabit,
  getTodayViewModel,
  moveTodayFitnessSessionToTomorrow,
  saveTodayHabitValue,
  skipTodayFitnessSession,
  undoTodayHabitCompletion,
} from '../../services/todayService';
import type {
  TodayFitnessItem,
  TodayHabitItem,
  TodayQuickAction,
  TodayViewModel,
} from '../../types/today';
import { useUserStore } from '../../store/userStore';
import {
  hasTodayCheckIn,
  saveTodayCheckInByDate,
  type TodayCheckInDraft,
  type TodayCheckInsByDate,
} from '../../utils/todayCheckIn';
import {
  decrementTodayTallyCount,
  getTodayTallyRowsForDate,
  incrementTodayTallyCount,
  type TodayTallyLogsByDate,
} from '../../utils/todayTally';

const HABIT_UNDO_WINDOW_MS = 5000;

interface HabitUndoState {
  logId: string;
  habitTitle: string;
  expiresAt: number;
}

export default function TodayScreen() {
  const weekStartDay = useUserStore(
    (state) => state.preferences?.weekStartDay ?? 0
  );
  const [viewModel, setViewModel] = useState<TodayViewModel | null>(null);
  const [selectedDateOverride, setSelectedDateOverride] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [checkInsByDate, setCheckInsByDate] = useState<TodayCheckInsByDate>({});
  const [checkInSheetVisible, setCheckInSheetVisible] = useState(false);
  const [tallyLogsByDate, setTallyLogsByDate] = useState<TodayTallyLogsByDate>({});
  const [tallySheetVisible, setTallySheetVisible] = useState(false);
  const [calendarSheetVisible, setCalendarSheetVisible] = useState(false);
  const [habitValueItem, setHabitValueItem] = useState<TodayHabitItem | null>(null);
  const [habitUndo, setHabitUndo] = useState<HabitUndoState | null>(null);
  const [habitUndoNow, setHabitUndoNow] = useState(() => Date.now());
  const habitUndoExpiresAt = habitUndo?.expiresAt;

  const loadToday = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const nextViewModel = await getTodayViewModel(
        selectedDateOverride ? { selectedDate: selectedDateOverride } : undefined
      );
      setViewModel(nextViewModel);
    } catch (err) {
      console.error('Failed to load Today view model:', err);
      setError('Today could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDateOverride]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  useEffect(() => {
    if (habitUndoExpiresAt === undefined) return undefined;

    setHabitUndoNow(Date.now());

    const interval = setInterval(() => {
      const now = Date.now();
      setHabitUndoNow(now);
      setHabitUndo((currentUndo) => {
        if (!currentUndo || now < currentUndo.expiresAt) return currentUndo;
        return null;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [habitUndoExpiresAt]);

  const refreshToday = useCallback(() => {
    setRefreshing(true);
    void loadToday(false);
  }, [loadToday]);

  const handleSkipSession = useCallback(
    async (item: TodayFitnessItem) => {
      const actionKey = getFitnessActionKey(item);
      setPendingActionKey(actionKey);

      try {
        const result = await skipTodayFitnessSession(item.kind, item.id);
        if (!result.ok) {
          Alert.alert('Could not skip session', result.message);
        }
        await loadToday(false);
      } catch (err) {
        console.error('Failed to skip session:', err);
        Alert.alert('Could not skip session', 'Try again later.');
      } finally {
        setPendingActionKey(null);
      }
    },
    [loadToday]
  );

  const handleMoveSession = useCallback(
    async (item: TodayFitnessItem) => {
      const actionKey = getFitnessActionKey(item);
      setPendingActionKey(actionKey);

      try {
        const result = await moveTodayFitnessSessionToTomorrow(
          item.kind,
          item.id,
          viewModel?.selectedDate ?? new Date()
        );
        if (!result.ok) {
          Alert.alert('Could not move session', result.message);
        }
        await loadToday(false);
      } catch (err) {
        console.error('Failed to move session:', err);
        Alert.alert('Could not move session', 'Try again later.');
      } finally {
        setPendingActionKey(null);
      }
    },
    [loadToday, viewModel?.selectedDate]
  );

  const handleFitnessPress = useCallback((item: TodayFitnessItem) => {
    const sessionRoute =
      item.kind === 'workout'
        ? (`../workout/${item.id}` as RelativePathString)
        : (`../cardio/${item.id}` as RelativePathString);

    router.push(sessionRoute);
  }, []);

  const showHabitUndo = useCallback((logId: string, habitTitle: string) => {
    setHabitUndo({
      logId,
      habitTitle,
      expiresAt: Date.now() + HABIT_UNDO_WINDOW_MS,
    });
  }, []);

  const handleHabitClear = useCallback(
    async (item: TodayHabitItem) => {
      const result = undoTodayHabitCompletion(item.id);

      if (!result.ok) {
        Alert.alert('Could not clear habit', result.message);
        return;
      }

      setHabitUndo(null);
      await loadToday(false);
    },
    [loadToday]
  );

  const handleHabitPress = useCallback(
    async (item: TodayHabitItem) => {
      if (item.habitType === 'measurable') {
        setHabitValueItem(item);
        return;
      }

      if (item.status === 'completed') {
        Alert.alert(item.title, 'Habit is marked done.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => {
              void handleHabitClear(item);
            },
          },
        ]);
        return;
      }

      const selectedDate = viewModel?.selectedDate;
      if (!selectedDate) return;

      const result = completeTodayHabit(item.habitId, selectedDate);

      if (!result.ok) {
        Alert.alert('Could not complete habit', result.message);
        return;
      }

      showHabitUndo(result.log.id, item.title);
      await loadToday(false);
    },
    [handleHabitClear, loadToday, showHabitUndo, viewModel?.selectedDate]
  );

  const handleHabitValueClose = useCallback(() => {
    setHabitValueItem(null);
  }, []);

  const handleHabitValueSave = useCallback(
    async (value: number) => {
      const selectedDate = viewModel?.selectedDate;
      const item = habitValueItem;
      if (!selectedDate || !item) return;

      const result = saveTodayHabitValue(item.habitId, selectedDate, value);

      if (!result.ok) {
        Alert.alert('Could not save habit value', result.message);
        return;
      }

      setHabitValueItem(null);

      if (result.log.completed) {
        showHabitUndo(result.log.id, item.title);
      } else {
        setHabitUndo(null);
      }

      await loadToday(false);
    },
    [habitValueItem, loadToday, showHabitUndo, viewModel?.selectedDate]
  );

  const handleHabitUndo = useCallback(async () => {
    if (!habitUndo) return;

    const result = undoTodayHabitCompletion(habitUndo.logId);

    if (!result.ok) {
      Alert.alert('Could not undo habit', result.message);
      setHabitUndo(null);
      return;
    }

    setHabitUndo(null);
    await loadToday(false);
  }, [habitUndo, loadToday]);

  const handleQuickActionPress = useCallback((action: TodayQuickAction) => {
    switch (action.kind) {
      case 'checkIn':
        setCheckInSheetVisible(true);
        break;
      case 'nutrition':
        router.push('../nutrition');
        break;
      case 'medication':
        router.push('../medication');
        break;
      case 'tally':
        setTallySheetVisible(true);
        break;
    }
  }, []);

  const handleCalendarClose = useCallback(() => {
    setCalendarSheetVisible(false);
  }, []);

  const handleCalendarDateSelect = useCallback((date: string) => {
    setSelectedDateOverride(date);
  }, []);

  const handleCheckInClose = useCallback(() => {
    setCheckInSheetVisible(false);
  }, []);

  const handleCheckInSave = useCallback(
    (draft: TodayCheckInDraft) => {
      const selectedDate = viewModel?.selectedDate;
      if (!selectedDate) return;

      const result = saveTodayCheckInByDate(checkInsByDate, selectedDate, draft);
      if (!result.ok) {
        Alert.alert('Could not save check-in', result.error);
        return;
      }

      setCheckInsByDate(result.checkInsByDate);
      setCheckInSheetVisible(false);
    },
    [checkInsByDate, viewModel?.selectedDate]
  );

  const handleTallyClose = useCallback(() => {
    setTallySheetVisible(false);
  }, []);

  const handleTallyIncrement = useCallback(
    (tallyItemId: string) => {
      const selectedDate = viewModel?.selectedDate;
      if (!selectedDate) return;

      setTallyLogsByDate((currentLogs) => {
        const result = incrementTodayTallyCount(
          currentLogs,
          selectedDate,
          tallyItemId
        );
        if (!result.ok) {
          Alert.alert('Could not update tally', result.error);
          return currentLogs;
        }

        return result.tallyLogsByDate;
      });
    },
    [viewModel?.selectedDate]
  );

  const handleTallyUndoIncrement = useCallback(
    (tallyItemId: string) => {
      const selectedDate = viewModel?.selectedDate;
      if (!selectedDate) return;

      setTallyLogsByDate((currentLogs) => {
        const result = decrementTodayTallyCount(
          currentLogs,
          selectedDate,
          tallyItemId
        );
        if (!result.ok) {
          Alert.alert('Could not update tally', result.error);
          return currentLogs;
        }

        return result.tallyLogsByDate;
      });
    },
    [viewModel?.selectedDate]
  );

  if (loading && !viewModel) {
    return (
      <View style={styles.container}>
        <TodayHeader title="Today" subtitle="" />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.brand600} />
        </View>
      </View>
    );
  }

  if (error && !viewModel) {
    return (
      <View style={styles.container}>
        <TodayHeader title="Today" subtitle="" />
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Retry" onPress={() => void loadToday()} variant="secondary" />
        </View>
      </View>
    );
  }

  const today = viewModel;
  const selectedDate = today?.selectedDate ?? '';
  const hasSelectedDateCheckIn =
    selectedDate.length > 0 && hasTodayCheckIn(checkInsByDate, selectedDate);
  const checkedActionKinds: TodayQuickAction['kind'][] = hasSelectedDateCheckIn
    ? ['checkIn']
    : [];
  const tallyRows =
    selectedDate.length > 0
      ? getTodayTallyRowsForDate(tallyLogsByDate, selectedDate)
      : [];

  return (
    <View style={styles.container}>
      <TodayHeader
        title={today?.title ?? 'Today'}
        subtitle={today?.subtitle ?? ''}
        onDatePress={() => setCalendarSheetVisible(true)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshToday}
            tintColor={colors.brand600}
          />
        }
      >
        {error && <Text style={styles.inlineError}>{error}</Text>}

        <TodaySection title="Fitness">
          {today && today.fitnessItems.length > 0 ? (
            today.fitnessItems.map((item) => (
              <TodayFitnessCard
                key={`${item.kind}-${item.id}`}
                item={item}
                onPress={handleFitnessPress}
                actionPending={pendingActionKey === getFitnessActionKey(item)}
                onSkip={handleSkipSession}
                onMoveToTomorrow={handleMoveSession}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No fitness activity planned.</Text>
          )}
        </TodaySection>

        <TodaySection title="Habits">
          {habitUndo && (
            <HabitUndoBar
              habitTitle={habitUndo.habitTitle}
              secondsRemaining={Math.max(
                0,
                Math.ceil((habitUndo.expiresAt - habitUndoNow) / 1000)
              )}
              onUndo={handleHabitUndo}
            />
          )}
          <TodayHabitSummary
            completedHabitCount={today?.completedHabitCount ?? 0}
            totalVisibleHabitCount={today?.totalVisibleHabitCount ?? 0}
          />
          {today && today.habitItems.length > 0 ? (
            today.habitItems.map((item) => (
              <TodayHabitRow key={item.id} item={item} onPress={handleHabitPress} />
            ))
          ) : (
            <Text style={styles.emptyText}>No visible habits for this day.</Text>
          )}
        </TodaySection>

        <TodaySection title="Quick actions">
          <TodayQuickActionRow
            actions={today?.quickActions ?? []}
            checkedActionKinds={checkedActionKinds}
            onActionPress={handleQuickActionPress}
          />
        </TodaySection>
      </ScrollView>
      <TodayCheckInSheet
        visible={checkInSheetVisible}
        date={selectedDate}
        value={selectedDate.length > 0 ? checkInsByDate[selectedDate] : undefined}
        onClose={handleCheckInClose}
        onSave={handleCheckInSave}
      />
      <TodayTallySheet
        visible={tallySheetVisible}
        date={selectedDate}
        rows={tallyRows}
        onClose={handleTallyClose}
        onIncrement={handleTallyIncrement}
        onUndoIncrement={handleTallyUndoIncrement}
      />
      <TodayHabitValueSheet
        visible={Boolean(habitValueItem)}
        item={habitValueItem}
        onClose={handleHabitValueClose}
        onSave={handleHabitValueSave}
      />
      <TodayCalendarSheet
        visible={calendarSheetVisible}
        selectedDate={selectedDate}
        weekStartDay={weekStartDay}
        onClose={handleCalendarClose}
        onSelectDate={handleCalendarDateSelect}
      />
    </View>
  );
}

function HabitUndoBar({
  habitTitle,
  secondsRemaining,
  onUndo,
}: {
  habitTitle: string;
  secondsRemaining: number;
  onUndo: () => void;
}) {
  return (
    <View style={styles.habitUndoBar}>
      <Text style={styles.habitUndoText} numberOfLines={1}>
        {habitTitle} completed
      </Text>
      <Text style={styles.habitUndoCount}>{secondsRemaining}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Undo ${habitTitle} completion`}
        hitSlop={8}
        onPress={onUndo}
        style={({ pressed }) => [
          styles.habitUndoButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="arrow-undo-outline" size={20} color={colors.textPrimaryLight} />
      </Pressable>
    </View>
  );
}

function TodayHeader({
  title,
  subtitle,
  onDatePress,
}: {
  title: string;
  subtitle: string;
  onDatePress?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle.length > 0 && onDatePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose Today date"
            hitSlop={8}
            onPress={onDatePress}
            style={({ pressed }) => [
              styles.dateButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Ionicons
              name="chevron-down"
              size={13}
              color={colors.textSecondaryLight}
            />
          </Pressable>
        ) : (
          subtitle.length > 0 && <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        style={styles.settingsButton}
        hitSlop={8}
      >
        <Ionicons name="settings-outline" size={24} color={colors.textPrimaryLight} />
      </Pressable>
    </View>
  );
}

function getFitnessActionKey(item: TodayFitnessItem): string {
  return `${item.kind}:${item.id}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  headerSide: {
    width: 32,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  dateButton: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: 6,
  },
  settingsButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing[6],
    padding: spacing[4],
    paddingBottom: spacing[12],
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    padding: spacing[4],
  },
  errorText: {
    fontSize: typography.size.base,
    color: colors.muted.missed,
    textAlign: 'center',
  },
  inlineError: {
    fontSize: typography.size.sm,
    color: colors.muted.missed,
  },
  emptyText: {
    fontSize: typography.size.base,
    color: colors.textSecondaryLight,
  },
  habitUndoBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: 10,
    backgroundColor: colors.neutral100,
  },
  habitUndoText: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  habitUndoCount: {
    minWidth: 16,
    textAlign: 'right',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textTertiaryLight,
    fontVariant: ['tabular-nums'],
  },
  habitUndoButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
