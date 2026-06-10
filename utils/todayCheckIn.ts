import { DailyTag } from '../constants/enums';
import type { DailyLog } from '../types/schema';

export type TodayCheckInMood = NonNullable<DailyLog['mood']>;

export interface TodayCheckInDraft {
  mood?: TodayCheckInMood;
  note: string;
  tags: DailyTag[];
}

export interface TodayCheckInEntry {
  date: string;
  mood?: TodayCheckInMood;
  note?: string;
  tags?: DailyTag[];
}

export type TodayCheckInsByDate = Record<string, TodayCheckInEntry>;

export type TodayCheckInValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export type TodayCheckInSaveResult =
  | { ok: true; checkInsByDate: TodayCheckInsByDate; entry: TodayCheckInEntry }
  | { ok: false; error: string };

export const TODAY_CHECK_IN_MOODS = [
  'great',
  'good',
  'okay',
  'bad',
  'terrible',
] as const satisfies readonly TodayCheckInMood[];

export const TODAY_CHECK_IN_PRIMARY_TAGS = [
  DailyTag.REST_DAY,
  DailyTag.POOR_SLEEP,
  DailyTag.SICK,
  DailyTag.BUSY,
] as const satisfies readonly DailyTag[];

export const TODAY_CHECK_IN_MORE_TAGS = [
  DailyTag.INJURED,
  DailyTag.TRAVELING,
  DailyTag.HIGH_STRESS,
  DailyTag.SOCIAL_EVENT,
] as const satisfies readonly DailyTag[];

export const TODAY_CHECK_IN_TAGS = [
  ...TODAY_CHECK_IN_PRIMARY_TAGS,
  ...TODAY_CHECK_IN_MORE_TAGS,
] as const satisfies readonly DailyTag[];

export const TODAY_CHECK_IN_TAG_LABELS: Record<DailyTag, string> = {
  [DailyTag.REST_DAY]: 'Rest day',
  [DailyTag.POOR_SLEEP]: 'Poor sleep',
  [DailyTag.SICK]: 'Sick',
  [DailyTag.BUSY]: 'Busy',
  [DailyTag.INJURED]: 'Injured',
  [DailyTag.TRAVELING]: 'Traveling',
  [DailyTag.HIGH_STRESS]: 'High stress',
  [DailyTag.SOCIAL_EVENT]: 'Social event',
};

const allowedMoods = new Set<TodayCheckInMood>(TODAY_CHECK_IN_MOODS);
const allowedTags = new Set<DailyTag>(TODAY_CHECK_IN_TAGS);

export function validateTodayCheckInDraft(
  draft: TodayCheckInDraft
): TodayCheckInValidationResult {
  if (draft.mood !== undefined && !allowedMoods.has(draft.mood)) {
    return { ok: false, error: 'Choose a valid mood.' };
  }

  const hasInvalidTag = draft.tags.some((tag) => !allowedTags.has(tag));
  if (hasInvalidTag) {
    return { ok: false, error: 'Choose only supported context tags.' };
  }

  return { ok: true };
}

export function saveTodayCheckInByDate(
  currentCheckIns: TodayCheckInsByDate,
  date: string,
  draft: TodayCheckInDraft
): TodayCheckInSaveResult {
  const validation = validateTodayCheckInDraft(draft);
  if (!validation.ok) {
    return validation;
  }

  const entry = normalizeTodayCheckInEntry(date, draft);

  return {
    ok: true,
    entry,
    checkInsByDate: {
      ...currentCheckIns,
      [date]: entry,
    },
  };
}

export function getTodayCheckInDraftForDate(
  checkInsByDate: TodayCheckInsByDate,
  date: string
): TodayCheckInDraft {
  const entry = checkInsByDate[date];

  return {
    mood: entry?.mood,
    note: entry?.note ?? '',
    tags: entry?.tags ?? [],
  };
}

export function hasTodayCheckIn(
  checkInsByDate: TodayCheckInsByDate,
  date: string
): boolean {
  return checkInsByDate[date] !== undefined;
}

function normalizeTodayCheckInEntry(
  date: string,
  draft: TodayCheckInDraft
): TodayCheckInEntry {
  const normalizedTags = TODAY_CHECK_IN_TAGS.filter((tag) => draft.tags.includes(tag));
  const trimmedNote = draft.note.trim();

  return {
    date,
    ...(draft.mood !== undefined ? { mood: draft.mood } : {}),
    ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
    ...(normalizedTags.length > 0 ? { tags: normalizedTags } : {}),
  };
}
