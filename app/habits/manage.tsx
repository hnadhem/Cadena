import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FrequencyType } from '../../constants/enums';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import {
  archiveHabit,
  createHabit,
  listHabits,
  unarchiveHabit,
  updateHabit,
} from '../../services/habitService';
import { useUserStore } from '../../store/userStore';
import type { Habit } from '../../types/schema';
import { currentLogicalDate } from '../../utils/dateUtils';

export default function ManageHabitsScreen() {
  const userId = useUserStore((state) => state.userId);
  const timezone = useUserStore((state) => state.timezone);
  const preferences = useUserStore((state) => state.preferences);
  const dayEndTime = preferences?.dayEndTime ?? '00:00';
  const weekStartDay = preferences?.weekStartDay ?? 0;
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPersistedHabits = useCallback(async () => {
    if (!userId) {
      setHabits([]);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      setHabits(await listHabits(userId));
    } catch (err) {
      console.error('Failed to load habits:', err);
      setError('Habits could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadPersistedHabits();
  }, [loadPersistedHabits]);

  const handleCreateHabit = useCallback(async () => {
    const name = newHabitName.trim();

    if (!userId || name.length === 0) {
      return;
    }

    setSaving(true);

    try {
      await createHabit({
        userId,
        name,
        isHidden: false,
        trackEffort: false,
        startDate: currentLogicalDate(timezone, dayEndTime),
        allowMultiplePerDay: false,
        displayOrder: habits.length,
        isPinned: false,
        target: {
          frequencyType: FrequencyType.DAILY,
          weekStartDay,
          habitType: 'binary',
        },
      });
      setNewHabitName('');
      await loadPersistedHabits();
    } catch (err) {
      console.error('Failed to create habit:', err);
      Alert.alert('Could not create habit', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [
    dayEndTime,
    habits.length,
    loadPersistedHabits,
    newHabitName,
    timezone,
    userId,
    weekStartDay,
  ]);

  const startEditing = useCallback((habit: Habit) => {
    setEditingHabitId(habit.id);
    setEditingName(habit.name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingHabitId(null);
    setEditingName('');
  }, []);

  const handleSaveName = useCallback(
    async (habitId: string) => {
      const name = editingName.trim();

      if (name.length === 0) {
        return;
      }

      setSaving(true);

      try {
        await updateHabit(habitId, { name });
        cancelEditing();
        await loadPersistedHabits();
      } catch (err) {
        console.error('Failed to update habit:', err);
        Alert.alert('Could not update habit', getErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [cancelEditing, editingName, loadPersistedHabits]
  );

  const handleToggleHidden = useCallback(
    async (habit: Habit) => {
      setSaving(true);

      try {
        await updateHabit(habit.id, { isHidden: !habit.isHidden });
        await loadPersistedHabits();
      } catch (err) {
        console.error('Failed to update habit visibility:', err);
        Alert.alert('Could not update habit', getErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [loadPersistedHabits]
  );

  const handleToggleArchived = useCallback(
    async (habit: Habit) => {
      setSaving(true);

      try {
        if (habit.archivedAt) {
          await unarchiveHabit(habit.id);
        } else {
          await archiveHabit(habit.id);
        }

        await loadPersistedHabits();
      } catch (err) {
        console.error('Failed to update habit archive state:', err);
        Alert.alert('Could not update habit', getErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [loadPersistedHabits]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Habits</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!userId && (
          <Text style={styles.emptyText}>No user is loaded.</Text>
        )}

        {userId && (
          <View style={styles.createRow}>
            <TextInput
              value={newHabitName}
              onChangeText={setNewHabitName}
              placeholder="Habit name"
              placeholderTextColor={colors.textTertiaryLight}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleCreateHabit();
              }}
            />
            <Button
              label="Create"
              onPress={() => {
                void handleCreateHabit();
              }}
              loading={saving}
              disabled={newHabitName.trim().length === 0}
            />
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.brand600} />
          </View>
        ) : (
          <View style={styles.list}>
            {habits.length === 0 && userId ? (
              <Text style={styles.emptyText}>No habits yet.</Text>
            ) : (
              habits.map((habit) => (
                <HabitListRow
                  key={habit.id}
                  habit={habit}
                  editing={editingHabitId === habit.id}
                  editingName={editingName}
                  saving={saving}
                  onChangeEditingName={setEditingName}
                  onStartEditing={startEditing}
                  onCancelEditing={cancelEditing}
                  onSaveName={handleSaveName}
                  onToggleHidden={handleToggleHidden}
                  onToggleArchived={handleToggleArchived}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HabitListRow({
  habit,
  editing,
  editingName,
  saving,
  onChangeEditingName,
  onStartEditing,
  onCancelEditing,
  onSaveName,
  onToggleHidden,
  onToggleArchived,
}: {
  habit: Habit;
  editing: boolean;
  editingName: string;
  saving: boolean;
  onChangeEditingName: (name: string) => void;
  onStartEditing: (habit: Habit) => void;
  onCancelEditing: () => void;
  onSaveName: (habitId: string) => Promise<void>;
  onToggleHidden: (habit: Habit) => Promise<void>;
  onToggleArchived: (habit: Habit) => Promise<void>;
}) {
  const statusText = getHabitStatusText(habit);

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        {editing ? (
          <TextInput
            value={editingName}
            onChangeText={onChangeEditingName}
            style={styles.input}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              void onSaveName(habit.id);
            }}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => onStartEditing(habit)}
            style={({ pressed }) => [styles.nameButton, pressed && styles.pressed]}
          >
            <Text style={styles.habitName}>{habit.name}</Text>
          </Pressable>
        )}
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      <View style={styles.actions}>
        {editing ? (
          <>
            <Button
              label="Save"
              onPress={() => {
                void onSaveName(habit.id);
              }}
              variant="secondary"
              disabled={saving || editingName.trim().length === 0}
            />
            <Button
              label="Cancel"
              onPress={onCancelEditing}
              variant="ghost"
              disabled={saving}
            />
          </>
        ) : (
          <>
            <Button
              label={habit.isHidden ? 'Show' : 'Hide'}
              onPress={() => {
                void onToggleHidden(habit);
              }}
              variant="secondary"
              disabled={saving}
            />
            <Button
              label={habit.archivedAt ? 'Unarchive' : 'Archive'}
              onPress={() => {
                void onToggleArchived(habit);
              }}
              variant="ghost"
              disabled={saving}
            />
          </>
        )}
      </View>
    </View>
  );
}

function getHabitStatusText(habit: Habit): string {
  const states: string[] = [];

  if (habit.isHidden) states.push('Hidden');
  if (habit.archivedAt) states.push('Archived');

  return states.length > 0 ? states.join(' / ') : 'Visible';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Try again later.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    minHeight: 80,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  content: {
    gap: spacing[4],
    padding: spacing[5],
    paddingBottom: spacing[12],
  },
  createRow: {
    gap: spacing[3],
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    fontSize: typography.size.base,
    color: colors.textPrimaryLight,
    backgroundColor: colors.surfaceLight,
  },
  centerState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing[3],
  },
  row: {
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLight,
  },
  rowMain: {
    gap: spacing[1],
  },
  nameButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  habitName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  statusText: {
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  emptyText: {
    fontSize: typography.size.base,
    color: colors.textSecondaryLight,
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.muted.missed,
  },
  pressed: {
    opacity: 0.7,
  },
});
