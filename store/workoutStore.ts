import { create } from 'zustand';
import type { WorkoutSession, SetLog } from '../types/schema';

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
  logSet: (set: SetLog) => void;
  advanceToNextSet: () => void;
  advanceToNextExercise: () => void;
  setProgressionIntent: (exerciseLogId: string, intent: 'up' | 'equal' | 'down') => void;
  completeSession: () => void;
  abandonSession: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  activeSession: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  restTimer: null,
  stagedSetInput: {},
  progressionIntentMap: {},

  startSession: (session) =>
    set({
      activeSession: session,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      restTimer: null,
      stagedSetInput: {},
      progressionIntentMap: {},
    }),

  logSet: (newSet) =>
    set((state) => {
      if (!state.activeSession) return state;
      const exercises = [...state.activeSession.exerciseLogs];
      const ex = { ...exercises[state.currentExerciseIndex] };
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

  completeSession: () =>
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: { ...state.activeSession, status: 'completed' },
      };
    }),

  abandonSession: () =>
    set({
      activeSession: null,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      restTimer: null,
      stagedSetInput: {},
      progressionIntentMap: {},
    }),
}));
