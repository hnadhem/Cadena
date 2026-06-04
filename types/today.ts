export type TodayFitnessKind = 'workout' | 'cardio';

export type TodayFitnessStatus = 'planned' | 'live' | 'completed' | 'skipped';

export interface TodayFitnessItem {
  id: string;
  kind: TodayFitnessKind;
  status: TodayFitnessStatus;
  title: string;
  subtitle?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  templateId?: string;
  scheduleId?: string;
  startedAt?: string;
  completedAt?: string;
}

export type TodayHabitStatus = 'pending' | 'completed' | 'missed';

export interface TodayHabitItem {
  id: string;
  habitId: string;
  title: string;
  subtitle?: string;
  status: TodayHabitStatus;
  displayOrder: number;
  scheduledTime?: string;
  completedAt?: string;
  value?: number;
  targetValue?: number;
  targetUnit?: string;
}

export type TodayQuickActionKind = 'checkIn' | 'nutrition' | 'medication' | 'tally';

export interface TodayQuickAction {
  kind: TodayQuickActionKind;
  label: string;
}

export interface TodayViewModel {
  selectedDate: string;
  title: string;
  subtitle: string;
  fitnessItems: TodayFitnessItem[];
  habitItems: TodayHabitItem[];
  completedHabitCount: number;
  totalVisibleHabitCount: number;
  quickActions: TodayQuickAction[];
}
