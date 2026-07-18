import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FrequencyType } from '../../constants/enums';
import { getDb, runMigrations } from '../db';
import { resolveTarget, resolveTargets } from '../habitTargetService';
import type { HabitTargetRow } from '../mappers/habitTargetMapper';

jest.mock('expo-sqlite', () => {
  type MockBindValue = string | number | null | boolean | Uint8Array;

  interface MockHabitTargetRow {
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

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private habitTargets: MockHabitTargetRow[] = [];

    async execAsync(_source: string): Promise<void> {}

    execSync(_source: string): void {}

    async runAsync(
      source: string,
      ...params: MockBindValue[]
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      if (source.includes('INSERT INTO schema_version')) {
        this.schemaVersion = readNumberParam(params, 0, 'schema version');
        return { lastInsertRowId: 1, changes: 1 };
      }

      if (source.includes('INSERT INTO HabitTarget')) {
        this.habitTargets.push(readHabitTargetParams(params));
        return { lastInsertRowId: this.habitTargets.length, changes: 1 };
      }

      return { lastInsertRowId: 0, changes: 1 };
    }

    async getFirstAsync(source: string, ...params: MockBindValue[]): Promise<unknown | null> {
      if (source.includes('SELECT version FROM schema_version')) {
        return this.schemaVersion === null ? null : { version: this.schemaVersion };
      }

      if (source.includes('FROM HabitTarget')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date = readStringParam(params, 1, 'date');
        return resolveTargetRow(this.habitTargets, habitId, date);
      }

      return null;
    }

    async getAllAsync(source: string, ...params: MockBindValue[]): Promise<unknown[]> {
      if (!source.includes('FROM HabitTarget')) {
        return [];
      }

      const date = readStringParam(params, params.length - 1, 'date');
      const habitIds = params
        .slice(0, -1)
        .filter((value): value is string => typeof value === 'string');
      const habitIdSet = new Set(habitIds);

      return this.habitTargets
        .filter((row) => habitIdSet.has(row.habitId) && row.effectiveFrom <= date)
        .sort(compareTargetRows)
        .map(cloneTargetRow);
    }
  }

  return {
    openDatabaseAsync: async () => new MockSQLiteDatabase(),
  };

  function readHabitTargetParams(params: MockBindValue[]): MockHabitTargetRow {
    return {
      id: readStringParam(params, 0, 'id'),
      habitId: readStringParam(params, 1, 'habitId'),
      frequencyType: readStringParam(params, 2, 'frequencyType'),
      timesPerDay: readNullableNumberParam(params, 3, 'timesPerDay'),
      intervalDays: readNullableNumberParam(params, 4, 'intervalDays'),
      daysOfWeek: readNullableStringParam(params, 5, 'daysOfWeek'),
      timesPerWeek: readNullableNumberParam(params, 6, 'timesPerWeek'),
      intervalWeeks: readNullableNumberParam(params, 7, 'intervalWeeks'),
      timesPerMonth: readNullableNumberParam(params, 8, 'timesPerMonth'),
      daysOfMonth: readNullableStringParam(params, 9, 'daysOfMonth'),
      timesPerYear: readNullableNumberParam(params, 10, 'timesPerYear'),
      scheduledTime: readNullableStringParam(params, 11, 'scheduledTime'),
      weekStartDay: readNumberParam(params, 12, 'weekStartDay'),
      habitType: readStringParam(params, 13, 'habitType'),
      targetValue: readNullableNumberParam(params, 14, 'targetValue'),
      targetUnit: readNullableStringParam(params, 15, 'targetUnit'),
      directionality: readNullableStringParam(params, 16, 'directionality'),
      streakCompletionThreshold: readNullableNumberParam(
        params,
        17,
        'streakCompletionThreshold'
      ),
      autoCompleteThreshold: readNullableNumberParam(params, 18, 'autoCompleteThreshold'),
      effectiveFrom: readStringParam(params, 19, 'effectiveFrom'),
      createdAt: readStringParam(params, 20, 'createdAt'),
    };
  }

  function resolveTargetRow(
    rows: MockHabitTargetRow[],
    habitId: string,
    date: string
  ): MockHabitTargetRow | null {
    return (
      rows
        .filter((row) => row.habitId === habitId && row.effectiveFrom <= date)
        .sort(compareTargetRows)
        .map(cloneTargetRow)[0] ?? null
    );
  }

  function compareTargetRows(a: MockHabitTargetRow, b: MockHabitTargetRow): number {
    const habitCompare = a.habitId.localeCompare(b.habitId);
    if (habitCompare !== 0) return habitCompare;

    const effectiveCompare = b.effectiveFrom.localeCompare(a.effectiveFrom);
    if (effectiveCompare !== 0) return effectiveCompare;

    const createdCompare = b.createdAt.localeCompare(a.createdAt);
    if (createdCompare !== 0) return createdCompare;

    return b.id.localeCompare(a.id);
  }

  function cloneTargetRow(row: MockHabitTargetRow): MockHabitTargetRow {
    return { ...row };
  }

  function readStringParam(params: MockBindValue[], index: number, label: string): string {
    const value = params[index];

    if (typeof value !== 'string') {
      throw new Error(`Expected ${label} to be a string.`);
    }

    return value;
  }

  function readNullableStringParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): string | null {
    const value = params[index];

    if (value === null || typeof value === 'string') {
      return value;
    }

    throw new Error(`Expected ${label} to be a string or null.`);
  }

  function readNumberParam(params: MockBindValue[], index: number, label: string): number {
    const value = params[index];

    if (typeof value !== 'number') {
      throw new Error(`Expected ${label} to be a number.`);
    }

    return value;
  }

  function readNullableNumberParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): number | null {
    const value = params[index];

    if (value === null || typeof value === 'number') {
      return value;
    }

    throw new Error(`Expected ${label} to be a number or null.`);
  }
});

