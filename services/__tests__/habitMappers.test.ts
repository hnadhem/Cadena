import { describe, expect, it } from '@jest/globals';
import { FrequencyType } from '../../constants/enums';
import {
  habitLogToRow,
  rowToHabitLog,
  type HabitLogRow,
} from '../mappers/habitLogMapper';
import {
  habitPeriodTargetToRow,
  rowToHabitPeriodTarget,
  type HabitPeriodTargetRow,
} from '../mappers/habitPeriodTargetMapper';
import {
  habitStreakPauseToRow,
  rowToHabitStreakPause,
  type HabitStreakPauseRow,
} from '../mappers/habitStreakPauseMapper';
import {
  HABIT_TARGET_ROW_COLUMNS,
  habitTargetToRow,
  rowToHabitTarget,
  type HabitTargetRow,
} from '../mappers/habitTargetMapper';
import {
  habitToRow,
  rowToHabit,
  type HabitRow,
} from '../mappers/habitMapper';

function habitRow(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: 'habit-id',
    userId: 'user-id',
    parentHabitId: null,
    name: 'Hydrate',
    description: null,
    category: 'health',
    color: '#2563eb',
    icon: 'droplet',
    isHidden: 1,
    trackEffort: 0,
    startDate: '2026-05-01',
    allowMultiplePerDay: 1,
    displayOrder: 3,
    isPinned: 0,
    archivedAt: null,
    linkedTallyItemId: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function habitTargetRow(overrides: Partial<HabitTargetRow> = {}): HabitTargetRow {
  return {
    id: 'target-id',
    habitId: 'habit-id',
    frequencyType: FrequencyType.SPECIFIC_DAYS_OF_WEEK,
    timesPerDay: null,
    intervalDays: null,
    daysOfWeek: JSON.stringify([1, 3, 5]),
    timesPerWeek: 3,
    intervalWeeks: null,
    timesPerMonth: null,
    daysOfMonth: JSON.stringify([1, 15]),
    timesPerYear: null,
    scheduledTime: null,
    weekStartDay: 1,
    habitType: 'measurable',
    targetValue: 64,
    targetUnit: 'oz',
    directionality: 'at_least',
    streakCompletionThreshold: 1,
    autoCompleteThreshold: 64,
    effectiveFrom: '2026-05-01',
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function habitLogRow(overrides: Partial<HabitLogRow> = {}): HabitLogRow {
  return {
    id: 'log-id',
    habitId: 'habit-id',
    userId: 'user-id',
    date: '2026-05-07',
    completed: 0,
    streakValid: 0,
    value: null,
    effortRating: null,
    note: null,
    completedAt: null,
    ...overrides,
  };
}

function habitStreakPauseRow(
  overrides: Partial<HabitStreakPauseRow> = {}
): HabitStreakPauseRow {
  return {
    id: 'pause-id',
    userId: 'user-id',
    habitId: null,
    startDate: '2026-05-01',
    endDate: null,
    reasons: JSON.stringify(['travel', 'illness']),
    reasonNote: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function habitPeriodTargetRow(
  overrides: Partial<HabitPeriodTargetRow> = {}
): HabitPeriodTargetRow {
  return {
    id: 'period-target-id',
    habitId: 'habit-id',
    userId: 'user-id',
    period: 'week',
    targetType: 'completion_count',
    targetValue: 4,
    effectiveFrom: '2026-05-01',
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('habit mappers', () => {
  it('round-trips Habit rows and converts boolean integers', () => {
    const row = habitRow();
    const habit = rowToHabit(row);

    expect(habit.isHidden).toBe(true);
    expect(habit.trackEffort).toBe(false);
    expect(habit.allowMultiplePerDay).toBe(true);
    expect(habit.isPinned).toBe(false);
    expect(habit.description).toBeUndefined();
    expect(habitToRow(habit)).toEqual(row);
  });

  it('throws descriptively for malformed Habit boolean columns', () => {
    expect(() => rowToHabit(habitRow({ isHidden: 2 }))).toThrow(
      'Invalid Habit.isHidden: expected 0 or 1, received 2.'
    );
  });

  it('round-trips HabitTarget rows with JSON arrays and null columns', () => {
    const row = habitTargetRow();
    const target = rowToHabitTarget(row);

    expect(HABIT_TARGET_ROW_COLUMNS).toContain('daysOfWeek');
    expect(target.daysOfWeek).toEqual([1, 3, 5]);
    expect(target.daysOfMonth).toEqual([1, 15]);
    expect(target.scheduledTime).toBeUndefined();
    expect(target.timesPerDay).toBeUndefined();
    expect(habitTargetToRow(target)).toEqual(row);
  });

  it('throws descriptively for malformed HabitTarget JSON columns', () => {
    expect(() =>
      rowToHabitTarget(habitTargetRow({ daysOfWeek: JSON.stringify(['monday']) }))
    ).toThrow(/Invalid HabitTarget\.daysOfWeek: expected JSON array of numbers, received/);
  });

  it('round-trips HabitLog rows and converts completion integers', () => {
    const row = habitLogRow();
    const log = rowToHabitLog(row);

    expect(log.completed).toBe(false);
    expect(log.streakValid).toBe(false);
    expect(log.value).toBeUndefined();
    expect(log.note).toBeUndefined();
    expect(habitLogToRow(log)).toEqual(row);
  });

  it('throws descriptively for malformed HabitLog boolean columns', () => {
    expect(() => rowToHabitLog(habitLogRow({ completed: -1 }))).toThrow(
      'Invalid HabitLog.completed: expected 0 or 1, received -1.'
    );
  });

  it('round-trips HabitStreakPause rows with JSON arrays and null columns', () => {
    const row = habitStreakPauseRow();
    const pause = rowToHabitStreakPause(row);

    expect(pause.habitId).toBeUndefined();
    expect(pause.endDate).toBeUndefined();
    expect(pause.reasons).toEqual(['travel', 'illness']);
    expect(habitStreakPauseToRow(pause)).toEqual(row);
  });

  it('throws descriptively for malformed HabitStreakPause JSON columns', () => {
    expect(() =>
      rowToHabitStreakPause(habitStreakPauseRow({ reasons: JSON.stringify([1]) }))
    ).toThrow(/Invalid HabitStreakPause\.reasons: expected JSON array of strings, received/);
  });

  it('round-trips HabitPeriodTarget rows', () => {
    const row = habitPeriodTargetRow();
    const target = rowToHabitPeriodTarget(row);

    expect(target.period).toBe('week');
    expect(target.targetType).toBe('completion_count');
    expect(habitPeriodTargetToRow(target)).toEqual(row);
  });

  it('throws descriptively for malformed HabitPeriodTarget enum columns', () => {
    expect(() => rowToHabitPeriodTarget(habitPeriodTargetRow({ period: 'quarter' }))).toThrow(
      'Invalid HabitPeriodTarget.period: expected one of week, month, year, received "quarter".'
    );
  });
});
