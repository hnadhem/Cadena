import { create } from 'zustand';
import type { WorkoutSession, ExerciseLog, SetLog } from '../types/schema';
import { getDb } from '../services/db';
import { useUserStore } from './userStore';
import { resolveLogicalDate } from '../utils/dateUtils';

interface RestTimer {
  active: boolean;
  totalSeconds: number;
  remainingSeconds: number;
}

interface WorkoutState {
  activeSession: WorkoutSession | null;
  currentExerciseIndex: number;
  currentSetIndex: number;
  restTimer: RestTimer | null;
  stagedSetInput: Partial<SetLog>;
  progressionIntentMap: Record<string, 'up' | 'equal' | 'down'>;
  startSession: (session: WorkoutSession) => void;
  updateStagedSetInput: (partial: Partial<SetLog>) => void;
  logSet: () => void;
  advanceToNextSet: () => void;
  advanceToNextExercise: () => void;
  setProgressionIntent: (exerciseLogId: string, intent: 'up' | 'equal' | 'down') => void;
  completeSession: () => Promise<void>;
  abandonSession: () => void;
  startRestTimer: (totalSeconds: number) => void;
  tickRestTimer: () => void;
  skipRestTimer: () => void;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const CLEARED: Pick<
  WorkoutState,
  | 'activeSession'
  | 'currentExerciseIndex'
  | 'currentSetIndex'
  | 'restTimer'
  | 'stagedSetInput'
  | 'progressionIntentMap'
> = {
  activeSession: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  restTimer: null,
  stagedSetInput: {},
  progressionIntentMap: {},
};

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  activeSession: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  restTimer: null,
  stagedSetInput: {},
  progressionIntentMap: {},

  startSession: (session) =>
    set({ ...CLEARED, activeSession: session }),

  updateStagedSetInput: (partial) =>
    set((state) => ({ stagedSetInput: { ...state.stagedSetInput, ...partial } })),

  logSet: () =>
    set((state) => {
      if (!state.activeSession) return state;
      const exercises = [...state.activeSession.exerciseLogs];
      const ex = { ...exercises[state.currentExerciseIndex] };
      const staged = state.stagedSetInput;
      const newSet: SetLog = {
        id: generateId(),
        exerciseLogId: ex.id,
        setNumber: ex.sets.length + 1,
        setType: staged.setType ?? 'normal',
        setMode: staged.setMode ?? ex.exerciseSetModeSnapshot,
        setDescriptor: staged.setDescriptor,
        setNote: staged.setNote,
        reps: staged.reps,
        weightLbs: staged.weightLbs,
        durationSeconds: staged.durationSeconds,
        restSeconds: staged.restSeconds,
        completedAt: staged.completedAt,
        attributeValues: staged.attributeValues,
      };
      ex.sets = [...ex.sets, newSet];
      exercises[state.currentExerciseIndex] = ex;
      return {
        activeSession: { ...state.activeSession, exerciseLogs: exercises },
        stagedSetInput: {},
      };
    }),

  advanceToNextSet: () =>
    set((state) => ({ currentSetIndex: state.currentSetIndex + 1 })),

  advanceToNextExercise: () =>
    set((state) => ({
      currentExerciseIndex: state.currentExerciseIndex + 1,
      currentSetIndex: 0,
      stagedSetInput: {},
    })),

  setProgressionIntent: (exerciseLogId, intent) =>
    set((state) => ({
      progressionIntentMap: { ...state.progressionIntentMap, [exerciseLogId]: intent },
    })),

  completeSession: async () => {
    const { activeSession, progressionIntentMap } = get();
    if (!activeSession) return;

    const now = new Date().toISOString();
    const startedAt = activeSession.startedAt ?? now;
    const { preferences, timezone } = useUserStore.getState();
    const workoutDate =
      activeSession.workoutDate ??
      resolveLogicalDate(startedAt, timezone, preferences?.dayEndTime ?? '00:00');
    const session: WorkoutSession = {
      ...activeSession,
      status: 'completed',
      startedAt,
      completedAt: now,
      workoutDate,
    };

    const exerciseLogs: ExerciseLog[] = session.exerciseLogs.map((ex) => ({
      ...ex,
      progressionIntent: progressionIntentMap[ex.id] ?? ex.progressionIntent,
    }));

    const db = getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO WorkoutSession (
          id, userId, templateId, scheduleId, name, templateNameSnapshot,
          status, scheduledDate, scheduledTime, startedAt, completedAt,
          loggedAt, isRetroactive, workoutDate, durationMinutes,
          durationOverridden, rpe, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.id,
        session.userId,
        session.templateId ?? null,
        session.scheduleId ?? null,
        session.name ?? null,
        session.templateNameSnapshot ?? null,
        session.status,
        session.scheduledDate ?? null,
        session.scheduledTime ?? null,
        session.startedAt ?? null,
        session.completedAt ?? null,
        session.loggedAt,
        session.isRetroactive ? 1 : 0,
        session.workoutDate ?? null,
        session.durationMinutes ?? null,
        session.durationOverridden ? 1 : 0,
        session.rpe ?? null,
        session.note ?? null
      );

      for (const ex of exerciseLogs) {
        await db.runAsync(
          `INSERT INTO ExerciseLog (
            id, sessionId, exerciseId, exerciseNameSnapshot,
            exerciseSetModeSnapshot, exerciseLoadTypeSnapshot,
            exerciseAttributesSnapshot, "order", groupId, groupType,
            note, progressionIntent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ex.id,
          ex.sessionId,
          ex.exerciseId,
          ex.exerciseNameSnapshot,
          ex.exerciseSetModeSnapshot,
          ex.exerciseLoadTypeSnapshot,
          ex.exerciseAttributesSnapshot ? JSON.stringify(ex.exerciseAttributesSnapshot) : null,
          ex.order,
          ex.groupId ?? null,
          ex.groupType ?? null,
          ex.note ?? null,
          ex.progressionIntent ?? null
        );

        for (const s of ex.sets) {
          await db.runAsync(
            `INSERT INTO SetLog (
              id, exerciseLogId, setNumber, setType, setDescriptor,
              setNote, setMode, reps, weightLbs, durationSeconds,
              restSeconds, completedAt, attributeValues
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            s.id,
            s.exerciseLogId,
            s.setNumber,
            s.setType,
            s.setDescriptor ?? null,
            s.setNote ?? null,
            s.setMode,
            s.reps ?? null,
            s.weightLbs ?? null,
            s.durationSeconds ?? null,
            s.restSeconds ?? null,
            s.completedAt ?? null,
            s.attributeValues ? JSON.stringify(s.attributeValues) : null
          );
        }
      }
    });

    set(CLEARED);
  },

  abandonSession: () => set(CLEARED),

  startRestTimer: (totalSeconds) =>
    set({ restTimer: { active: true, totalSeconds, remainingSeconds: totalSeconds } }),

  tickRestTimer: () =>
    set((state) => {
      if (!state.restTimer || !state.restTimer.active) return state;
      const remainingSeconds = state.restTimer.remainingSeconds - 1;
      return {
        restTimer: {
          ...state.restTimer,
          remainingSeconds,
          active: remainingSeconds > 0,
        },
      };
    }),

  skipRestTimer: () => set({ restTimer: null }),
}));
