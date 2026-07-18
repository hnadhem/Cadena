import dayjs from 'dayjs';
import { EnabledModule } from '../constants/enums';
import { getEffectiveDate, resolveLogicalDate } from './dateUtils';
import type {
  TodayHabitItem,
  TodayQuickAction,
  TodayQuickActionKind,
} from '../types/today';
import type { EnabledModule as EnabledModuleType } from '../constants/enums';

export interface TodayHabitCompletionSummary {
  completedHabitCount: number;
  totalVisibleHabitCount: number;
}

export interface TodayDateLabels {
  title: string;
  subtitle: string;
}

interface FormatTodayDateOptions {
  currentDate?: Date | string;
  dayEndTime?: string;
  timezone?: string;
}

const DEFAULT_QUICK_ACTIONS: TodayQuickAction[] = [
  { kind: 'checkIn', label: 'Check-in' },
  { kind: 'nutrition', label: 'Nutrition' },
  { kind: 'tally', label: 'Tally' },
];

const MEDICATION_QUICK_ACTION: TodayQuickAction = {
  kind: 'medication',
  label: 'Medication',
};

export function getTodayHabitCompletionSummary(
  habitItems: readonly TodayHabitItem[]
): TodayHabitCompletionSummary {
  return {
    completedHabitCount: habitItems.filter((item) => item.status === 'completed').length,
    totalVisibleHabitCount: habitItems.length,
  };
}

export function sortTodayHabitItems(
  habitItems: readonly TodayHabitItem[]
): TodayHabitItem[] {
  return [...habitItems].sort(compareTodayHabitItems);
}

export function compareTodayHabitItems(
  a: TodayHabitItem,
  b: TodayHabitItem
): number {
  const aGroup = getHabitSortGroup(a);
  const bGroup = getHabitSortGroup(b);

  if (aGroup !== bGroup) return aGroup - bGroup;

  if (aGroup === 0) {
    const timeCompare = compareOptionalStrings(a.scheduledTime, b.scheduledTime);
    if (timeCompare !== 0) return timeCompare;
  }

  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;

  return a.title.localeCompare(b.title);
}

export function getVisibleTodayQuickActions(
  modulesEnabled?: readonly EnabledModuleType[] | null
): TodayQuickAction[] {
  const actions = [...DEFAULT_QUICK_ACTIONS];

  if (modulesEnabled?.includes(EnabledModule.MEDICATIONS)) {
    actions.splice(2, 0, MEDICATION_QUICK_ACTION);
  }

  return actions;
}

export function isTodayQuickActionVisible(
  kind: TodayQuickActionKind,
  modulesEnabled?: readonly EnabledModuleType[] | null
): boolean {
  return getVisibleTodayQuickActions(modulesEnabled).some((action) => action.kind === kind);
}

export function formatTodayDateLabels(
  selectedDate: dayjs.ConfigType,
  options: FormatTodayDateOptions = {}
): TodayDateLabels {
  return {
    title: formatTodayTitle(selectedDate, options),
    subtitle: formatTodaySubtitle(selectedDate),
  };
}

export function formatTodayTitle(
  selectedDate: dayjs.ConfigType,
  options: FormatTodayDateOptions = {}
): string {
  const selected = dayjs(selectedDate).startOf('day');
  const currentLogicalDate = resolveTodayCurrentLogicalDate(options);
  const dayDiff = selected.diff(currentLogicalDate, 'day');

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff === -1) return 'Yesterday';

  return selected.format('dddd');
}

export function formatTodaySubtitle(selectedDate: dayjs.ConfigType): string {
  return dayjs(selectedDate).format('MMM D');
}

function getHabitSortGroup(item: TodayHabitItem): number {
  if (item.scheduledTime) return 0;
  if (item.status === 'completed') return 2;
  return 1;
}

function resolveTodayCurrentLogicalDate(options: FormatTodayDateOptions): dayjs.Dayjs {
  if (options.timezone) {
    const currentDate = options.currentDate ?? new Date();
    const logicalDate = resolveLogicalDate(
      currentDate,
      options.timezone,
      options.dayEndTime ?? '00:00'
    );

    return dayjs(logicalDate).startOf('day');
  }

  return getEffectiveDate(options.currentDate ?? new Date(), options.dayEndTime);
}

function compareOptionalStrings(a?: string, b?: string): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a.localeCompare(b);
}
