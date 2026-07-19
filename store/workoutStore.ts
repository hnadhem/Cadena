import { create } from 'zustand';
import type { WorkoutSession, ExerciseLog, SetLog } from '../types/schema';
import {
  completeSessionFromSnapshot,
  type LiveWorkoutSession,
} from '../services/workoutSessionService';

interface RestTimer {
  active: boolean;
  totalSeconds: number;
  remainingSeconds: number;
}

interface WorkoutState {
  activeSession: WorkoutSession | null;
  currentExerciseIndex: number;
  currentSetIndex: number;
  completedExerciseIds: string[];
  restTimer: RestTimer | null;
  stagedSetInput: Partial<SetLog>;
  progressionIntentMap: Record<string, 'up' | 'equal' | 'down'>;
  startSession: (session: WorkoutSession) => void;
  hydrateLiveSession: (liveSession: LiveWorkoutSession) => void;
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
  | 'completedExerciseIds'
  | 'restTimer'
  | 'stagedSetInput'
  | 'progressionIntentMap'
> = {
  activeSession: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  completedExerciseIds: [],
  restTimer: null,
  stagedSetInput: {},
  progressionIntentMap: {},
};

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  activeSession: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  completedExerciseIds: [],
  restTimer: null,
  stagedSetInput: {},
  progressionIntentMap: {},

  startSession: (session) =>
    set({ ...CLEARED, activeSession: session }),

  hydrateLiveSession: (liveSession) =>
    set({
      ...CLEARED,
      activeSession: liveSession.session,
      currentExerciseIndex: liveSession.liveState.currentExerciseIndex,
      completedExerciseIds: liveSession.liveState.completedExerciseIds,
    }),

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

    const session: WorkoutSession = {
      ...activeSession,
      exerciseLogs: activeSession.exerciseLogs.map((ex): ExerciseLog => ({
        ...ex,
        progressionIntent: progressionIntentMap[ex.id] ?? ex.progressionIntent,
      })),
    };

    await completeSessionFromSnapshot(session);

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
