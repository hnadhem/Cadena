import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
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
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors, radius, spacing, typography } from '../../constants/theme';
import type { ExerciseLog, WorkoutSession } from '../../types/schema';
import {
  MAX_WORKOUT_EXERCISES,
  addExerciseInSession,
  advanceExercise,
  completeSession,
  getLiveSession,
  getWorkoutSession,
  listWorkoutExerciseOptions,
  logSet,
  markExerciseComplete,
  removeExerciseInSession,
  startSession,
  unmarkExerciseComplete,
  type LiveWorkoutSession,
  type WorkoutExerciseOption,
  type WorkoutLiveState,
  type WorkoutLiveStateStatus,
} from '../../services/workoutSessionService';
import { useWorkoutStore } from '../../store/workoutStore';

interface SetDraft {
  reps: string;
  weightLbs: string;
  durationSeconds: string;
  restSeconds: string;
}

const EMPTY_SET_DRAFT: SetDraft = {
  reps: '',
  weightLbs: '',
  durationSeconds: '',
  restSeconds: '',
};

export default function WorkoutSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const resolvedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const hydrateLiveSession = useWorkoutStore((state) => state.hydrateLiveSession);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [liveState, setLiveState] = useState<WorkoutLiveState | null>(null);
  const [liveStateStatus, setLiveStateStatus] =
    useState<WorkoutLiveStateStatus>('valid');
  const [exerciseOptions, setExerciseOptions] = useState<WorkoutExerciseOption[]>([]);
  const [setDraft, setSetDraft] = useState<SetDraft>(EMPTY_SET_DRAFT);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!resolvedSessionId) {
      setError('Workout session was not found.');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const loadedSession = await getWorkoutSession(resolvedSessionId);

      if (!loadedSession) {
        setSession(null);
        setLiveState(null);
        setError('Workout session was not found.');
        return;
      }

      const options = await listWorkoutExerciseOptions(loadedSession.userId);
      setExerciseOptions(options);

      if (loadedSession.status === 'live') {
        const liveSession = await getLiveSession(loadedSession.userId);

        if (!liveSession || liveSession.session.id !== loadedSession.id) {
          setSession(loadedSession);
          setLiveState(null);
          setError('This workout is not the active live session.');
          return;
        }

        applyLiveSession(liveSession, hydrateLiveSession, {
          setSession,
          setLiveState,
          setLiveStateStatus,
        });
        return;
      }

      setSession(loadedSession);
      setLiveState(null);
      setLiveStateStatus('valid');
    } catch (err) {
      console.error('Failed to load workout session:', err);
      setError('Workout session could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [hydrateLiveSession, resolvedSessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const completedExerciseIds = useMemo(
    () => new Set(liveState?.completedExerciseIds ?? []),
    [liveState?.completedExerciseIds]
  );
  const currentExercise = session?.exerciseLogs[liveState?.currentExerciseIndex ?? 0];
  const canAddExercise =
    Boolean(session && session.status === 'live') &&
    (session?.exerciseLogs.length ?? 0) < MAX_WORKOUT_EXERCISES;

  const handleStart = useCallback(async () => {
    if (!session) return;
    setPending('start');

    try {
      const liveSession = await startSession(session.id);
      applyLiveSession(liveSession, hydrateLiveSession, {
        setSession,
        setLiveState,
        setLiveStateStatus,
      });
    } catch (err) {
      Alert.alert('Could not start workout', getErrorMessage(err));
    } finally {
      setPending(null);
    }
  }, [hydrateLiveSession, session]);

  const handleLogSet = useCallback(async () => {
    if (!session || !currentExercise) return;

    const parsedSet = parseSetDraft(setDraft, currentExercise);
    if (!parsedSet.ok) {
      Alert.alert('Could not log set', parsedSet.message);
      return;
    }

    setPending('logSet');

    try {
      await logSet(session.id, currentExercise.exerciseId, {
        ...parsedSet.value,
        exerciseLogId: currentExercise.id,
      });
      setSetDraft(EMPTY_SET_DRAFT);
      await loadSession();
    } catch (err) {
      Alert.alert('Could not log set', getErrorMessage(err));
    } finally {
      setPending(null);
    }
  }, [currentExercise, loadSession, session, setDraft]);

  const handleMarkDone = useCallback(async () => {
    if (!session || !currentExercise) return;
    setPending('mark');

    try {
      const liveSession = await markExerciseComplete(
        session.id,
        currentExercise.exerciseId
      );
      applyLiveSession(liveSession, hydrateLiveSession, {
        setSession,
        setLiveState,
        setLiveStateStatus,
      });
    } catch (err) {
      Alert.alert('Could not mark exercise done', getErrorMessage(err));
    } finally {
      setPending(null);
    }
  }, [currentExercise, hydrateLiveSession, session]);

  const handleUnmark = useCallback(
    async (exercise: ExerciseLog) => {
      if (!session) return;
      setPending(`unmark:${exercise.id}`);

      try {
        const liveSession = await unmarkExerciseComplete(
          session.id,
          exercise.exerciseId
        );
        applyLiveSession(liveSession, hydrateLiveSession, {
          setSession,
          setLiveState,
          setLiveStateStatus,
        });
      } catch (err) {
        Alert.alert('Could not unmark exercise', getErrorMessage(err));
      } finally {
        setPending(null);
      }
    },
    [hydrateLiveSession, session]
  );

  const handleAdvance = useCallback(async () => {
    if (!session) return;
    setPending('advance');

    try {
      const liveSession = await advanceExercise(session.id);
      applyLiveSession(liveSession, hydrateLiveSession, {
        setSession,
        setLiveState,
        setLiveStateStatus,
      });
    } catch (err) {
      Alert.alert('Could not advance exercise', getErrorMessage(err));
    } finally {
      setPending(null);
    }
  }, [hydrateLiveSession, session]);

  const handleAddExercise = useCallback(
    async (exerciseId: string) => {
      if (!session || !canAddExercise) return;
      setPending(`add:${exerciseId}`);

      try {
        const liveSession = await addExerciseInSession(session.id, exerciseId);
        applyLiveSession(liveSession, hydrateLiveSession, {
          setSession,
          setLiveState,
          setLiveStateStatus,
        });
      } catch (err) {
        Alert.alert('Could not add exercise', getErrorMessage(err));
      } finally {
        setPending(null);
      }
    },
    [canAddExercise, hydrateLiveSession, session]
  );

  const handleRemoveExercise = useCallback(
    async (index: number) => {
      if (!session) return;
      setPending(`remove:${index}`);

      try {
        const liveSession = await removeExerciseInSession(session.id, index);
        applyLiveSession(liveSession, hydrateLiveSession, {
          setSession,
          setLiveState,
          setLiveStateStatus,
        });
      } catch (err) {
        Alert.alert('Could not remove exercise', getErrorMessage(err));
      } finally {
        setPending(null);
      }
    },
    [hydrateLiveSession, session]
  );

  const handleFinish = useCallback(async () => {
    if (!session) return;
    setPending('finish');

    try {
      const completed = await completeSession(session.id);
      setSession(completed);
      setLiveState(null);
      setLiveStateStatus('valid');
      setEditMode(false);
    } catch (err) {
      Alert.alert('Could not finish workout', getErrorMessage(err));
    } finally {
      setPending(null);
    }
  }, [session]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Workout' }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Workout' }} />
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error ?? 'Workout session was not found.'}</Text>
          <Button label="Retry" onPress={() => void loadSession()} variant="secondary" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: session.name ?? session.templateNameSnapshot ?? 'Workout' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{session.name ?? session.templateNameSnapshot ?? 'Workout'}</Text>
            <Text style={styles.subtitle}>{formatSessionStatus(session)}</Text>
          </View>
          {session.status === 'live' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editMode ? 'Done editing workout' : 'Edit workout exercises'}
              hitSlop={8}
              onPress={() => setEditMode((value) => !value)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={editMode ? 'checkmark' : 'create-outline'}
                size={22}
                color={colors.textPrimaryLight}
              />
            </Pressable>
          )}
        </View>

        {session.status === 'planned' && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Ready</Text>
            <Text style={styles.bodyText}>Start this workout to begin logging sets.</Text>
            <Button
              label="Start workout"
              onPress={() => void handleStart()}
              loading={pending === 'start'}
            />
          </Card>
        )}

        {session.status === 'live' && liveState && (
          <>
            {liveStateStatus !== 'valid' && (
              <Text style={styles.inlineNote}>
                Resume state was reset; logged sets are still preserved.
              </Text>
            )}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Current exercise</Text>
              {currentExercise ? (
                <>
                  <Text style={styles.exerciseTitle}>
                    {liveState.currentExerciseIndex + 1}. {currentExercise.exerciseNameSnapshot}
                  </Text>
                  <Text style={styles.bodyText}>
                    {completedExerciseIds.has(currentExercise.exerciseId)
                      ? 'Marked done'
                      : 'Not marked done'}
                  </Text>
                  <SetLogList exercise={currentExercise} />
                  <SetInputs
                    exercise={currentExercise}
                    draft={setDraft}
                    onChange={setSetDraft}
                  />
                  <View style={styles.buttonRow}>
                    <Button
                      label="Log set"
                      onPress={() => void handleLogSet()}
                      loading={pending === 'logSet'}
                      variant="secondary"
                    />
                    <Button
                      label="Mark done"
                      onPress={() => void handleMarkDone()}
                      loading={pending === 'mark'}
                      disabled={completedExerciseIds.has(currentExercise.exerciseId)}
                    />
                  </View>
                  <Button
                    label="Advance"
                    onPress={() => void handleAdvance()}
                    loading={pending === 'advance'}
                    variant="secondary"
                  />
                </>
              ) : (
                <Text style={styles.bodyText}>No exercises in this workout.</Text>
              )}
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              {session.exerciseLogs.length === 0 ? (
                <Text style={styles.bodyText}>No exercises added.</Text>
              ) : (
                session.exerciseLogs.map((exercise, index) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                    active={index === liveState.currentExerciseIndex}
                    completed={completedExerciseIds.has(exercise.exerciseId)}
                    editMode={editMode}
                    pending={pending}
                    onUnmark={handleUnmark}
                    onRemove={handleRemoveExercise}
                  />
                ))
              )}
            </Card>

            {editMode && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Add exercise</Text>
                {!canAddExercise && (
                  <Text style={styles.inlineNote}>
                    Workouts are limited to 20 exercises.
                  </Text>
                )}
                {exerciseOptions.length === 0 ? (
                  <Text style={styles.bodyText}>No exercise library items available.</Text>
                ) : (
                  exerciseOptions.map((option) => (
                    <Button
                      key={option.id}
                      label={`Add ${option.name}`}
                      onPress={() => void handleAddExercise(option.id)}
                      disabled={!canAddExercise}
                      loading={pending === `add:${option.id}`}
                      variant="secondary"
                    />
                  ))
                )}
              </Card>
            )}

            <Button
              label="Finish workout"
              onPress={() => void handleFinish()}
              loading={pending === 'finish'}
            />
          </>
        )}

        {session.status === 'completed' && <WorkoutSummary session={session} />}

        {session.status === 'skipped' && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Skipped</Text>
            <Text style={styles.bodyText}>This workout was skipped.</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function applyLiveSession(
  liveSession: LiveWorkoutSession,
  hydrateLiveSession: (liveSession: LiveWorkoutSession) => void,
  setters: {
    setSession: (session: WorkoutSession) => void;
    setLiveState: (liveState: WorkoutLiveState) => void;
    setLiveStateStatus: (status: WorkoutLiveStateStatus) => void;
  }
): void {
  hydrateLiveSession(liveSession);
  setters.setSession(liveSession.session);
  setters.setLiveState(liveSession.liveState);
  setters.setLiveStateStatus(liveSession.liveStateStatus);
}

function SetInputs({
  exercise,
  draft,
  onChange,
}: {
  exercise: ExerciseLog;
  draft: SetDraft;
  onChange: (draft: SetDraft) => void;
}) {
  return (
    <View style={styles.inputGrid}>
      {exercise.exerciseSetModeSnapshot === 'reps' ? (
        <>
          <LabeledInput
            label="Reps"
            value={draft.reps}
            onChangeText={(value) => onChange({ ...draft, reps: value })}
          />
          <LabeledInput
            label="Weight"
            value={draft.weightLbs}
            onChangeText={(value) => onChange({ ...draft, weightLbs: value })}
          />
        </>
      ) : (
        <LabeledInput
          label="Seconds"
          value={draft.durationSeconds}
          onChangeText={(value) => onChange({ ...draft, durationSeconds: value })}
        />
      )}
      <LabeledInput
        label="Rest"
        value={draft.restSeconds}
        onChangeText={(value) => onChange({ ...draft, restSeconds: value })}
      />
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        style={styles.input}
      />
    </View>
  );
}

function SetLogList({ exercise }: { exercise: ExerciseLog }) {
  if (exercise.sets.length === 0) {
    return <Text style={styles.bodyText}>No sets logged.</Text>;
  }

  return (
    <View style={styles.setList}>
      {exercise.sets.map((setLog) => (
        <Text key={setLog.id} style={styles.setText}>
          Set {setLog.setNumber}: {formatSet(setLog)}
        </Text>
      ))}
    </View>
  );
}

function ExerciseRow({
  exercise,
  index,
  active,
  completed,
  editMode,
  pending,
  onUnmark,
  onRemove,
}: {
  exercise: ExerciseLog;
  index: number;
  active: boolean;
  completed: boolean;
  editMode: boolean;
  pending: string | null;
  onUnmark: (exercise: ExerciseLog) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={[styles.exerciseRow, active && styles.activeExerciseRow]}>
      <View style={styles.exerciseRowText}>
        <Text style={styles.exerciseRowTitle}>
          {index + 1}. {exercise.exerciseNameSnapshot}
        </Text>
        <Text style={styles.exerciseRowMeta}>
          {completed ? 'Done' : 'Open'} - {exercise.sets.length} sets
        </Text>
      </View>
      {completed && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Unmark ${exercise.exerciseNameSnapshot}`}
          disabled={pending === `unmark:${exercise.id}`}
          onPress={() => onUnmark(exercise)}
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
        >
          <Text style={styles.smallButtonText}>Unmark</Text>
        </Pressable>
      )}
      {editMode && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.exerciseNameSnapshot}`}
          disabled={pending === `remove:${index}`}
          onPress={() => onRemove(index)}
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
        >
          <Text style={styles.smallButtonText}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
}

function WorkoutSummary({ session }: { session: WorkoutSession }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <Text style={styles.bodyText}>
        Completed {session.completedAt ? formatTimestamp(session.completedAt) : ''}
      </Text>
      {session.exerciseLogs.length === 0 ? (
        <Text style={styles.bodyText}>No exercises logged.</Text>
      ) : (
        session.exerciseLogs.map((exercise) => (
          <View key={exercise.id} style={styles.summaryExercise}>
            <Text style={styles.exerciseRowTitle}>{exercise.exerciseNameSnapshot}</Text>
            <SetLogList exercise={exercise} />
          </View>
        ))
      )}
    </Card>
  );
}

function parseSetDraft(
  draft: SetDraft,
  exercise: ExerciseLog
):
  | {
      ok: true;
      value: {
        reps?: number;
        weightLbs?: number;
        durationSeconds?: number;
        restSeconds?: number;
      };
    }
  | { ok: false; message: string } {
  const restSeconds = parseOptionalNumber(draft.restSeconds, 'Rest');

  if (!restSeconds.ok) return restSeconds;

  if (exercise.exerciseSetModeSnapshot === 'duration') {
    const durationSeconds = parseRequiredNumber(draft.durationSeconds, 'Seconds');
    if (!durationSeconds.ok) return durationSeconds;

    return {
      ok: true,
      value: {
        durationSeconds: durationSeconds.value,
        restSeconds: restSeconds.value,
      },
    };
  }

  const reps = parseRequiredNumber(draft.reps, 'Reps');
  if (!reps.ok) return reps;
  const weightLbs = parseOptionalNumber(draft.weightLbs, 'Weight');
  if (!weightLbs.ok) return weightLbs;

  return {
    ok: true,
    value: {
      reps: reps.value,
      weightLbs: weightLbs.value,
      restSeconds: restSeconds.value,
    },
  };
}

function parseRequiredNumber(
  value: string,
  label: string
): { ok: true; value: number } | { ok: false; message: string } {
  const parsed = parseOptionalNumber(value, label);

  if (!parsed.ok) return parsed;
  if (parsed.value === undefined) {
    return { ok: false, message: `${label} is required.` };
  }

  return { ok: true, value: parsed.value };
}

function parseOptionalNumber(
  value: string,
  label: string
): { ok: true; value?: number } | { ok: false; message: string } {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true };
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, message: `${label} must be a non-negative number.` };
  }

  return { ok: true, value: parsed };
}

