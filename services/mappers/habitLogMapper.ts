import type { HabitLog } from '../../types/schema';
import {
  booleanToInt,
  readBooleanInt,
  readNullableNumber,
  readNullableString,
  readRowObject,
  readString,
} from './mapperUtils';

const TABLE = 'HabitLog';

export const HABIT_LOG_ROW_COLUMNS =
  'id, habitId, userId, date, completed, value, effortRating, note, completedAt';

export interface HabitLogRow {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  completed: number;
  value: number | null;
  effortRating: number | null;
  note: string | null;
  completedAt: string | null;
}

export function rowToHabitLog(row: unknown): HabitLog {
  const record = readRowObject(row, TABLE);

  return {
    id: readString(record, TABLE, 'id'),
    habitId: readString(record, TABLE, 'habitId'),
    userId: readString(record, TABLE, 'userId'),
    date: readString(record, TABLE, 'date'),
    completed: readBooleanInt(record, TABLE, 'completed'),
    value: readNullableNumber(record, TABLE, 'value'),
    effortRating: readNullableNumber(record, TABLE, 'effortRating'),
    note: readNullableString(record, TABLE, 'note'),
    completedAt: readNullableString(record, TABLE, 'completedAt'),
  };
}

export function habitLogToRow(log: HabitLog): HabitLogRow {
  return {
    id: log.id,
    habitId: log.habitId,
    userId: log.userId,
    date: log.date,
    completed: booleanToInt(log.completed),
    value: log.value ?? null,
    effortRating: log.effortRating ?? null,
    note: log.note ?? null,
    completedAt: log.completedAt ?? null,
  };
}