function targetRow(overrides: Partial<HabitTargetRow>): HabitTargetRow {
  return {
    id: overrides.id ?? 'target-id',
    habitId: overrides.habitId ?? 'habit-id',
    frequencyType: overrides.frequencyType ?? FrequencyType.DAILY,
    timesPerDay: overrides.timesPerDay ?? null,
    intervalDays: overrides.intervalDays ?? null,
    daysOfWeek: overrides.daysOfWeek ?? null,
    timesPerWeek: overrides.timesPerWeek ?? null,
    intervalWeeks: overrides.intervalWeeks ?? null,
    timesPerMonth: overrides.timesPerMonth ?? null,
    daysOfMonth: overrides.daysOfMonth ?? null,
    timesPerYear: overrides.timesPerYear ?? null,
    scheduledTime: overrides.scheduledTime ?? null,
    weekStartDay: overrides.weekStartDay ?? 0,
    habitType: overrides.habitType ?? 'binary',
    targetValue: overrides.targetValue ?? null,
    targetUnit: overrides.targetUnit ?? null,
    directionality: overrides.directionality ?? null,
    streakCompletionThreshold: overrides.streakCompletionThreshold ?? null,
    autoCompleteThreshold: overrides.autoCompleteThreshold ?? null,
    effectiveFrom: overrides.effectiveFrom ?? '2026-05-01',
    createdAt: overrides.createdAt ?? '2026-05-01T10:00:00.000Z',
  };
}