function formatSessionStatus(session: WorkoutSession): string {
  if (session.status === 'planned') return 'Planned';
  if (session.status === 'live') return 'Live';
  if (session.status === 'completed') return 'Completed';
  return 'Skipped';
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function formatSet(setLog: ExerciseLog['sets'][number]): string {
  if (setLog.setMode === 'duration') {
    return `${setLog.durationSeconds ?? 0}s`;
  }

  const weight = setLog.weightLbs === undefined ? '' : ` @ ${setLog.weightLbs} lb`;
  return `${setLog.reps ?? 0} reps${weight}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Try again later.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    gap: spacing[4],
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
  headerRow: {
    minHeight: 44,
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
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
  },
  section: {
    gap: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  exerciseTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  bodyText: {
    fontSize: typography.size.base,
    color: colors.textSecondaryLight,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  inlineNote: {
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  errorText: {
    fontSize: typography.size.base,
    color: colors.muted.missed,
    textAlign: 'center',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  inputGroup: {
    minWidth: 96,
    flex: 1,
    gap: spacing[1],
  },
  inputLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondaryLight,
  },
  input: {
    minHeight: 42,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    fontSize: typography.size.base,
    color: colors.textPrimaryLight,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  setList: {
    gap: spacing[1],
  },
  setText: {
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  exerciseRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  activeExerciseRow: {
    backgroundColor: colors.neutral50,
  },
  exerciseRowText: {
    flex: 1,
    minWidth: 0,
  },
  exerciseRowTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  exerciseRowMeta: {
    marginTop: spacing[1],
    fontSize: typography.size.sm,
    color: colors.textSecondaryLight,
  },
  smallButton: {
    minHeight: 32,
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
  },
  smallButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  summaryExercise: {
    gap: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  pressed: {
    opacity: 0.7,
  },
});
