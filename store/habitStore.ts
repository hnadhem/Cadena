import { create } from 'zustand';
import type { Habit, HabitLog } from '../types/schema';

interface HabitState {
  habits: Habit[];
  todayLogs: HabitLog[];
  loadHabits: (habits: Habit[], logs: HabitLog[]) => void;
  logHabit: (log: HabitLog) => void;
  updateLog: (updatedLog: HabitLog) => void;
}

export const useHabitStore = create<HabitState>((set) => ({
  habits: [],
  todayLogs: [],

  loadHabits: (habits, logs) => set({ habits, todayLogs: logs }),

  logHabit: (log) =>
    set((state) => ({
      todayLogs: [...state.todayLogs, log],
    })),

  updateLog: (updatedLog) =>
    set((state) => ({
      todayLogs: state.todayLogs.map((l) =>
        l.id === updatedLog.id ? updatedLog : l
      ),
    })),
}));
