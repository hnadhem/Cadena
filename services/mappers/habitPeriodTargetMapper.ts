import type { HabitPeriodTarget } from '../../types/schema';
import {
  readNumber,
  readRowObject,
  readString,
  readStringEnum,
} from './mapperUtils';

const TABLE = 'HabitPeriodTarget';
const PERIOD_VALUES: readonly ['week', 'month', 'year'] = ['week', 'month', 'year'];
const TARGET_TYPE_VALUES: readonly ['completion_count', 'aggregate_value'] = [
  'completion_count',
  'aggregate_value',
];

export interface HabitPeriodTargetRow {
  id: string;
  habitId: string;
  userId: string;
  period: string;
  targetType: string;
  targetValue: number;
  effectiveFrom: string;
  createdAt: string;
}

export function rowToHabitPeriodTarget(row: unknown): HabitPeriodTarget {
  const record = readRowObject(row, TABLE);

  return {
    id: readString(record, TABLE, 'id'),
    habitId: readString(record, TABLE, 'habitId'),
    userId: readString(record, TABLE, 'userId'),
    period: readStringEnum(record, TABLE, 'period', PERIOD_VALUES),
    targetType: readStringEnum(record, TABLE, 'targetType', TARGET_TYPE_VALUES),
    targetValue: readNumber(record, TABLE, 'targetValue'),
    effectiveFrom: readString(record, TABLE, 'effectiveFrom'),
    createdAt: readString(record, TABLE, 'createdAt'),
  };
}

export function habitPeriodTargetToRow(
  target: HabitPeriodTarget
): HabitPeriodTargetRow {
  return {
    id: target.id,
    habitId: target.habitId,
    userId: target.userId,
    period: target.period,
    targetType: target.targetType,
    targetValue: target.targetValue,
    effectiveFrom: target.effectiveFrom,
    createdAt: target.createdAt,
  };
}
