import { create } from 'zustand';
import { AppMode } from '../constants/enums';
import type { UserPreferences } from '../types/schema';
import { getDeviceTimezone } from '../utils/dateUtils';

interface UserState {
  userId: string | null;
  timezone: string;
  appMode: AppMode;
  preferences: UserPreferences | null;
  setAppMode: (mode: AppMode) => void;
  setTimezone: (timezone: string) => void;
  setPreferences: (prefs: UserPreferences) => void;
  loadUser: (userId: string, prefs: UserPreferences, timezone?: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  timezone: getDeviceTimezone(),
  appMode: AppMode.COMBINED,
  preferences: null,

  setAppMode: (mode) => set({ appMode: mode }),

  setTimezone: (timezone) => set({ timezone }),

  setPreferences: (prefs) =>
    set({ preferences: prefs, appMode: prefs.appMode }),

  loadUser: (userId, prefs, timezone) =>
    set({
      userId,
      timezone: timezone ?? getDeviceTimezone(),
      preferences: prefs,
      appMode: prefs.appMode,
    }),
}));
