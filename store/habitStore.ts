import { create } from 'zustand';
import type { Habit, HabitLog, HabitTarget } from '../types/schema';

interface HabitState {
  habits: Habit[];
  todayLogs: HabitLog[];
  habitTargets: HabitTarget[];
  loadHabits: (habits: Habit[], logs: HabitLog[], targets?: HabitTarget[]) => void;
  logHabit: (log: HabitLog) => void;
  updateLog: (updatedLog: HabitLog) => void;
  upsertLog: (log: HabitLog) => void;
  removeLog: (logId: string) => void;
}

export const useHabitStore = create<HabitState>((set) => ({
  habits: [],
  todayLogs: [],
  habitTargets: [],

  loadHabits: (habits, logs, targets = []) =>
    set({ habits, todayLogs: logs, habitTargets: targets }),

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

  upsertLog: (log) =>
    set((state) => {
      const existingIndex = state.todayLogs.findIndex((currentLog) => currentLog.id === log.id);

      if (existingIndex >= 0) {
        const todayLogs = [...state.todayLogs];
        todayLogs[existingIndex] = log;
        return { todayLogs };
      }

      const sameHabitDateIndex = state.todayLogs.findIndex(
        (currentLog) => currentLog.habitId === log.habitId && currentLog.date === log.date
      );

      if (sameHabitDateIndex >= 0) {
        const todayLogs = [...state.todayLogs];
        todayLogs[sameHabitDateIndex] = log;
        return { todayLogs };
      }

      return { todayLogs: [...state.todayLogs, log] };
    }),

  removeLog: (logId) =>
    set((state) => ({
      todayLogs: state.todayLogs.filter((log) => log.id !== logId),
    })),
}));
