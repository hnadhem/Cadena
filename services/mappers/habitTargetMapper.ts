import { FrequencyType } from '../../constants/enums';
import type { HabitTarget } from '../../types/schema';
import {
  jsonArrayOrNull,
  readNullableNumber,
  readNullableString,
  readNullableStringEnum,
  readNumber,
  readNumberArrayJson,
  readRowObject,
  readString,
  readStringEnum,
} from './mapperUtils';

const TABLE = 'HabitTarget';
const HABIT_TYPE_VALUES: readonly ['binary', 'measurable'] = ['binary', 'measurable'];
const DIRECTIONALITY_VALUES: readonly ['at_least', 'at_most'] = [
  'at_least',
  'at_most',
];

export interface HabitTargetRow {
  id: string;
  habitId: string;
  frequencyType: string;
  timesPerDay: number | null;
  intervalDays: number | null;
  daysOfWeek: string | null;
  timesPerWeek: number | null;
  intervalWeeks: number | null;
  timesPerMonth: number | null;
  daysOfMonth: string | null;
  timesPerYear: number | null;
  scheduledTime: string | null;
  weekStartDay: number;
  habitType: string;
  targetValue: number | null;
  targetUnit: string | null;
  directionality: string | null;
  streakCompletionThreshold: number | null;
  autoCompleteThreshold: number | null;
  effectiveFrom: string;
  createdAt: string;
}

export const HABIT_TARGET_ROW_COLUMNS =
  'id, habitId, frequencyType, timesPerDay, intervalDays, daysOfWeek, timesPerWeek, intervalWeeks, timesPerMonth, daysOfMonth, timesPerYear, scheduledTime, weekStartDay, habitType, targetValue, targetUnit, directionality, streakCompletionThreshold, autoCompleteThreshold, effectiveFrom, createdAt';

export function rowToHabitTarget(row: unknown): HabitTarget {
  const record = readRowObject(row, TABLE);

  return {
    id: readString(record, TABLE, 'id'),
    habitId: readString(record, TABLE, 'habitId'),
    frequencyType: readStringEnum(
      record,
      TABLE,
      'frequencyType',
      Object.values(FrequencyType)
    ),
    timesPerDay: readNullableNumber(record, TABLE, 'timesPerDay'),
    intervalDays: readNullableNumber(record, TABLE, 'intervalDays'),
    daysOfWeek: readNumberArrayJson(record, TABLE, 'daysOfWeek'),
    timesPerWeek: readNullableNumber(record, TABLE, 'timesPerWeek'),
    intervalWeeks: readNullableNumber(record, TABLE, 'intervalWeeks'),
    timesPerMonth: readNullableNumber(record, TABLE, 'timesPerMonth'),
    daysOfMonth: readNumberArrayJson(record, TABLE, 'daysOfMonth'),
    timesPerYear: readNullableNumber(record, TABLE, 'timesPerYear'),
    scheduledTime: readNullableString(record, TABLE, 'scheduledTime'),
    weekStartDay: readNumber(record, TABLE, 'weekStartDay'),
    habitType: readStringEnum(record, TABLE, 'habitType', HABIT_TYPE_VALUES),
    targetValue: readNullableNumber(record, TABLE, 'targetValue'),
    targetUnit: readNullableString(record, TABLE, 'targetUnit'),
    directionality: readNullableStringEnum(
      record,
      TABLE,
      'directionality',
      DIRECTIONALITY_VALUES
    ),
    streakCompletionThreshold: readNullableNumber(
      record,
      TABLE,
      'streakCompletionThreshold'
    ),
    autoCompleteThreshold: readNullableNumber(record, TABLE, 'autoCompleteThreshold'),
    effectiveFrom: readString(record, TABLE, 'effectiveFrom'),
    createdAt: readString(record, TABLE, 'createdAt'),
  };
}

export function habitTargetToRow(target: HabitTarget): HabitTargetRow {
  return {
    id: target.id,
    habitId: target.habitId,
    frequencyType: target.frequencyType,
    timesPerDay: target.timesPerDay ?? null,
    intervalDays: target.intervalDays ?? null,
    daysOfWeek: jsonArrayOrNull(target.daysOfWeek),
    timesPerWeek: target.timesPerWeek ?? null,
    intervalWeeks: target.intervalWeeks ?? null,
    timesPerMonth: target.timesPerMonth ?? null,
    daysOfMonth: jsonArrayOrNull(target.daysOfMonth),
    timesPerYear: target.timesPerYear ?? null,
    scheduledTime: target.scheduledTime ?? null,
    weekStartDay: target.weekStartDay,
    habitType: target.habitType,
    targetValue: target.targetValue ?? null,
    targetUnit: target.targetUnit ?? null,
    directionality: target.directionality ?? null,
    streakCompletionThreshold: target.streakCompletionThreshold ?? null,
    autoCompleteThreshold: target.autoCompleteThreshold ?? null,
    effectiveFrom: target.effectiveFrom,
    createdAt: target.createdAt,
  };
}
