import type { HabitStreakPause } from '../../types/schema';
import {
  jsonArrayOrNull,
  readNullableString,
  readRowObject,
  readString,
  readStringArrayJson,
} from './mapperUtils';

const TABLE = 'HabitStreakPause';

export interface HabitStreakPauseRow {
  id: string;
  userId: string;
  habitId: string | null;
  startDate: string;
  endDate: string | null;
  reasons: string | null;
  reasonNote: string | null;
  createdAt: string;
}

export function rowToHabitStreakPause(row: unknown): HabitStreakPause {
  const record = readRowObject(row, TABLE);

  return {
    id: readString(record, TABLE, 'id'),
    userId: readString(record, TABLE, 'userId'),
    habitId: readNullableString(record, TABLE, 'habitId'),
    startDate: readString(record, TABLE, 'startDate'),
    endDate: readNullableString(record, TABLE, 'endDate'),
    reasons: readStringArrayJson(record, TABLE, 'reasons'),
    reasonNote: readNullableString(record, TABLE, 'reasonNote'),
    createdAt: readString(record, TABLE, 'createdAt'),
  };
}

export function habitStreakPauseToRow(pause: HabitStreakPause): HabitStreakPauseRow {
  return {
    id: pause.id,
    userId: pause.userId,
    habitId: pause.habitId ?? null,
    startDate: pause.startDate,
    endDate: pause.endDate ?? null,
    reasons: jsonArrayOrNull(pause.reasons),
    reasonNote: pause.reasonNote ?? null,
    createdAt: pause.createdAt,
  };
}
