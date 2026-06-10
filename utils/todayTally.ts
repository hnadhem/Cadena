import type { TallyItem, TallyLog } from '../types/schema';

export interface TodayTallyItem {
  id: TallyItem['id'];
  name: TallyItem['name'];
  unit?: TallyItem['unit'];
  resetFrequency: TallyItem['resetFrequency'];
  displayOrder: TallyItem['displayOrder'];
  target?: number;
  periodLabel: string;
  initialCount: number;
}

export interface TodayTallyLogEntry {
  tallyItemId: TallyLog['tallyItemId'];
  periodStartDate: TallyLog['periodStartDate'];
  periodEndDate: TallyLog['periodEndDate'];
  count: TallyLog['count'];
}

export interface TodayTallyRow {
  item: TodayTallyItem;
  log: TodayTallyLogEntry;
}

export type TodayTallyLogsByDate = Record<string, Record<string, TodayTallyLogEntry>>;

export type TodayTallyUpdateResult =
  | { ok: true; tallyLogsByDate: TodayTallyLogsByDate; entry: TodayTallyLogEntry }
  | { ok: false; error: string };

export const TODAY_TALLY_VISIBLE_LIMIT = 2;

export const TODAY_TALLY_ITEMS = [
  {
    id: 'water',
    name: 'Water',
    unit: 'oz',
    resetFrequency: 'daily',
    displayOrder: 0,
    target: 64,
    periodLabel: 'today',
    initialCount: 32,
  },
  {
    id: 'pushUps',
    name: 'Push-ups',
    unit: 'reps',
    resetFrequency: 'daily',
    displayOrder: 1,
    target: 100,
    periodLabel: 'today',
    initialCount: 70,
  },
  {
    id: 'steps',
    name: 'Steps',
    unit: 'steps',
    resetFrequency: 'daily',
    displayOrder: 2,
    target: 8000,
    periodLabel: 'today',
    initialCount: 4200,
  },
  {
    id: 'reading',
    name: 'Reading',
    unit: 'pages',
    resetFrequency: 'daily',
    displayOrder: 3,
    target: 10,
    periodLabel: 'today',
    initialCount: 5,
  },
] as const satisfies readonly TodayTallyItem[];

export function getTodayTallyRowsForDate(
  tallyLogsByDate: TodayTallyLogsByDate,
  date: string,
  items: readonly TodayTallyItem[] = TODAY_TALLY_ITEMS
): TodayTallyRow[] {
  return [...items]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({
      item,
      log:
        tallyLogsByDate[date]?.[item.id] ??
        createTodayTallyLogEntry(date, item.id, item.initialCount),
    }));
}

export function incrementTodayTallyCount(
  tallyLogsByDate: TodayTallyLogsByDate,
  date: string,
  tallyItemId: string,
  items: readonly TodayTallyItem[] = TODAY_TALLY_ITEMS
): TodayTallyUpdateResult {
  return updateTodayTallyCount(tallyLogsByDate, date, tallyItemId, 1, items);
}

export function decrementTodayTallyCount(
  tallyLogsByDate: TodayTallyLogsByDate,
  date: string,
  tallyItemId: string,
  items: readonly TodayTallyItem[] = TODAY_TALLY_ITEMS
): TodayTallyUpdateResult {
  return updateTodayTallyCount(tallyLogsByDate, date, tallyItemId, -1, items);
}

export function getTodayTallyProgressPercent(
  count: number,
  target?: number
): number {
  if (target === undefined || target <= 0) return 0;

  return Math.min(100, Math.max(0, (count / target) * 100));
}

function updateTodayTallyCount(
  tallyLogsByDate: TodayTallyLogsByDate,
  date: string,
  tallyItemId: string,
  delta: number,
  items: readonly TodayTallyItem[]
): TodayTallyUpdateResult {
  const item = items.find((candidate) => candidate.id === tallyItemId);

  if (!item) {
    return { ok: false, error: 'Unknown tally item.' };
  }

  const currentEntry =
    tallyLogsByDate[date]?.[tallyItemId] ??
    createTodayTallyLogEntry(date, tallyItemId, item.initialCount);
  const nextEntry = {
    ...currentEntry,
    count: Math.max(0, currentEntry.count + delta),
  };

  return {
    ok: true,
    entry: nextEntry,
    tallyLogsByDate: {
      ...tallyLogsByDate,
      [date]: {
        ...(tallyLogsByDate[date] ?? {}),
        [tallyItemId]: nextEntry,
      },
    },
  };
}

function createTodayTallyLogEntry(
  date: string,
  tallyItemId: string,
  count: number
): TodayTallyLogEntry {
  return {
    tallyItemId,
    periodStartDate: date,
    periodEndDate: date,
    count: Math.max(0, count),
  };
}
