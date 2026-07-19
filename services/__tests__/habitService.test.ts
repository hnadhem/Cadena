import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FrequencyType } from '../../constants/enums';
import { getDb, runMigrations } from '../db';
import {
  archiveHabit,
  createHabit,
  createTargetPhase,
  getHabitById,
  listHabits,
  unarchiveHabit,
  updateHabit,
  type CreateHabitInput,
  type CreateTargetPhaseInput,
} from '../habitService';
import { resolveTarget } from '../habitTargetService';
import type { HabitRow } from '../mappers/habitMapper';
import type { HabitTargetRow } from '../mappers/habitTargetMapper';

interface MockSqliteControls {
  __failNextHabitTargetInsert: () => void;
}

jest.mock('expo-sqlite', () => {
  type MockBindValue = string | number | null | boolean | Uint8Array;

  interface MockUserRow {
    id: string;
    timezone: string;
    createdAt: string;
  }

  interface MockHabitRow {
    id: string;
    userId: string;
    parentHabitId: string | null;
    name: string;
    description: string | null;
    category: string | null;
    color: string | null;
    icon: string | null;
    isHidden: number;
    trackEffort: number;
    startDate: string;
    allowMultiplePerDay: number;
    displayOrder: number;
    isPinned: number;
    archivedAt: string | null;
    linkedTallyItemId: string | null;
    createdAt: string;
  }

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

  interface MockSnapshot {
    schemaVersion: number | null;
    users: MockUserRow[];
    habits: MockHabitRow[];
    habitTargets: MockHabitTargetRow[];
  }

  let failNextHabitTargetInsert = false;

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private users: MockUserRow[] = [];
    private habits: MockHabitRow[] = [];
    private habitTargets: MockHabitTargetRow[] = [];

    async execAsync(_source: string): Promise<void> {}

    execSync(_source: string): void {}

    async withExclusiveTransactionAsync(
      task: (txn: MockSQLiteDatabase) => Promise<void>
    ): Promise<void> {
      const snapshot = this.snapshot();

      try {
        await task(this);
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    }

    async runAsync(
      source: string,
      ...params: MockBindValue[]
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      if (source.includes('INSERT INTO schema_version')) {
        this.schemaVersion = readNumberParam(params, 0, 'schema version');
        return { lastInsertRowId: 1, changes: 1 };
      }

      if (source.includes('INSERT INTO User ')) {
        this.users.push({
          id: readStringParam(params, 0, 'id'),
          timezone: readStringParam(params, 1, 'timezone'),
          createdAt: readStringParam(params, 2, 'createdAt'),
        });
        return { lastInsertRowId: this.users.length, changes: 1 };
      }

      if (source.includes('INSERT INTO HabitTarget')) {
        if (failNextHabitTargetInsert) {
          failNextHabitTargetInsert = false;
          throw new Error('Forced HabitTarget insert failure.');
        }

        this.habitTargets.push(readHabitTargetParams(params));
        return { lastInsertRowId: this.habitTargets.length, changes: 1 };
      }

      if (source.includes('INSERT INTO Habit ')) {
        this.habits.push(readHabitParams(params));
        return { lastInsertRowId: this.habits.length, changes: 1 };
      }

      if (source.includes('UPDATE Habit SET archivedAt = NULL')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const habitIndex = this.habits.findIndex((row) => row.id === habitId);

        if (habitIndex >= 0) {
          this.habits[habitIndex] = {
            ...this.habits[habitIndex],
            archivedAt: null,
          };
        }

        return { lastInsertRowId: 0, changes: habitIndex >= 0 ? 1 : 0 };
      }

      if (source.includes('UPDATE Habit SET archivedAt = ?')) {
        const archivedAt = readStringParam(params, 0, 'archivedAt');
        const habitId = readStringParam(params, 1, 'habitId');
        const habitIndex = this.habits.findIndex((row) => row.id === habitId);

        if (habitIndex >= 0) {
          this.habits[habitIndex] = {
            ...this.habits[habitIndex],
            archivedAt,
          };
        }

        return { lastInsertRowId: 0, changes: habitIndex >= 0 ? 1 : 0 };
      }

      if (source.includes('UPDATE Habit SET')) {
        const habitId = readStringParam(params, 11, 'habitId');
        const habitIndex = this.habits.findIndex((row) => row.id === habitId);

        if (habitIndex >= 0) {
          const current = this.habits[habitIndex];
          this.habits[habitIndex] = {
            ...current,
            name: readStringParam(params, 0, 'name'),
            description: readNullableStringParam(params, 1, 'description'),
            category: readNullableStringParam(params, 2, 'category'),
            color: readNullableStringParam(params, 3, 'color'),
            icon: readNullableStringParam(params, 4, 'icon'),
            isHidden: readNumberParam(params, 5, 'isHidden'),
            trackEffort: readNumberParam(params, 6, 'trackEffort'),
            allowMultiplePerDay: readNumberParam(params, 7, 'allowMultiplePerDay'),
            displayOrder: readNumberParam(params, 8, 'displayOrder'),
            isPinned: readNumberParam(params, 9, 'isPinned'),
            linkedTallyItemId: readNullableStringParam(
              params,
              10,
              'linkedTallyItemId'
            ),
          };
        }

        return { lastInsertRowId: 0, changes: habitIndex >= 0 ? 1 : 0 };
      }

      return { lastInsertRowId: 0, changes: 1 };
    }

    async getFirstAsync<T>(
      source: string,
      ...params: MockBindValue[]
    ): Promise<T | null> {
      if (source.includes('SELECT version FROM schema_version')) {
        return this.schemaVersion === null
          ? null
          : ({ version: this.schemaVersion } as T);
      }

      if (source.includes('FROM HabitTarget')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date =
          params.length > 1 ? readStringParam(params, 1, 'date') : undefined;
        return resolveTargetRow(this.habitTargets, habitId, date) as T | null;
      }

      if (source.includes('FROM Habit')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const row = this.habits.find((candidate) => candidate.id === habitId) ?? null;
        return row ? (cloneHabitRow(row) as T) : null;
      }

      return null;
    }

    async getAllAsync<T>(
      source: string,
      ...params: MockBindValue[]
    ): Promise<T[]> {
      if (source.includes('FROM HabitTarget')) {
        const date = readStringParam(params, params.length - 1, 'date');
        const habitIds = params
          .slice(0, -1)
          .filter((value): value is string => typeof value === 'string');
        const habitIdSet = new Set(habitIds);

        return this.habitTargets
          .filter((row) => habitIdSet.has(row.habitId) && row.effectiveFrom <= date)
          .sort(compareTargetRows)
          .map(cloneHabitTargetRow) as T[];
      }

      if (source.includes('FROM Habit')) {
        const userId = readStringParam(params, 0, 'userId');

        return this.habits
          .filter((row) => row.userId === userId)
          .sort(compareHabitRows)
          .map(cloneHabitRow) as T[];
      }

      return [];
    }

    private snapshot(): MockSnapshot {
      return {
        schemaVersion: this.schemaVersion,
        users: this.users.map(cloneUserRow),
        habits: this.habits.map(cloneHabitRow),
        habitTargets: this.habitTargets.map(cloneHabitTargetRow),
      };
    }

    private restore(snapshot: MockSnapshot): void {
      this.schemaVersion = snapshot.schemaVersion;
      this.users = snapshot.users.map(cloneUserRow);
      this.habits = snapshot.habits.map(cloneHabitRow);
      this.habitTargets = snapshot.habitTargets.map(cloneHabitTargetRow);
    }
  }

  return {
    __failNextHabitTargetInsert: () => {
      failNextHabitTargetInsert = true;
    },
    openDatabaseAsync: async () => new MockSQLiteDatabase(),
  };

  function readHabitParams(params: MockBindValue[]): MockHabitRow {
    return {
      id: readStringParam(params, 0, 'id'),
      userId: readStringParam(params, 1, 'userId'),
      parentHabitId: readNullableStringParam(params, 2, 'parentHabitId'),
      name: readStringParam(params, 3, 'name'),
      description: readNullableStringParam(params, 4, 'description'),
      category: readNullableStringParam(params, 5, 'category'),
      color: readNullableStringParam(params, 6, 'color'),
      icon: readNullableStringParam(params, 7, 'icon'),
      isHidden: readNumberParam(params, 8, 'isHidden'),
      trackEffort: readNumberParam(params, 9, 'trackEffort'),
      startDate: readStringParam(params, 10, 'startDate'),
      allowMultiplePerDay: readNumberParam(params, 11, 'allowMultiplePerDay'),
      displayOrder: readNumberParam(params, 12, 'displayOrder'),
      isPinned: readNumberParam(params, 13, 'isPinned'),
      archivedAt: readNullableStringParam(params, 14, 'archivedAt'),
      linkedTallyItemId: readNullableStringParam(params, 15, 'linkedTallyItemId'),
      createdAt: readStringParam(params, 16, 'createdAt'),
    };
  }

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
    date?: string
  ): MockHabitTargetRow | null {
    return (
      rows
        .filter(
          (row) =>
            row.habitId === habitId &&
            (date === undefined || row.effectiveFrom <= date)
        )
        .sort(compareTargetRows)
        .map(cloneHabitTargetRow)[0] ?? null
    );
  }

  function compareTargetRows(
    a: MockHabitTargetRow,
    b: MockHabitTargetRow
  ): number {
    const habitCompare = a.habitId.localeCompare(b.habitId);
    if (habitCompare !== 0) return habitCompare;

    const effectiveCompare = b.effectiveFrom.localeCompare(a.effectiveFrom);
    if (effectiveCompare !== 0) return effectiveCompare;

    const createdCompare = b.createdAt.localeCompare(a.createdAt);
    if (createdCompare !== 0) return createdCompare;

    return b.id.localeCompare(a.id);
  }

  function compareHabitRows(a: MockHabitRow, b: MockHabitRow): number {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;

    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;

    return a.id.localeCompare(b.id);
  }

  function cloneUserRow(row: MockUserRow): MockUserRow {
    return { ...row };
  }

  function cloneHabitRow(row: MockHabitRow): MockHabitRow {
    return { ...row };
  }

  function cloneHabitTargetRow(row: MockHabitTargetRow): MockHabitTargetRow {
    return { ...row };
  }

  function readStringParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): string {
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

  function readNumberParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): number {
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

function habitInput(overrides: Partial<CreateHabitInput> = {}): CreateHabitInput {
  return {
    id: overrides.id ?? 'habit-id',
    userId: overrides.userId ?? 'user-id',
    name: overrides.name ?? 'Hydrate',
    description: overrides.description,
    category: overrides.category,
    color: overrides.color,
    icon: overrides.icon,
    isHidden: overrides.isHidden ?? false,
    trackEffort: overrides.trackEffort ?? false,
    startDate: overrides.startDate ?? '2026-05-01',
    allowMultiplePerDay: overrides.allowMultiplePerDay ?? false,
    displayOrder: overrides.displayOrder ?? 0,
    isPinned: overrides.isPinned ?? false,
    linkedTallyItemId: overrides.linkedTallyItemId,
    createdAt: overrides.createdAt ?? '2026-05-01T10:00:00.000Z',
    parentHabitId: overrides.parentHabitId,
    target: overrides.target ?? targetInput(),
  };
}

function targetInput(
  overrides: Partial<CreateTargetPhaseInput> = {}
): CreateTargetPhaseInput {
  return {
    id: overrides.id ?? 'target-id',
    frequencyType: overrides.frequencyType ?? FrequencyType.DAILY,
    timesPerDay: overrides.timesPerDay,
    intervalDays: overrides.intervalDays,
    daysOfWeek: overrides.daysOfWeek,
    timesPerWeek: overrides.timesPerWeek,
    intervalWeeks: overrides.intervalWeeks,
    timesPerMonth: overrides.timesPerMonth,
    daysOfMonth: overrides.daysOfMonth,
    timesPerYear: overrides.timesPerYear,
    scheduledTime: overrides.scheduledTime,
    weekStartDay: overrides.weekStartDay ?? 0,
    habitType: overrides.habitType ?? 'binary',
    targetValue: overrides.targetValue,
    targetUnit: overrides.targetUnit,
    directionality: overrides.directionality,
    streakCompletionThreshold: overrides.streakCompletionThreshold,
    autoCompleteThreshold: overrides.autoCompleteThreshold,
    createdAt: overrides.createdAt ?? '2026-05-01T10:00:00.000Z',
  };
}

async function seedUser(userId = 'user-id'): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO User (id, timezone, createdAt)
    VALUES (?, ?, ?)`,
    userId,
    'UTC',
    '2026-05-01T10:00:00.000Z'
  );
}

function getMockSqlite(): MockSqliteControls {
  return jest.requireMock('expo-sqlite') as MockSqliteControls;
}

describe('habitService', () => {
  beforeEach(async () => {
    await runMigrations(':memory:');
    await seedUser();
  });

  it('creates a habit and initial target atomically', async () => {
    const result = await createHabit(
      habitInput({
        id: 'atomic-created-habit',
        startDate: '2026-05-07',
        target: targetInput({
          id: 'atomic-created-target',
          habitType: 'measurable',
          targetValue: 64,
          targetUnit: 'oz',
          directionality: 'at_least',
        }),
      })
    );

    expect(result).toMatchObject({
      habit: {
        id: 'atomic-created-habit',
        startDate: '2026-05-07',
      },
      target: {
        id: 'atomic-created-target',
        habitId: 'atomic-created-habit',
        effectiveFrom: '2026-05-07',
      },
    });

    await expect(getHabitById('atomic-created-habit')).resolves.toEqual(
      expect.objectContaining({ id: 'atomic-created-habit' })
    );
    await expect(resolveTarget('atomic-created-habit', '2026-05-07')).resolves.toEqual(
      expect.objectContaining({ id: 'atomic-created-target' })
    );
  });

  it('rolls back the habit when the initial target insert fails', async () => {
    getMockSqlite().__failNextHabitTargetInsert();

    await expect(
      createHabit(
        habitInput({
          id: 'rollback-habit',
          target: targetInput({ id: 'rollback-target' }),
        })
      )
    ).rejects.toThrow('Forced HabitTarget insert failure.');

    await expect(getHabitById('rollback-habit')).resolves.toBeNull();
    await expect(resolveTarget('rollback-habit', '2026-05-01')).resolves.toBeNull();
  });

  it('rejects parentHabitId on create and update', async () => {
    await expect(
      createHabit(habitInput({ id: 'parented', parentHabitId: 'parent-id' }))
    ).rejects.toThrow('parentHabitId is not supported');

    await createHabit(habitInput({ id: 'flat-habit' }));

    await expect(
      updateHabit('flat-habit', { parentHabitId: 'parent-id' })
    ).rejects.toThrow('parentHabitId is not supported');
  });

  it('makes the initial target effective from the habit start date', async () => {
    await createHabit(
      habitInput({
        id: 'date-habit',
        startDate: '2026-05-07',
        target: targetInput({ id: 'date-target' }),
      })
    );

    await expect(resolveTarget('date-habit', '2026-05-07')).resolves.toEqual(
      expect.objectContaining({ id: 'date-target', effectiveFrom: '2026-05-07' })
    );
    await expect(resolveTarget('date-habit', '2026-05-06')).resolves.toBeNull();
  });

  it('appends target phases and preserves effective-date history', async () => {
    await createHabit(
      habitInput({
        id: 'phase-habit',
        startDate: '2026-05-01',
        target: targetInput({
          id: 'initial-phase',
          habitType: 'binary',
          scheduledTime: '08:00',
        }),
      })
    );
    await createTargetPhase(
      'phase-habit',
      targetInput({
        id: 'later-phase',
        habitType: 'measurable',
        targetValue: 30,
        targetUnit: 'min',
        directionality: 'at_least',
        scheduledTime: '18:00',
        createdAt: '2026-05-15T10:00:00.000Z',
      }),
      '2026-05-15'
    );

    await expect(resolveTarget('phase-habit', '2026-05-14')).resolves.toEqual(
      expect.objectContaining({ id: 'initial-phase', habitType: 'binary' })
    );
    await expect(resolveTarget('phase-habit', '2026-05-15')).resolves.toEqual(
      expect.objectContaining({
        id: 'later-phase',
        habitType: 'measurable',
        scheduledTime: '18:00',
      })
    );

    await createTargetPhase(
      'phase-habit',
      targetInput({
        id: 'same-day-revision',
        habitType: 'measurable',
        targetValue: 45,
        targetUnit: 'min',
        directionality: 'at_least',
        scheduledTime: '20:00',
        createdAt: '2026-05-15T11:00:00.000Z',
      }),
      '2026-05-15'
    );

    await expect(resolveTarget('phase-habit', '2026-05-20')).resolves.toEqual(
      expect.objectContaining({
        id: 'same-day-revision',
        targetValue: 45,
        scheduledTime: '20:00',
      })
    );
  });

  it('rejects target phases earlier than the latest phase effective date', async () => {
    await createHabit(
      habitInput({
        id: 'ordered-phase-habit',
        startDate: '2026-05-01',
      })
    );
    await createTargetPhase(
      'ordered-phase-habit',
      targetInput({
        id: 'latest-phase',
        createdAt: '2026-06-01T10:00:00.000Z',
      }),
      '2026-06-01'
    );

    await expect(
      createTargetPhase(
        'ordered-phase-habit',
        targetInput({
          id: 'too-early-phase',
          createdAt: '2026-05-15T10:00:00.000Z',
        }),
        '2026-05-15'
      )
    ).rejects.toThrow(
      'HabitTarget effectiveFrom 2026-05-15 cannot be earlier than latest phase 2026-06-01.'
    );
  });

  it('round-trips archived and hidden flags through mappers', async () => {
    await createHabit(
      habitInput({
        id: 'flagged-habit',
        name: 'Flagged',
        isHidden: true,
        displayOrder: 4,
      })
    );

    const archived = await archiveHabit(
      'flagged-habit',
      '2026-05-08T12:00:00.000Z'
    );

    expect(archived).toEqual(
      expect.objectContaining({
        id: 'flagged-habit',
        isHidden: true,
        archivedAt: '2026-05-08T12:00:00.000Z',
      })
    );

    const unarchived = await unarchiveHabit('flagged-habit');

    expect(unarchived).toEqual(
      expect.objectContaining({
        id: 'flagged-habit',
        isHidden: true,
        archivedAt: undefined,
      })
    );

    await expect(listHabits('user-id')).resolves.toEqual([
      expect.objectContaining({
        id: 'flagged-habit',
        isHidden: true,
        archivedAt: undefined,
      }),
    ]);
  });
});
