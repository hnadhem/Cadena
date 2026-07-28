import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DailyTag } from '../../constants/enums';
import { getDb, runMigrations } from '../db';
import {
  getDailyLog,
  getTodayCheckIn,
  saveTodayCheckIn,
} from '../dailyLogService';
import type { DailyLogRow } from '../mappers/dailyLogMapper';

type MockBindValue = string | number | null | boolean | Uint8Array;

jest.mock('expo-sqlite', () => {
  interface MockSnapshot {
    schemaVersion: number | null;
    dailyLogs: DailyLogRow[];
  }

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private dailyLogs: DailyLogRow[] = [];

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

      if (source.includes('INSERT INTO DailyLog')) {
        const row = readDailyLogParams(params);

        if (
          this.dailyLogs.some(
            (current) => current.userId === row.userId && current.date === row.date
          )
        ) {
          throw new Error('UNIQUE constraint failed: DailyLog.userId, DailyLog.date');
        }

        this.dailyLogs.push(row);
        return { lastInsertRowId: this.dailyLogs.length, changes: 1 };
      }

      if (source.includes('UPDATE DailyLog')) {
        const rowId = readStringParam(params, 4, 'id');
        const index = this.dailyLogs.findIndex((row) => row.id === rowId);

        if (index < 0) {
          return { lastInsertRowId: 0, changes: 0 };
        }

        this.dailyLogs[index] = {
          ...this.dailyLogs[index],
          mood: readNullableStringParam(params, 0, 'mood'),
          note: readNullableStringParam(params, 1, 'note'),
          tags: readNullableStringParam(params, 2, 'tags'),
          updatedAt: readStringParam(params, 3, 'updatedAt'),
        };
        return { lastInsertRowId: 0, changes: 1 };
      }

      return { lastInsertRowId: 0, changes: 0 };
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

      if (source.includes('FROM DailyLog')) {
        const userId = readStringParam(params, 0, 'userId');
        const date = readStringParam(params, 1, 'date');
        const row =
          this.dailyLogs.find(
            (candidate) => candidate.userId === userId && candidate.date === date
          ) ?? null;

        return row ? (cloneDailyLogRow(row) as T) : null;
      }

      return null;
    }

    private snapshot(): MockSnapshot {
      return {
        schemaVersion: this.schemaVersion,
        dailyLogs: this.dailyLogs.map(cloneDailyLogRow),
      };
    }

    private restore(snapshot: MockSnapshot): void {
      this.schemaVersion = snapshot.schemaVersion;
      this.dailyLogs = snapshot.dailyLogs.map(cloneDailyLogRow);
    }
  }

  return {
    openDatabaseAsync: async () => new MockSQLiteDatabase(),
  };

  function readDailyLogParams(params: MockBindValue[]): DailyLogRow {
    return {
      id: readStringParam(params, 0, 'id'),
      userId: readStringParam(params, 1, 'userId'),
      date: readStringParam(params, 2, 'date'),
      mood: readNullableStringParam(params, 3, 'mood'),
      energyLevel: readNullableNumberParam(params, 4, 'energyLevel'),
      bodyweightLbs: readNullableNumberParam(params, 5, 'bodyweightLbs'),
      note: readNullableStringParam(params, 6, 'note'),
      tags: readNullableStringParam(params, 7, 'tags'),
      createdAt: readStringParam(params, 8, 'createdAt'),
      updatedAt: readStringParam(params, 9, 'updatedAt'),
    };
  }

  function cloneDailyLogRow(row: DailyLogRow): DailyLogRow {
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

describe('dailyLogService', () => {
  beforeEach(async () => {
    await runMigrations(':memory:');
  });

  it('saves and loads a Today check-in from DailyLog', async () => {
    await expect(
      saveTodayCheckIn(
        'user-id',
        '2026-05-07',
        {
          mood: 'good',
          note: 'Long but steady day.',
          tags: [DailyTag.REST_DAY, DailyTag.BUSY],
        },
        '2026-05-07T12:00:00.000Z'
      )
    ).resolves.toEqual({
      ok: true,
      entry: {
        date: '2026-05-07',
        mood: 'good',
        note: 'Long but steady day.',
        tags: [DailyTag.REST_DAY, DailyTag.BUSY],
      },
    });

    await expect(getTodayCheckIn('user-id', '2026-05-07')).resolves.toEqual({
      date: '2026-05-07',
      mood: 'good',
      note: 'Long but steady day.',
      tags: [DailyTag.REST_DAY, DailyTag.BUSY],
    });
  });

  it('edits same-date check-ins in place while preserving other DailyLog fields', async () => {
    await seedDailyLog({
      id: 'daily-log-id',
      userId: 'user-id',
      date: '2026-05-07',
      mood: 'bad',
      energyLevel: 2,
      bodyweightLbs: 180.5,
      note: 'Original note.',
      tags: JSON.stringify([DailyTag.POOR_SLEEP]),
      createdAt: '2026-05-07T07:00:00.000Z',
      updatedAt: '2026-05-07T07:00:00.000Z',
    });

    await expect(
      saveTodayCheckIn(
        'user-id',
        '2026-05-07',
        {
          mood: 'great',
          note: 'Updated note.',
          tags: [DailyTag.SOCIAL_EVENT],
        },
        '2026-05-07T18:00:00.000Z'
      )
    ).resolves.toEqual({
      ok: true,
      entry: {
        date: '2026-05-07',
        mood: 'great',
        note: 'Updated note.',
        tags: [DailyTag.SOCIAL_EVENT],
      },
    });

    await expect(getDailyLog('user-id', '2026-05-07')).resolves.toEqual({
      id: 'daily-log-id',
      userId: 'user-id',
      date: '2026-05-07',
      mood: 'great',
      energyLevel: 2,
      bodyweightLbs: 180.5,
      note: 'Updated note.',
      tags: [DailyTag.SOCIAL_EVENT],
      createdAt: '2026-05-07T07:00:00.000Z',
      updatedAt: '2026-05-07T18:00:00.000Z',
    });
  });

  it('persists an empty check-in as a DailyLog row', async () => {
    await expect(
      saveTodayCheckIn(
        'user-id',
        '2026-05-07',
        {
          note: '',
          tags: [],
        },
        '2026-05-07T12:00:00.000Z'
      )
    ).resolves.toEqual({
      ok: true,
      entry: { date: '2026-05-07' },
    });

    await expect(getTodayCheckIn('user-id', '2026-05-07')).resolves.toEqual({
      date: '2026-05-07',
    });
  });

  it('rejects unsupported fixed-list DailyLog tags without writing', async () => {
    await expect(
      saveTodayCheckIn(
        'user-id',
        '2026-05-07',
        {
          note: '',
          tags: ['unknown_tag' as DailyTag],
        },
        '2026-05-07T12:00:00.000Z'
      )
    ).resolves.toEqual({
      ok: false,
      error: 'Choose only supported context tags.',
    });

    await expect(getDailyLog('user-id', '2026-05-07')).resolves.toBeNull();
  });

  it('returns null when no check-in exists for a date', async () => {
    await expect(getTodayCheckIn('user-id', '2026-05-07')).resolves.toBeNull();
  });
});

async function seedDailyLog(row: DailyLogRow): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO DailyLog (
      id, userId, date, mood, energyLevel, bodyweightLbs, note, tags,
      createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.userId,
    row.date,
    row.mood,
    row.energyLevel,
    row.bodyweightLbs,
    row.note,
    row.tags,
    row.createdAt,
    row.updatedAt
  );
}
