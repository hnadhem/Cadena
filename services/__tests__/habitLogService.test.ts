import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FrequencyType } from '../../constants/enums';
import { getDb, runMigrations } from '../db';
import {
  addMeasurableCompletion,
  clearLog,
  completeBinary,
  setMeasurableValue,
} from '../habitLogService';
import {
  HABIT_LOG_ROW_COLUMNS,
  rowToHabitLog,
  type HabitLogRow,
} from '../mappers/habitLogMapper';
import type { HabitRow } from '../mappers/habitMapper';
import type { HabitTargetRow } from '../mappers/habitTargetMapper';
import type { HabitLog } from '../../types/schema';

interface HabitCompletionEventRow {
  id: string;
  userId: string;
  habitId: string;
  date: string;
  occurredAt: string;
  value: number | null;
  createdAt: string;
}

interface SqliteMasterRow {
  name: string;
}

interface SchemaVersionRow {
  version: number;
}

interface MockSqliteControls {
  __failNextHabitCompletionEventInsert: () => void;
  __resetDatabase: (databaseName: string) => void;
  __setSchemaVersion: (databaseName: string, version: number) => void;
}

jest.mock('expo-sqlite', () => {
  type MockBindValue = string | number | null | boolean | Uint8Array;

  interface MockUserRow {
    id: string;
    timezone: string;
    createdAt: string;
  }

  interface MockUserPreferenceRow {
    userId: string;
    dayEndTime: string;
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

  interface MockHabitContextRow extends MockHabitRow {
    timezone: string;
    dayEndTime: string | null;
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

  interface MockHabitLogRow {
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

  interface MockHabitCompletionEventRow {
    id: string;
    userId: string;
    habitId: string;
    date: string;
    occurredAt: string;
    value: number | null;
    createdAt: string;
  }

  interface MockSchemaObjectRow {
    type: 'table' | 'index';
    name: string;
  }

  interface MockSnapshot {
    schemaVersion: number | null;
    users: MockUserRow[];
    preferences: MockUserPreferenceRow[];
    habits: MockHabitRow[];
    habitTargets: MockHabitTargetRow[];
    habitLogs: MockHabitLogRow[];
    habitCompletionEvents: MockHabitCompletionEventRow[];
  }

  let failNextHabitCompletionEventInsert = false;

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private schemaObjects: MockSchemaObjectRow[] = [];
    private users: MockUserRow[] = [];
    private preferences: MockUserPreferenceRow[] = [];
    private habits: MockHabitRow[] = [];
    private habitTargets: MockHabitTargetRow[] = [];
    private habitLogs: MockHabitLogRow[] = [];
    private habitCompletionEvents: MockHabitCompletionEventRow[] = [];

    async execAsync(source: string): Promise<void> {
      this.recordSchemaObjects(source);
    }

    execSync(source: string): void {
      this.recordSchemaObjects(source);
    }

    setSchemaVersion(version: number): void {
      this.schemaVersion = version;
    }

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

      if (source.includes('INSERT INTO UserPreferences')) {
        this.preferences.push({
          userId: readStringParam(params, 0, 'userId'),
          dayEndTime: readStringParam(params, 1, 'dayEndTime'),
        });
        return { lastInsertRowId: this.preferences.length, changes: 1 };
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
        this.habitTargets.push(readHabitTargetParams(params));
        return { lastInsertRowId: this.habitTargets.length, changes: 1 };
      }

      if (source.includes('INSERT INTO HabitCompletionEvent')) {
        if (failNextHabitCompletionEventInsert) {
          failNextHabitCompletionEventInsert = false;
          throw new Error('Forced HabitCompletionEvent insert failure.');
        }

        this.habitCompletionEvents.push(readHabitCompletionEventParams(params));
        return {
          lastInsertRowId: this.habitCompletionEvents.length,
          changes: 1,
        };
      }

      if (source.includes('INSERT INTO HabitLog')) {
        const writesCompletedAt = source.includes('completedAt');
        const row = writesCompletedAt
          ? readHabitLogParams(params)
          : readHabitLogParamsWithoutCompletedAt(params);
        const existingIndex = this.habitLogs.findIndex(
          (current) => current.habitId === row.habitId && current.date === row.date
        );

        if (existingIndex >= 0) {
          const existingRow = this.habitLogs[existingIndex];
          this.habitLogs[existingIndex] = {
            ...row,
            id: existingRow.id,
            completedAt: writesCompletedAt ? row.completedAt : existingRow.completedAt,
          };
          return { lastInsertRowId: existingIndex + 1, changes: 1 };
        }

        this.habitLogs.push(row);
        return { lastInsertRowId: this.habitLogs.length, changes: 1 };
      }

      if (source.includes('INSERT INTO Habit ')) {
        this.habits.push(readHabitParams(params));
        return { lastInsertRowId: this.habits.length, changes: 1 };
      }

      if (source.includes('DELETE FROM HabitLog')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date = readStringParam(params, 1, 'date');
        const beforeCount = this.habitLogs.length;
        this.habitLogs = this.habitLogs.filter(
          (row) => row.habitId !== habitId || row.date !== date
        );
        return {
          lastInsertRowId: 0,
          changes: beforeCount - this.habitLogs.length,
        };
      }

      if (source.includes('DELETE FROM HabitCompletionEvent')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date = readStringParam(params, 1, 'date');
        const beforeCount = this.habitCompletionEvents.length;
        this.habitCompletionEvents = this.habitCompletionEvents.filter(
          (row) => row.habitId !== habitId || row.date !== date
        );
        return {
          lastInsertRowId: 0,
          changes: beforeCount - this.habitCompletionEvents.length,
        };
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

      if (source.includes('FROM sqlite_master')) {
        const type = readStringParam(params, 0, 'type');
        const name = readStringParam(params, 1, 'name');
        const row =
          this.schemaObjects.find(
            (candidate) => candidate.type === type && candidate.name === name
          ) ?? null;
        return row ? ({ name: row.name } as T) : null;
      }

      if (source.includes('FROM Habit h')) {
        const habitId = readStringParam(params, 0, 'habitId');
        return this.resolveHabitContextRow(habitId) as T | null;
      }

      if (source.includes('FROM HabitTarget')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date = readStringParam(params, 1, 'date');
        return resolveTargetRow(this.habitTargets, habitId, date) as T | null;
      }

      if (source.includes('FROM HabitLog')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date = readStringParam(params, 1, 'date');
        const row =
          this.habitLogs.find(
            (current) => current.habitId === habitId && current.date === date
          ) ?? null;
        return row ? (cloneHabitLogRow(row) as T) : null;
      }

      return null;
    }

    async getAllAsync<T>(source: string, ...params: MockBindValue[]): Promise<T[]> {
      if (source.includes('FROM HabitCompletionEvent')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date = readStringParam(params, 1, 'date');

        return this.habitCompletionEvents
          .filter((row) => row.habitId === habitId && row.date === date)
          .sort(compareHabitCompletionEventRows)
          .map(cloneHabitCompletionEventRow) as T[];
      }

      return [];
    }

    private resolveHabitContextRow(habitId: string): MockHabitContextRow | null {
      const habit = this.habits.find((row) => row.id === habitId);

      if (!habit) {
        return null;
      }

      const user = this.users.find((row) => row.id === habit.userId);

      if (!user) {
        return null;
      }

      const preferences = this.preferences.find((row) => row.userId === habit.userId);

      return {
        ...cloneHabitRow(habit),
        timezone: user.timezone,
        dayEndTime: preferences?.dayEndTime ?? null,
      };
    }

    private recordSchemaObjects(source: string): void {
      if (source.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
        this.upsertSchemaObject({ type: 'table', name: 'schema_version' });
      }

      if (source.includes('CREATE TABLE IF NOT EXISTS HabitCompletionEvent')) {
        this.upsertSchemaObject({
          type: 'table',
          name: 'HabitCompletionEvent',
        });
      }

      if (
        source.includes(
          'CREATE INDEX IF NOT EXISTS idx_habitCompletionEvent_habitId_date'
        )
      ) {
        this.upsertSchemaObject({
          type: 'index',
          name: 'idx_habitCompletionEvent_habitId_date',
        });
      }
    }

    private upsertSchemaObject(row: MockSchemaObjectRow): void {
      if (
        this.schemaObjects.some(
          (candidate) => candidate.type === row.type && candidate.name === row.name
        )
      ) {
        return;
      }

      this.schemaObjects.push(row);
    }

    private snapshot(): MockSnapshot {
      return {
        schemaVersion: this.schemaVersion,
        users: this.users.map(cloneUserRow),
        preferences: this.preferences.map(clonePreferenceRow),
        habits: this.habits.map(cloneHabitRow),
        habitTargets: this.habitTargets.map(cloneHabitTargetRow),
        habitLogs: this.habitLogs.map(cloneHabitLogRow),
        habitCompletionEvents: this.habitCompletionEvents.map(
          cloneHabitCompletionEventRow
        ),
      };
    }

    private restore(snapshot: MockSnapshot): void {
      this.schemaVersion = snapshot.schemaVersion;
      this.users = snapshot.users.map(cloneUserRow);
      this.preferences = snapshot.preferences.map(clonePreferenceRow);
      this.habits = snapshot.habits.map(cloneHabitRow);
      this.habitTargets = snapshot.habitTargets.map(cloneHabitTargetRow);
      this.habitLogs = snapshot.habitLogs.map(cloneHabitLogRow);
      this.habitCompletionEvents = snapshot.habitCompletionEvents.map(
        cloneHabitCompletionEventRow
      );
    }
  }

  const namedDatabases = new Map<string, MockSQLiteDatabase>();

  return {
    __failNextHabitCompletionEventInsert: () => {
      failNextHabitCompletionEventInsert = true;
    },
    __resetDatabase: (databaseName: string) => {
      namedDatabases.delete(databaseName);
    },
    __setSchemaVersion: (databaseName: string, version: number) => {
      getNamedDatabase(databaseName).setSchemaVersion(version);
    },
    openDatabaseAsync: async (databaseName = 'habit.db') => {
      if (databaseName === ':memory:') {
        return new MockSQLiteDatabase();
      }

      return getNamedDatabase(databaseName);
    },
  };

  function getNamedDatabase(databaseName: string): MockSQLiteDatabase {
    const existing = namedDatabases.get(databaseName);

    if (existing) {
      return existing;
    }

    const database = new MockSQLiteDatabase();
    namedDatabases.set(databaseName, database);
    return database;
  }

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

  function readHabitLogParams(params: MockBindValue[]): MockHabitLogRow {
    return {
      id: readStringParam(params, 0, 'id'),
      habitId: readStringParam(params, 1, 'habitId'),
      userId: readStringParam(params, 2, 'userId'),
      date: readStringParam(params, 3, 'date'),
      completed: readNumberParam(params, 4, 'completed'),
      value: readNullableNumberParam(params, 5, 'value'),
      effortRating: readNullableNumberParam(params, 6, 'effortRating'),
      note: readNullableStringParam(params, 7, 'note'),
      completedAt: readNullableStringParam(params, 8, 'completedAt'),
    };
  }

  function readHabitLogParamsWithoutCompletedAt(
    params: MockBindValue[]
  ): MockHabitLogRow {
    return {
      id: readStringParam(params, 0, 'id'),
      habitId: readStringParam(params, 1, 'habitId'),
      userId: readStringParam(params, 2, 'userId'),
      date: readStringParam(params, 3, 'date'),
      completed: readNumberParam(params, 4, 'completed'),
      value: readNullableNumberParam(params, 5, 'value'),
      effortRating: readNullableNumberParam(params, 6, 'effortRating'),
      note: readNullableStringParam(params, 7, 'note'),
      completedAt: null,
    };
  }

  function readHabitCompletionEventParams(
    params: MockBindValue[]
  ): MockHabitCompletionEventRow {
    return {
      id: readStringParam(params, 0, 'id'),
      userId: readStringParam(params, 1, 'userId'),
      habitId: readStringParam(params, 2, 'habitId'),
      date: readStringParam(params, 3, 'date'),
      occurredAt: readStringParam(params, 4, 'occurredAt'),
      value: readNullableNumberParam(params, 5, 'value'),
      createdAt: readStringParam(params, 6, 'createdAt'),
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
        .map(cloneHabitTargetRow)[0] ?? null
    );
  }

  function compareTargetRows(a: MockHabitTargetRow, b: MockHabitTargetRow): number {
    const effectiveCompare = b.effectiveFrom.localeCompare(a.effectiveFrom);
    if (effectiveCompare !== 0) return effectiveCompare;

    const createdCompare = b.createdAt.localeCompare(a.createdAt);
    if (createdCompare !== 0) return createdCompare;

    return b.id.localeCompare(a.id);
  }

  function compareHabitCompletionEventRows(
    a: MockHabitCompletionEventRow,
    b: MockHabitCompletionEventRow
  ): number {
    const occurredCompare = a.occurredAt.localeCompare(b.occurredAt);
    if (occurredCompare !== 0) return occurredCompare;

    const createdCompare = a.createdAt.localeCompare(b.createdAt);
    if (createdCompare !== 0) return createdCompare;

    return a.id.localeCompare(b.id);
  }

  function cloneUserRow(row: MockUserRow): MockUserRow {
    return { ...row };
  }

  function clonePreferenceRow(row: MockUserPreferenceRow): MockUserPreferenceRow {
    return { ...row };
  }

  function cloneHabitRow(row: MockHabitRow): MockHabitRow {
    return { ...row };
  }

  function cloneHabitTargetRow(row: MockHabitTargetRow): MockHabitTargetRow {
    return { ...row };
  }

  function cloneHabitLogRow(row: MockHabitLogRow): MockHabitLogRow {
    return { ...row };
  }

  function cloneHabitCompletionEventRow(
    row: MockHabitCompletionEventRow
  ): MockHabitCompletionEventRow {
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

function habitRow(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: 'habit-id',
    userId: 'user-id',
    parentHabitId: null,
    name: 'Habit',
    description: null,
    category: null,
    color: null,
    icon: null,
    isHidden: 0,
    trackEffort: 0,
    startDate: '2026-05-01',
    allowMultiplePerDay: 0,
    displayOrder: 0,
    isPinned: 0,
    archivedAt: null,
    linkedTallyItemId: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function targetRow(overrides: Partial<HabitTargetRow> = {}): HabitTargetRow {
  return {
    id: 'target-id',
    habitId: 'habit-id',
    frequencyType: FrequencyType.DAILY,
    timesPerDay: null,
    intervalDays: null,
    daysOfWeek: null,
    timesPerWeek: null,
    intervalWeeks: null,
    timesPerMonth: null,
    daysOfMonth: null,
    timesPerYear: null,
    scheduledTime: null,
    weekStartDay: 0,
    habitType: 'binary',
    targetValue: null,
    targetUnit: null,
    directionality: null,
    streakCompletionThreshold: null,
    autoCompleteThreshold: null,
    effectiveFrom: '2026-05-01',
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

async function seedUser(
  userId = 'user-id',
  timezone = 'UTC'
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO User (id, timezone, createdAt)
    VALUES (?, ?, ?)`,
    userId,
    timezone,
    '2026-05-01T10:00:00.000Z'
  );
}

async function seedUserPreferences(
  userId = 'user-id',
  dayEndTime = '00:00'
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO UserPreferences (userId, dayEndTime)
    VALUES (?, ?)`,
    userId,
    dayEndTime
  );
}

async function seedHabit(row: HabitRow): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO Habit (
      id, userId, parentHabitId, name, description, category, color, icon,
      isHidden, trackEffort, startDate, allowMultiplePerDay, displayOrder,
      isPinned, archivedAt, linkedTallyItemId, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...habitRowValues(row)
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

async function getHabitLog(habitId: string, date: string): Promise<HabitLog | null> {
  const row = await getDb().getFirstAsync<HabitLogRow>(
    `SELECT ${HABIT_LOG_ROW_COLUMNS}
    FROM HabitLog
    WHERE habitId = ?
      AND date = ?
    LIMIT 1`,
    habitId,
    date
  );

  return row ? rowToHabitLog(row) : null;
}

async function getHabitCompletionEvents(
  habitId: string,
  date: string
): Promise<HabitCompletionEventRow[]> {
  return getDb().getAllAsync<HabitCompletionEventRow>(
    `SELECT id, userId, habitId, date, occurredAt, value, createdAt
    FROM HabitCompletionEvent
    WHERE habitId = ?
      AND date = ?
    ORDER BY occurredAt, createdAt, id`,
    habitId,
    date
  );
}

async function getSqliteMasterName(
  type: 'table' | 'index',
  name: string
): Promise<string | null> {
  const row = await getDb().getFirstAsync<SqliteMasterRow>(
    `SELECT name
    FROM sqlite_master
    WHERE type = ?
      AND name = ?
    LIMIT 1`,
    type,
    name
  );

  return row?.name ?? null;
}

async function getSchemaVersion(): Promise<number | null> {
  const row = await getDb().getFirstAsync<SchemaVersionRow>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );

  return row?.version ?? null;
}

function getMockSqlite(): MockSqliteControls {
  return jest.requireMock('expo-sqlite') as MockSqliteControls;
}

function requireSingleEvent(
  events: HabitCompletionEventRow[]
): HabitCompletionEventRow {
  expect(events).toHaveLength(1);
  const event = events[0];

  if (!event) {
    throw new Error('Expected exactly one HabitCompletionEvent row.');
  }

  return event;
}

function habitRowValues(row: HabitRow): Array<string | number | null> {
  return [
    row.id,
    row.userId,
    row.parentHabitId,
    row.name,
    row.description,
    row.category,
    row.color,
    row.icon,
    row.isHidden,
    row.trackEffort,
    row.startDate,
    row.allowMultiplePerDay,
    row.displayOrder,
    row.isPinned,
    row.archivedAt,
    row.linkedTallyItemId,
    row.createdAt,
  ];
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

describe('habitLogService', () => {
  beforeEach(async () => {
    await runMigrations(':memory:');
    await seedUser();
  });

  it('applies the HabitCompletionEvent migration on a fresh database', async () => {
    const databaseName = 'habit-completion-event-fresh.db';
    getMockSqlite().__resetDatabase(databaseName);

    await runMigrations(databaseName);

    await expect(getSqliteMasterName('table', 'HabitCompletionEvent')).resolves.toBe(
      'HabitCompletionEvent'
    );
    await expect(
      getSqliteMasterName('index', 'idx_habitCompletionEvent_habitId_date')
    ).resolves.toBe('idx_habitCompletionEvent_habitId_date');
    await expect(getSchemaVersion()).resolves.toBe(2);
  });

  it('applies the HabitCompletionEvent migration after prior migrations', async () => {
    const databaseName = 'habit-completion-event-prior.db';
    const sqlite = getMockSqlite();
    sqlite.__resetDatabase(databaseName);
    sqlite.__setSchemaVersion(databaseName, 1);

    await runMigrations(databaseName);

    await expect(getSqliteMasterName('table', 'HabitCompletionEvent')).resolves.toBe(
      'HabitCompletionEvent'
    );
    await expect(
      getSqliteMasterName('index', 'idx_habitCompletionEvent_habitId_date')
    ).resolves.toBe('idx_habitCompletionEvent_habitId_date');
    await expect(getSchemaVersion()).resolves.toBe(2);
  });

  it('completes, clears, and re-completes binary logs and journal events', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'binary-habit' }));
    await seedTarget(targetRow({ habitId: 'binary-habit', habitType: 'binary' }));

    const firstInstant = new Date('2026-05-10T08:00:00.000Z');
    const firstLog = await completeBinary('binary-habit', '2026-05-10', firstInstant);

    expect(firstLog).toEqual(
      expect.objectContaining({
        habitId: 'binary-habit',
        date: '2026-05-10',
        completed: true,
        completedAt: firstInstant.toISOString(),
      })
    );

    const firstEvent = requireSingleEvent(
      await getHabitCompletionEvents('binary-habit', '2026-05-10')
    );
    expect(firstEvent.id).toEqual(expect.any(String));
    expect(firstEvent).toEqual(
      expect.objectContaining({
        userId: 'user-id',
        habitId: 'binary-habit',
        date: '2026-05-10',
        occurredAt: firstInstant.toISOString(),
        value: null,
        createdAt: firstInstant.toISOString(),
      })
    );

    const doubleLog = await completeBinary(
      'binary-habit',
      '2026-05-10',
      new Date('2026-05-10T09:00:00.000Z'),
      { note: 'ignored no-op' }
    );

    expect(doubleLog).toEqual(firstLog);
    expect(await getHabitLog('binary-habit', '2026-05-10')).toEqual(firstLog);
    expect(await getHabitCompletionEvents('binary-habit', '2026-05-10')).toEqual([
      firstEvent,
    ]);

    await clearLog('binary-habit', '2026-05-10', new Date('2026-05-10T10:00:00.000Z'));
    await expect(getHabitLog('binary-habit', '2026-05-10')).resolves.toBeNull();
    await expect(
      getHabitCompletionEvents('binary-habit', '2026-05-10')
    ).resolves.toEqual([]);

    const recompletedInstant = new Date('2026-05-10T11:00:00.000Z');
    const recompletedLog = await completeBinary(
      'binary-habit',
      '2026-05-10',
      recompletedInstant
    );

    expect(recompletedLog.id).not.toBe(firstLog.id);
    expect(recompletedLog.completedAt).toBe(recompletedInstant.toISOString());

    const recompletedEvent = requireSingleEvent(
      await getHabitCompletionEvents('binary-habit', '2026-05-10')
    );
    expect(recompletedEvent.id).not.toBe(firstEvent.id);
    expect(recompletedEvent).toEqual(
      expect.objectContaining({
        userId: 'user-id',
        habitId: 'binary-habit',
        date: '2026-05-10',
        occurredAt: recompletedInstant.toISOString(),
        value: null,
        createdAt: recompletedInstant.toISOString(),
      })
    );
  });

  it('rolls back the HabitLog write when the journal insert fails', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'atomic-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'atomic-habit',
        habitType: 'measurable',
        targetValue: 10,
        directionality: 'at_least',
      })
    );

    getMockSqlite().__failNextHabitCompletionEventInsert();

    await expect(
      addMeasurableCompletion(
        'atomic-habit',
        '2026-05-10',
        new Date('2026-05-10T08:00:00.000Z'),
        4
      )
    ).rejects.toThrow('Forced HabitCompletionEvent insert failure.');
    await expect(getHabitLog('atomic-habit', '2026-05-10')).resolves.toBeNull();
    await expect(
      getHabitCompletionEvents('atomic-habit', '2026-05-10')
    ).resolves.toEqual([]);
  });

  it('rejects completeBinary when the logged-date target is measurable', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'measurable-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'measurable-habit',
        habitType: 'measurable',
        targetValue: 30,
        directionality: 'at_least',
      })
    );

    await expect(
      completeBinary(
        'measurable-habit',
        '2026-05-10',
        new Date('2026-05-10T08:00:00.000Z')
      )
    ).rejects.toThrow('is measurable on 2026-05-10');
  });

  it('grades measurable writes against the target phase for the logged date', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'phase-habit' }));
    await seedTarget(
      targetRow({
        id: 'old-target',
        habitId: 'phase-habit',
        habitType: 'measurable',
        targetValue: 20,
        directionality: 'at_least',
        effectiveFrom: '2026-05-01',
      })
    );
    await seedTarget(
      targetRow({
        id: 'new-target',
        habitId: 'phase-habit',
        habitType: 'measurable',
        targetValue: 30,
        directionality: 'at_least',
        effectiveFrom: '2026-05-10',
      })
    );

    const instant = new Date('2026-05-10T12:00:00.000Z');
    const retroLog = await addMeasurableCompletion(
      'phase-habit',
      '2026-05-09',
      instant,
      25
    );
    const todayLog = await addMeasurableCompletion(
      'phase-habit',
      '2026-05-10',
      instant,
      25
    );

    expect(retroLog.completed).toBe(true);
    expect(retroLog.completedAt).toBeUndefined();
    expect(todayLog.completed).toBe(false);
    expect(todayLog.completedAt).toBe(instant.toISOString());
  });

  it('routes habit type flips through the target phase for the logged date', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'type-flip-habit' }));
    await seedTarget(
      targetRow({
        id: 'binary-phase',
        habitId: 'type-flip-habit',
        habitType: 'binary',
        effectiveFrom: '2026-05-01',
      })
    );
    await seedTarget(
      targetRow({
        id: 'measurable-phase',
        habitId: 'type-flip-habit',
        habitType: 'measurable',
        targetValue: 10,
        directionality: 'at_least',
        effectiveFrom: '2026-05-10',
      })
    );

    await expect(
      completeBinary(
        'type-flip-habit',
        '2026-05-09',
        new Date('2026-05-10T08:00:00.000Z')
      )
    ).resolves.toEqual(expect.objectContaining({ completed: true }));

    await clearLog(
      'type-flip-habit',
      '2026-05-09',
      new Date('2026-05-10T08:30:00.000Z')
    );

    await expect(
      addMeasurableCompletion(
        'type-flip-habit',
        '2026-05-09',
        new Date('2026-05-10T09:00:00.000Z'),
        10
      )
    ).rejects.toThrow('is binary on 2026-05-09');
  });

  it('aggregates measurable additions and re-grades at_least and at_most targets', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'minimum-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'minimum-habit',
        habitType: 'measurable',
        targetValue: 10,
        directionality: 'at_least',
      })
    );
    await seedHabit(habitRow({ id: 'maximum-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'maximum-habit',
        habitType: 'measurable',
        targetValue: 10,
        directionality: 'at_most',
      })
    );

    const partial = await addMeasurableCompletion(
      'minimum-habit',
      '2026-05-10',
      new Date('2026-05-10T08:00:00.000Z'),
      4
    );
    const crossed = await addMeasurableCompletion(
      'minimum-habit',
      '2026-05-10',
      new Date('2026-05-10T09:00:00.000Z'),
      6
    );
    const underLimit = await addMeasurableCompletion(
      'maximum-habit',
      '2026-05-10',
      new Date('2026-05-10T08:00:00.000Z'),
      4
    );
    const overLimit = await addMeasurableCompletion(
      'maximum-habit',
      '2026-05-10',
      new Date('2026-05-10T09:00:00.000Z'),
      7
    );

    expect(partial).toEqual(expect.objectContaining({ value: 4, completed: false }));
    expect(crossed).toEqual(
      expect.objectContaining({
        value: 10,
        completed: true,
        completedAt: '2026-05-10T09:00:00.000Z',
      })
    );
    expect(underLimit).toEqual(expect.objectContaining({ value: 4, completed: true }));
    expect(overLimit).toEqual(
      expect.objectContaining({
        value: 11,
        completed: false,
        completedAt: '2026-05-10T09:00:00.000Z',
      })
    );
  });

  it('journals measurable completion increments and leaves events untouched on edits', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'journal-measurable-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'journal-measurable-habit',
        habitType: 'measurable',
        targetValue: 10,
        directionality: 'at_least',
      })
    );

    await addMeasurableCompletion(
      'journal-measurable-habit',
      '2026-05-10',
      new Date('2026-05-10T08:00:00.000Z'),
      4
    );
    const aggregateLog = await addMeasurableCompletion(
      'journal-measurable-habit',
      '2026-05-10',
      new Date('2026-05-10T09:00:00.000Z'),
      6
    );

    expect(aggregateLog).toEqual(
      expect.objectContaining({
        value: 10,
        completed: true,
        completedAt: '2026-05-10T09:00:00.000Z',
      })
    );

    const eventsBeforeEdit = await getHabitCompletionEvents(
      'journal-measurable-habit',
      '2026-05-10'
    );
    expect(eventsBeforeEdit).toEqual([
      expect.objectContaining({
        userId: 'user-id',
        habitId: 'journal-measurable-habit',
        date: '2026-05-10',
        occurredAt: '2026-05-10T08:00:00.000Z',
        value: 4,
        createdAt: '2026-05-10T08:00:00.000Z',
      }),
      expect.objectContaining({
        userId: 'user-id',
        habitId: 'journal-measurable-habit',
        date: '2026-05-10',
        occurredAt: '2026-05-10T09:00:00.000Z',
        value: 6,
        createdAt: '2026-05-10T09:00:00.000Z',
      }),
    ]);

    const editedLog = await setMeasurableValue(
      'journal-measurable-habit',
      '2026-05-10',
      new Date('2026-05-10T10:00:00.000Z'),
      3
    );

    expect(editedLog).toEqual(
      expect.objectContaining({
        value: 3,
        completed: false,
        completedAt: '2026-05-10T09:00:00.000Z',
      })
    );
    expect(await getHabitLog('journal-measurable-habit', '2026-05-10')).toEqual(
      editedLog
    );
    expect(
      await getHabitCompletionEvents('journal-measurable-habit', '2026-05-10')
    ).toEqual(eventsBeforeEdit);
  });

  it('sets measurable value outright and never modifies completedAt on edits', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'edit-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'edit-habit',
        habitType: 'measurable',
        targetValue: 10,
        directionality: 'at_least',
      })
    );

    await addMeasurableCompletion(
      'edit-habit',
      '2026-05-10',
      new Date('2026-05-10T08:00:00.000Z'),
      4
    );
    await addMeasurableCompletion(
      'edit-habit',
      '2026-05-10',
      new Date('2026-05-10T09:00:00.000Z'),
      6
    );

    const editedToday = await setMeasurableValue(
      'edit-habit',
      '2026-05-10',
      new Date('2026-05-10T10:00:00.000Z'),
      3
    );

    expect(editedToday).toEqual(
      expect.objectContaining({
        value: 3,
        completed: false,
        completedAt: '2026-05-10T09:00:00.000Z',
      })
    );

    const retroEditOfTimestampedRow = await setMeasurableValue(
      'edit-habit',
      '2026-05-10',
      new Date('2026-05-11T08:00:00.000Z'),
      11
    );

    expect(retroEditOfTimestampedRow).toEqual(
      expect.objectContaining({
        value: 11,
        completed: true,
        completedAt: '2026-05-10T09:00:00.000Z',
      })
    );

    const retro = await addMeasurableCompletion(
      'edit-habit',
      '2026-05-09',
      new Date('2026-05-10T11:00:00.000Z'),
      12
    );
    const editedRetro = await setMeasurableValue(
      'edit-habit',
      '2026-05-09',
      new Date('2026-05-10T12:00:00.000Z'),
      8
    );

    expect(retro).toEqual(
      expect.objectContaining({
        value: 12,
        completed: true,
        completedAt: undefined,
      })
    );
    expect(editedRetro).toEqual(
      expect.objectContaining({
        value: 8,
        completed: false,
        completedAt: undefined,
      })
    );
  });

  it('sets completedAt for current logical date writes and null for retroactive writes', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'timestamp-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'timestamp-habit',
        habitType: 'measurable',
        targetValue: 1,
        directionality: 'at_least',
      })
    );

    const instant = new Date('2026-05-10T08:00:00.000Z');
    const currentLog = await addMeasurableCompletion(
      'timestamp-habit',
      '2026-05-10',
      instant,
      1
    );
    const retroLog = await addMeasurableCompletion(
      'timestamp-habit',
      '2026-05-09',
      instant,
      1
    );

    expect(currentLog.completedAt).toBe(instant.toISOString());
    expect(retroLog.completedAt).toBeUndefined();
  });

  it('rejects dates outside the retroactive window and dates with no target in force', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'window-habit' }));
    await seedTarget(targetRow({ habitId: 'window-habit', effectiveFrom: '2026-05-01' }));

    await expect(
      completeBinary(
        'window-habit',
        '2026-05-06',
        new Date('2026-05-10T12:00:00.000Z')
      )
    ).rejects.toThrow(
      'Habit log date 2026-05-06 is outside the 3-calendar-day retroactive window (2026-05-07 through 2026-05-10).'
    );

    await seedHabit(habitRow({ id: 'future-target-habit' }));
    await seedTarget(
      targetRow({
        habitId: 'future-target-habit',
        effectiveFrom: '2026-05-08',
      })
    );

    await expect(
      completeBinary(
        'future-target-habit',
        '2026-05-07',
        new Date('2026-05-10T12:00:00.000Z')
      )
    ).rejects.toThrow('has no target in force on 2026-05-07');
  });

  it('uses current logical date to compute the dayEndTime retroactive boundary', async () => {
    await seedUserPreferences('user-id', '03:00');
    await seedHabit(habitRow({ id: 'boundary-habit' }));
    await seedTarget(targetRow({ habitId: 'boundary-habit', effectiveFrom: '2026-05-01' }));

    await expect(
      completeBinary(
        'boundary-habit',
        '2026-05-04',
        new Date('2026-05-08T01:00:00.000Z')
      )
    ).resolves.toEqual(expect.objectContaining({ date: '2026-05-04' }));

    await expect(
      completeBinary(
        'boundary-habit',
        '2026-05-04',
        new Date('2026-05-08T04:00:00.000Z')
      )
    ).rejects.toThrow(
      'Habit log date 2026-05-04 is outside the 3-calendar-day retroactive window (2026-05-05 through 2026-05-08).'
    );
  });

  it('uses createdAt as the target tie-breaker for equal effectiveFrom phases', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'tie-break-habit' }));
    await seedTarget(
      targetRow({
        id: 'older-target',
        habitId: 'tie-break-habit',
        habitType: 'measurable',
        targetValue: 30,
        directionality: 'at_least',
        effectiveFrom: '2026-05-01',
        createdAt: '2026-05-01T08:00:00.000Z',
      })
    );
    await seedTarget(
      targetRow({
        id: 'later-target',
        habitId: 'tie-break-habit',
        habitType: 'measurable',
        targetValue: 20,
        directionality: 'at_least',
        effectiveFrom: '2026-05-01',
        createdAt: '2026-05-01T09:00:00.000Z',
      })
    );

    await expect(
      addMeasurableCompletion(
        'tie-break-habit',
        '2026-05-10',
        new Date('2026-05-10T08:00:00.000Z'),
        25
      )
    ).resolves.toEqual(expect.objectContaining({ completed: true }));
  });

  it('rejects effort ratings when disabled and writes latest note and effort when enabled', async () => {
    await seedUserPreferences();
    await seedHabit(habitRow({ id: 'no-effort-habit', trackEffort: 0 }));
    await seedTarget(targetRow({ habitId: 'no-effort-habit' }));

    await expect(
      completeBinary(
        'no-effort-habit',
        '2026-05-10',
        new Date('2026-05-10T08:00:00.000Z'),
        { effortRating: 3 }
      )
    ).rejects.toThrow('does not track effort ratings');

    await seedHabit(habitRow({ id: 'effort-habit', trackEffort: 1 }));
    await seedTarget(
      targetRow({
        habitId: 'effort-habit',
        habitType: 'measurable',
        targetValue: 10,
        directionality: 'at_least',
      })
    );

    await addMeasurableCompletion(
      'effort-habit',
      '2026-05-10',
      new Date('2026-05-10T08:00:00.000Z'),
      4,
      { note: 'first', effortRating: 2 }
    );
    const latest = await addMeasurableCompletion(
      'effort-habit',
      '2026-05-10',
      new Date('2026-05-10T09:00:00.000Z'),
      6,
      { note: 'latest', effortRating: 4 }
    );

    expect(latest).toEqual(
      expect.objectContaining({
        value: 10,
        completed: true,
        note: 'latest',
        effortRating: 4,
      })
    );
  });
});
