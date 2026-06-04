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
import { TodayFitnessCard } from '../../components/today/TodayFitnessCard';
import { TodayHabitRow } from '../../components/today/TodayHabitRow';
import { TodayHabitSummary } from '../../components/today/TodayHabitSummary';
import { TodayQuickActionRow } from '../../components/today/TodayQuickActionRow';
import { TodaySection } from '../../components/today/TodaySection';
import { Button } from '../../components/ui/Button';
import { colors, spacing, typography } from '../../constants/theme';
import {
  getTodayViewModel,
  moveTodayFitnessSessionToTomorrow,
  skipTodayFitnessSession,
} from '../../services/todayService';
import type { TodayFitnessItem, TodayViewModel } from '../../types/today';

export default function TodayScreen() {
  const [viewModel, setViewModel] = useState<TodayViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const loadToday = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const nextViewModel = await getTodayViewModel();
      setViewModel(nextViewModel);
    } catch (err) {
      console.error('Failed to load Today view model:', err);
      setError('Today could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

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

  return (
    <View style={styles.container}>
      <TodayHeader title={today?.title ?? 'Today'} subtitle={today?.subtitle ?? ''} />
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
              // TODO: Pass onPress when workout/cardio start, resume, and history routes exist.
              <TodayFitnessCard
                key={`${item.kind}-${item.id}`}
                item={item}
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
          <TodayHabitSummary
            completedHabitCount={today?.completedHabitCount ?? 0}
            totalVisibleHabitCount={today?.totalVisibleHabitCount ?? 0}
          />
          {today && today.habitItems.length > 0 ? (
            today.habitItems.map((item) => (
              // TODO: Pass onPress when persisted habit completion/edit/value flows exist.
              <TodayHabitRow key={item.id} item={item} />
            ))
          ) : (
            <Text style={styles.emptyText}>No visible habits for this day.</Text>
          )}
        </TodaySection>

        <TodaySection title="Quick actions">
          {/* TODO: Wire quick actions once check-in, nutrition, medication, and tally routes exist. */}
          <TodayQuickActionRow actions={today?.quickActions ?? []} />
        </TodaySection>
      </ScrollView>
    </View>
  );
}

function TodayHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle.length > 0 && <Text style={styles.subtitle}>{subtitle}</Text>}
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
});
