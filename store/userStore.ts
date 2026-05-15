import { create } from 'zustand';
import { AppMode } from '../constants/enums';
import type { UserPreferences } from '../types/schema';

interface UserState {
  userId: string | null;
  appMode: AppMode;
  preferences: UserPreferences | null;
  setAppMode: (mode: AppMode) => void;
  setPreferences: (prefs: UserPreferences) => void;
  loadUser: (userId: string, prefs: UserPreferences) => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  appMode: AppMode.COMBINED,
  preferences: null,

  setAppMode: (mode) => set({ appMode: mode }),

  setPreferences: (prefs) =>
    set({ preferences: prefs, appMode: prefs.appMode }),

  loadUser: (userId, prefs) =>
    set({ userId, preferences: prefs, appMode: prefs.appMode }),
}));
