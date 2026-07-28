import { DailyTag } from '../../constants/enums';
import type { DailyLog } from '../../types/schema';
import {
  jsonArrayOrNull,
  readNullableNumber,
  readNullableString,
  readNullableStringEnum,
  readRowObject,
  readString,
  readStringArrayJson,
} from './mapperUtils';

const TABLE = 'DailyLog';
const MOOD_VALUES: readonly NonNullable<DailyLog['mood']>[] = [
  'great',
  'good',
  'okay',
  'bad',
  'terrible',
];
const DAILY_TAG_VALUES = Object.values(DailyTag);

export const DAILY_LOG_ROW_COLUMNS =
  'id, userId, date, mood, energyLevel, bodyweightLbs, note, tags, createdAt, updatedAt';

export interface DailyLogRow {
  id: string;
  userId: string;
  date: string;
  mood: string | null;
  energyLevel: number | null;
  bodyweightLbs: number | null;
  note: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

export function rowToDailyLog(row: unknown): DailyLog {
  const record = readRowObject(row, TABLE);

  return {
    id: readString(record, TABLE, 'id'),
    userId: readString(record, TABLE, 'userId'),
    date: readString(record, TABLE, 'date'),
    mood: readNullableStringEnum(record, TABLE, 'mood', MOOD_VALUES),
    energyLevel: readNullableNumber(record, TABLE, 'energyLevel'),
    bodyweightLbs: readNullableNumber(record, TABLE, 'bodyweightLbs'),
    note: readNullableString(record, TABLE, 'note'),
    tags: readDailyTags(record),
    createdAt: readString(record, TABLE, 'createdAt'),
    updatedAt: readString(record, TABLE, 'updatedAt'),
  };
}

export function dailyLogToRow(log: DailyLog): DailyLogRow {
  return {
    id: log.id,
    userId: log.userId,
    date: log.date,
    mood: log.mood ?? null,
    energyLevel: log.energyLevel ?? null,
    bodyweightLbs: log.bodyweightLbs ?? null,
    note: log.note ?? null,
    tags: jsonArrayOrNull(log.tags),
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

function readDailyTags(
  record: ReturnType<typeof readRowObject>
): DailyTag[] | undefined {
  const values = readStringArrayJson(record, TABLE, 'tags');

  if (values === undefined) {
    return undefined;
  }

  return values.map((value) => {
    if (DAILY_TAG_VALUES.includes(value as DailyTag)) {
      return value as DailyTag;
    }

    throw new Error(
      `Invalid ${TABLE}.tags: expected one of ${DAILY_TAG_VALUES.join(', ')}.`
    );
  });
}