async function seedUser(userId: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO User (id, timezone, createdAt)
    VALUES (?, ?, ?)`,
    userId,
    'UTC',
    '2026-05-01T10:00:00.000Z'
  );
}

async function seedHabit(habitId: string, userId = 'user-id'): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO Habit (
      id, userId, name, isHidden, trackEffort, startDate, allowMultiplePerDay,
      displayOrder, isPinned, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    habitId,
    userId,
    `Habit ${habitId}`,
    0,
    0,
    '2026-01-01',
    0,
    0,
    0,
    '2026-01-01T10:00:00.000Z'
  );
}

async function seedTarget(row: HabitTargetRow): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO HabitTarget (
      id, habitId, frequencyType, timesPerDay, intervalDays, daysOfWeek,
      timesPerWeek, intervalWeeks, timesPerMonth, daysOfMonth, timesPerYear,
      scheduledTime, weekStartDay, habitType, targetValue, targetUnit, directionality,
      streakCompletionThreshold, autoCompleteThreshold, effectiveFrom, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...targetRowValues(row)
  );
}

function targetRowValues(row: HabitTargetRow): Array<string | number | null> {
  return [
    row.id,
    row.habitId,
    row.frequencyType,
    row.timesPerDay,
    row.intervalDays,
    row.daysOfWeek,
    row.timesPerWeek,
    row.intervalWeeks,
    row.timesPerMonth,
    row.daysOfMonth,
    row.timesPerYear,
    row.scheduledTime,
    row.weekStartDay,
    row.habitType,
    row.targetValue,
    row.targetUnit,
    row.directionality,
    row.streakCompletionThreshold,
    row.autoCompleteThreshold,
    row.effectiveFrom,
    row.createdAt,
  ];
}

describe('habitTargetService', () => {
  beforeEach(async () => {
    await runMigrations(':memory:');
    await seedUser('user-id');
    await seedHabit('habit-id');
  });

  it('resolveTarget returns a single target in force for the date', async () => {
    await seedTarget(targetRow({ id: 'daily-target', effectiveFrom: '2026-05-01' }));

    await expect(resolveTarget('habit-id', '2026-05-07')).resolves.toEqual(
      expect.objectContaining({
        id: 'daily-target',
        habitId: 'habit-id',
        effectiveFrom: '2026-05-01',
      })
    );
  });

  it('resolveTarget picks the greatest effectiveFrom less than or equal to the date', async () => {
    await seedTarget(targetRow({ id: 'phase-1', effectiveFrom: '2026-01-01' }));
    await seedTarget(targetRow({ id: 'phase-2', effectiveFrom: '2026-05-01' }));
    await seedTarget(targetRow({ id: 'phase-3', effectiveFrom: '2026-08-01' }));

    await expect(resolveTarget('habit-id', '2026-07-15')).resolves.toEqual(
      expect.objectContaining({ id: 'phase-2' })
    );
  });

  it('resolveTarget picks a phase when the date equals effectiveFrom', async () => {
    await seedTarget(targetRow({ id: 'phase-1', effectiveFrom: '2026-01-01' }));
    await seedTarget(targetRow({ id: 'phase-2', effectiveFrom: '2026-05-01' }));

    await expect(resolveTarget('habit-id', '2026-05-01')).resolves.toEqual(
      expect.objectContaining({ id: 'phase-2' })
    );
  });

  it('resolveTarget returns null before the earliest target', async () => {
    await seedTarget(targetRow({ id: 'phase-1', effectiveFrom: '2026-05-01' }));

    await expect(resolveTarget('habit-id', '2026-04-30')).resolves.toBeNull();
  });

  it('resolveTarget picks the earlier phase between phase boundaries', async () => {
    await seedTarget(targetRow({ id: 'phase-1', effectiveFrom: '2026-05-01' }));
    await seedTarget(targetRow({ id: 'phase-2', effectiveFrom: '2026-06-01' }));

    await expect(resolveTarget('habit-id', '2026-05-31')).resolves.toEqual(
      expect.objectContaining({ id: 'phase-1' })
    );
  });

  it('resolveTarget resolves habitType changes per date', async () => {
    await seedTarget(
      targetRow({
        id: 'binary-phase',
        habitType: 'binary',
        effectiveFrom: '2026-05-01',
      })
    );
    await seedTarget(
      targetRow({
        id: 'measurable-phase',
        habitType: 'measurable',
        targetValue: 30,
        targetUnit: 'minutes',
        directionality: 'at_least',
        effectiveFrom: '2026-06-01',
      })
    );

    await expect(resolveTarget('habit-id', '2026-05-31')).resolves.toEqual(
      expect.objectContaining({ id: 'binary-phase', habitType: 'binary' })
    );
    await expect(resolveTarget('habit-id', '2026-06-01')).resolves.toEqual(
      expect.objectContaining({
        id: 'measurable-phase',
        habitType: 'measurable',
        targetValue: 30,
      })
    );
  });

  it('resolveTargets batch matches per-id resolveTarget results', async () => {
    await seedHabit('habit-a');
    await seedHabit('habit-b');
    await seedHabit('habit-c');
    await seedTarget(targetRow({ id: 'habit-a-old', habitId: 'habit-a', effectiveFrom: '2026-01-01' }));
    await seedTarget(targetRow({ id: 'habit-a-new', habitId: 'habit-a', effectiveFrom: '2026-05-01' }));
    await seedTarget(targetRow({ id: 'habit-b-old', habitId: 'habit-b', effectiveFrom: '2026-02-01' }));
    await seedTarget(targetRow({ id: 'habit-b-future', habitId: 'habit-b', effectiveFrom: '2026-06-01' }));

    const habitIds = ['habit-a', 'habit-b', 'habit-c'];
    const batchResults = await resolveTargets(habitIds, '2026-05-15');
    const perIdResults = new Map<string, string>();

    for (const habitId of habitIds) {
      const target = await resolveTarget(habitId, '2026-05-15');

      if (target) {
        perIdResults.set(habitId, target.id);
      }
    }

    expect(new Map([...batchResults].map(([habitId, target]) => [habitId, target.id]))).toEqual(
      perIdResults
    );
  });
});
