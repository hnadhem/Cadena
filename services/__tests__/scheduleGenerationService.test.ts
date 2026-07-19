import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppMode, CardioType, WorkoutScheduleFrequency } from '../../constants/enums';
import { useUserStore } from '../../store/userStore';
import { useWorkoutStore } from '../../store/workoutStore';
import type { UserPreferences, WorkoutSession } from '../../types/schema';
import { getDb, runMigrations } from '../db';
import { generateSessions } from '../scheduleGenerationService';
import {
  getTodayViewModel,
  moveTodayFitnessSessionToTomorrow,
  skipTodayFitnessSession,
} from '../todayService';

type TestBindValue = string | number | null | boolean | Uint8Array;

interface MockSqliteControls {
  __clearQueryFailures: () => void;
  __failNextWorkoutScheduleLoad: () => void;
  __getSnapshot: (databaseName?: string) => MockSnapshot;
  __resetDatabase: (databaseName: string) => void;
  __setSchemaVersion: (databaseName: string, version: number) => void;
}

interface MockSchemaObjectRow {
  type: 'table' | 'index';
  name: string;
  sql: string;
}

interface MockWorkoutSessionRow {
  id: string;
  userId: string;
  templateId: string | null;
  scheduleId: string | null;
  generatedForDate: string | null;
  name: string | null;
  templateNameSnapshot: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: string | null;
  completedAt: string | null;
  loggedAt: string;
  isRetroactive: number;
  workoutDate: string | null;
  durationMinutes: number | null;
  durationOverridden: number;
  rpe: number | null;
  note: string | null;
  liveState: string | null;
}

interface MockCardioSessionRow {
  id: string;
  userId: string;
  templateId: string | null;
  scheduleId: string | null;
  generatedForDate: string | null;
  templateNameSnapshot: string | null;
  type: string;
  subtype: string | null;
  sportName: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: string | null;
  completedAt: string | null;
  loggedAt: string;
  isRetroactive: number;
  cardioDate: string | null;
  durationMinutes: number | null;
  durationOverridden: number;
  distanceMiles: number | null;
  caloriesBurned: number | null;
  elevationGainFt: number | null;
  rpe: number | null;
  heartRateAvg: number | null;
  heartRateMax: number | null;
  cadence: number | null;
  resistance: number | null;
  powerWatts: number | null;
  route: string | null;
  note: string | null;
}

interface MockSnapshot {
  schemaVersion: number | null;
  schemaObjects: MockSchemaObjectRow[];
  tableColumns: Record<string, string[]>;
  workoutSessions: MockWorkoutSessionRow[];
  cardioSessions: MockCardioSessionRow[];
}

jest.mock('expo-sqlite', () => {
  type MockBindValue = string | number | null | boolean | Uint8Array;

  interface MockUserRow {
    id: string;
    timezone: string;
    createdAt: string;
  }

  interface MockPreferenceRow {
    userId: string;
    dayEndTime: string;
  }

  interface MockWorkoutTemplateRow {
    id: string;
    userId: string;
    name: string | null;
  }

  interface MockCardioTemplateRow {
    id: string;
    userId: string;
    name: string | null;
    type: string;
    subtype: string | null;
  }

  interface MockScheduleRow {
    id: string;
    userId: string;
    templateId: string;
    name: string | null;
    frequencyType: string;
    daysOfWeek: string | null;
    intervalDays: number | null;
    intervalWeeks: number | null;
    scheduledTime: string | null;
    startDate: string;
    endDate: string | null;
    isActive: number;
    createdAt: string;
    deletedAt: string | null;
  }

  interface MockWorkoutSessionRow {
    id: string;
    userId: string;
    templateId: string | null;
    scheduleId: string | null;
    generatedForDate: string | null;
    name: string | null;
    templateNameSnapshot: string | null;
    status: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    startedAt: string | null;
    completedAt: string | null;
    loggedAt: string;
    isRetroactive: number;
    workoutDate: string | null;
    durationMinutes: number | null;
    durationOverridden: number;
    rpe: number | null;
    note: string | null;
    liveState: string | null;
  }

  interface MockCardioSessionRow {
    id: string;
    userId: string;
    templateId: string | null;
    scheduleId: string | null;
    generatedForDate: string | null;
    templateNameSnapshot: string | null;
    type: string;
    subtype: string | null;
    sportName: string | null;
    status: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    startedAt: string | null;
    completedAt: string | null;
    loggedAt: string;
    isRetroactive: number;
    cardioDate: string | null;
    durationMinutes: number | null;
    durationOverridden: number;
    distanceMiles: number | null;
    caloriesBurned: number | null;
    elevationGainFt: number | null;
    rpe: number | null;
    heartRateAvg: number | null;
    heartRateMax: number | null;
    cadence: number | null;
    resistance: number | null;
    powerWatts: number | null;
    route: string | null;
    note: string | null;
  }

  interface MockSchemaObjectRow {
    type: 'table' | 'index';
    name: string;
    sql: string;
  }

  interface MockSnapshot {
    schemaVersion: number | null;
    schemaObjects: MockSchemaObjectRow[];
    tableColumns: Record<string, string[]>;
    workoutSessions: MockWorkoutSessionRow[];
    cardioSessions: MockCardioSessionRow[];
  }

  let failNextWorkoutScheduleLoad = false;
  let currentDatabase: MockSQLiteDatabase | null = null;

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private schemaObjects: MockSchemaObjectRow[] = [];
    private tableColumns = new Map<string, Set<string>>();
    private users: MockUserRow[] = [];
    private preferences: MockPreferenceRow[] = [];
    private workoutTemplates: MockWorkoutTemplateRow[] = [];
    private cardioTemplates: MockCardioTemplateRow[] = [];
    private workoutSchedules: MockScheduleRow[] = [];
    private cardioSchedules: MockScheduleRow[] = [];
    private workoutSessions: MockWorkoutSessionRow[] = [];
    private cardioSessions: MockCardioSessionRow[] = [];
    private workoutGeneratedUniqueIndex = false;
    private cardioGeneratedUniqueIndex = false;

    async execAsync(source: string): Promise<void> {
      this.recordSchema(source);
    }

    execSync(source: string): void {
      this.recordSchema(source);
    }

    setSchemaVersion(version: number): void {
      this.schemaVersion = version;
    }

    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      const snapshot = this.snapshotInternal();

      try {
        await task();
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    }

    async withExclusiveTransactionAsync(
      task: (txn: MockSQLiteDatabase) => Promise<void>
    ): Promise<void> {
      const snapshot = this.snapshotInternal();

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
        const row: MockPreferenceRow = {
          userId: readStringParam(params, 0, 'userId'),
          dayEndTime: readStringParam(params, 1, 'dayEndTime'),
        };
        this.preferences = [
          ...this.preferences.filter((preference) => preference.userId !== row.userId),
          row,
        ];
        return { lastInsertRowId: this.preferences.length, changes: 1 };
      }

      if (source.includes('INSERT INTO User ')) {
        const row = {
          id: readStringParam(params, 0, 'id'),
          timezone: readStringParam(params, 1, 'timezone'),
          createdAt: readStringParam(params, 2, 'createdAt'),
        };
        this.users = [
          ...this.users.filter((user) => user.id !== row.id),
          row,
        ];
        return { lastInsertRowId: this.users.length, changes: 1 };
      }

      if (source.includes('INSERT INTO WorkoutTemplate')) {
        this.workoutTemplates.push({
          id: readStringParam(params, 0, 'id'),
          userId: readStringParam(params, 1, 'userId'),
          name: readNullableStringParam(params, 2, 'name'),
        });
        return { lastInsertRowId: this.workoutTemplates.length, changes: 1 };
      }

      if (source.includes('INSERT INTO CardioTemplate')) {
        this.cardioTemplates.push({
          id: readStringParam(params, 0, 'id'),
          userId: readStringParam(params, 1, 'userId'),
          name: readNullableStringParam(params, 2, 'name'),
          type: readStringParam(params, 3, 'type'),
          subtype: readNullableStringParam(params, 4, 'subtype'),
        });
        return { lastInsertRowId: this.cardioTemplates.length, changes: 1 };
      }

      if (source.includes('INSERT INTO WorkoutSchedule')) {
        this.workoutSchedules.push(readScheduleInsert(source, params));
        return { lastInsertRowId: this.workoutSchedules.length, changes: 1 };
      }

      if (source.includes('INSERT INTO CardioSchedule')) {
        this.cardioSchedules.push(readScheduleInsert(source, params));
        return { lastInsertRowId: this.cardioSchedules.length, changes: 1 };
      }

      if (source.includes('INSERT') && source.includes('INTO WorkoutSession')) {
        const row = readWorkoutSessionInsert(source, params);
        return this.insertWorkoutSession(row, source.includes('OR IGNORE'));
      }

      if (source.includes('INSERT') && source.includes('INTO CardioSession')) {
        const row = readCardioSessionInsert(source, params);
        return this.insertCardioSession(row, source.includes('OR IGNORE'));
      }

      if (source.includes('UPDATE WorkoutSession') && source.includes('SET scheduledDate = ?')) {
        const scheduledDate = readStringParam(params, 0, 'scheduledDate');
        const sessionId = readStringParam(params, 1, 'sessionId');
        const index = this.workoutSessions.findIndex((row) => row.id === sessionId);

        if (index >= 0) {
          this.workoutSessions[index] = {
            ...this.workoutSessions[index],
            scheduledDate,
          };
        }

        return { lastInsertRowId: 0, changes: index >= 0 ? 1 : 0 };
      }

      if (source.includes('UPDATE CardioSession') && source.includes('SET scheduledDate = ?')) {
        const scheduledDate = readStringParam(params, 0, 'scheduledDate');
        const sessionId = readStringParam(params, 1, 'sessionId');
        const index = this.cardioSessions.findIndex((row) => row.id === sessionId);

        if (index >= 0) {
          this.cardioSessions[index] = {
            ...this.cardioSessions[index],
            scheduledDate,
          };
        }

        return { lastInsertRowId: 0, changes: index >= 0 ? 1 : 0 };
      }

      if (source.includes("UPDATE WorkoutSession SET status = 'skipped'")) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const index = this.workoutSessions.findIndex((row) => row.id === sessionId);

        if (index >= 0) {
          this.workoutSessions[index] = {
            ...this.workoutSessions[index],
            status: 'skipped',
          };
        }

        return { lastInsertRowId: 0, changes: index >= 0 ? 1 : 0 };
      }

      if (source.includes("UPDATE CardioSession SET status = 'skipped'")) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const index = this.cardioSessions.findIndex((row) => row.id === sessionId);

        if (index >= 0) {
          this.cardioSessions[index] = {
            ...this.cardioSessions[index],
            status: 'skipped',
          };
        }

        return { lastInsertRowId: 0, changes: index >= 0 ? 1 : 0 };
      }

      if (source.includes('UPDATE WorkoutSession') && source.includes('SET status = ?')) {
        const sessionId = readStringParam(params, 11, 'sessionId');
        const index = this.workoutSessions.findIndex((row) => row.id === sessionId);

        if (index >= 0) {
          this.workoutSessions[index] = {
            ...this.workoutSessions[index],
            status: readStringParam(params, 0, 'status'),
            scheduledDate: readNullableStringParam(params, 1, 'scheduledDate'),
            scheduledTime: readNullableStringParam(params, 2, 'scheduledTime'),
            startedAt: readNullableStringParam(params, 3, 'startedAt'),
            completedAt: readNullableStringParam(params, 4, 'completedAt'),
            isRetroactive: readNumberParam(params, 5, 'isRetroactive'),
            workoutDate: readNullableStringParam(params, 6, 'workoutDate'),
            durationMinutes: readNullableNumberParam(params, 7, 'durationMinutes'),
            durationOverridden: readNumberParam(params, 8, 'durationOverridden'),
            rpe: readNullableNumberParam(params, 9, 'rpe'),
            note: readNullableStringParam(params, 10, 'note'),
          };
        }

        return { lastInsertRowId: 0, changes: index >= 0 ? 1 : 0 };
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
        return row ? ({ name: row.name, sql: row.sql } as T) : null;
      }

      if (source.includes('FROM User u')) {
        const userId = readStringParam(params, 0, 'userId');
        const user = this.users.find((row) => row.id === userId) ?? null;

        if (!user) {
          return null;
        }

        const preference = this.preferences.find((row) => row.userId === user.id);
        return {
          timezone: user.timezone,
          dayEndTime: preference?.dayEndTime ?? null,
        } as T;
      }

      if (source.includes('FROM WorkoutSession') && source.includes('id != ?')) {
        const sourceSessionId = readStringParam(params, 0, 'sessionId');
        const destinationDate = readStringParam(params, 1, 'destinationDate');
        const templateId = readNullableStringParam(params, 2, 'templateId');
        const conflict = this.workoutSessions.find(
          (row) =>
            row.id !== sourceSessionId &&
            row.scheduledDate === destinationDate &&
            row.templateId === templateId
        );
        return conflict ? ({ id: conflict.id } as T) : null;
      }

      if (source.includes('FROM CardioSession') && source.includes('id != ?')) {
        const sourceSessionId = readStringParam(params, 0, 'sessionId');
        const destinationDate = readStringParam(params, 1, 'destinationDate');
        const templateId = readNullableStringParam(params, 2, 'templateId');
        const conflict = this.cardioSessions.find(
          (row) =>
            row.id !== sourceSessionId &&
            row.scheduledDate === destinationDate &&
            row.templateId === templateId
        );
        return conflict ? ({ id: conflict.id } as T) : null;
      }

      if (source.includes('FROM WorkoutSession')) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const row = this.workoutSessions.find((candidate) => candidate.id === sessionId);
        return row ? (cloneWorkoutSessionRow(row) as T) : null;
      }

      if (source.includes('FROM CardioSession')) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const row = this.cardioSessions.find((candidate) => candidate.id === sessionId);
        return row ? (cloneCardioSessionRow(row) as T) : null;
      }

      return null;
    }

    async getAllAsync<T>(
      source: string,
      ...params: MockBindValue[]
    ): Promise<T[]> {
      if (source.includes('FROM WorkoutSchedule s')) {
        if (failNextWorkoutScheduleLoad) {
          failNextWorkoutScheduleLoad = false;
          throw new Error('Forced workout schedule load failure.');
        }

        const userId = readStringParam(params, 0, 'userId');
        const windowEnd = readStringParam(params, 1, 'windowEnd');
        const windowStart = readStringParam(params, 2, 'windowStart');

        return this.workoutSchedules
          .filter(
            (row) =>
              row.userId === userId &&
              row.isActive === 1 &&
              row.deletedAt === null &&
              row.startDate <= windowEnd &&
              (row.endDate === null || row.endDate >= windowStart)
          )
          .map((schedule) => ({
            ...cloneScheduleRow(schedule),
            templateName:
              this.workoutTemplates.find((template) => template.id === schedule.templateId)
                ?.name ?? null,
          })) as T[];
      }

      if (source.includes('FROM CardioSchedule s')) {
        const userId = readStringParam(params, 0, 'userId');
        const windowEnd = readStringParam(params, 1, 'windowEnd');
        const windowStart = readStringParam(params, 2, 'windowStart');

        return this.cardioSchedules
          .filter(
            (row) =>
              row.userId === userId &&
              row.isActive === 1 &&
              row.deletedAt === null &&
              row.startDate <= windowEnd &&
              (row.endDate === null || row.endDate >= windowStart)
          )
          .flatMap((schedule) => {
            const template = this.cardioTemplates.find(
              (candidate) => candidate.id === schedule.templateId
            );

            if (!template) {
              return [];
            }

            return [
              {
                ...cloneScheduleRow(schedule),
                templateName: template.name,
                templateType: template.type,
                templateSubtype: template.subtype,
              },
            ];
          }) as T[];
      }

      if (source.includes('FROM Habit')) {
        return [];
      }

      if (source.includes('FROM WorkoutSession')) {
        const userId = readStringParam(params, 0, 'userId');
        const selectedDate = readStringParam(params, 1, 'selectedDate');

        return this.workoutSessions
          .filter(
            (row) =>
              row.userId === userId &&
              isTodayFitnessStatus(row.status) &&
              (row.scheduledDate === selectedDate ||
                row.workoutDate === selectedDate ||
                datePart(row.startedAt) === selectedDate ||
                datePart(row.completedAt) === selectedDate)
          )
          .sort(compareFitnessRows)
          .map(cloneWorkoutSessionRow) as T[];
      }

      if (source.includes('FROM CardioSession')) {
        const userId = readStringParam(params, 0, 'userId');
        const selectedDate = readStringParam(params, 1, 'selectedDate');

        return this.cardioSessions
          .filter(
            (row) =>
              row.userId === userId &&
              isTodayFitnessStatus(row.status) &&
              (row.scheduledDate === selectedDate ||
                row.cardioDate === selectedDate ||
                datePart(row.startedAt) === selectedDate ||
                datePart(row.completedAt) === selectedDate)
          )
          .sort(compareFitnessRows)
          .map(cloneCardioSessionRow) as T[];
      }

      return [];
    }

    snapshot(): MockSnapshot {
      return this.snapshotInternal();
    }

    private insertWorkoutSession(
      row: MockWorkoutSessionRow,
      ignoreDuplicates: boolean
    ): { lastInsertRowId: number; changes: number } {
      if (this.hasWorkoutGeneratedDuplicate(row)) {
        if (ignoreDuplicates) {
          return { lastInsertRowId: 0, changes: 0 };
        }

        throw new Error('UNIQUE constraint failed: WorkoutSession.scheduleId, WorkoutSession.generatedForDate');
      }

      this.workoutSessions.push(row);
      return { lastInsertRowId: this.workoutSessions.length, changes: 1 };
    }

    private insertCardioSession(
      row: MockCardioSessionRow,
      ignoreDuplicates: boolean
    ): { lastInsertRowId: number; changes: number } {
      if (this.hasCardioGeneratedDuplicate(row)) {
        if (ignoreDuplicates) {
          return { lastInsertRowId: 0, changes: 0 };
        }

        throw new Error('UNIQUE constraint failed: CardioSession.scheduleId, CardioSession.generatedForDate');
      }

      this.cardioSessions.push(row);
      return { lastInsertRowId: this.cardioSessions.length, changes: 1 };
    }

    private hasWorkoutGeneratedDuplicate(row: MockWorkoutSessionRow): boolean {
      return Boolean(
        this.workoutGeneratedUniqueIndex &&
          row.scheduleId &&
          row.generatedForDate &&
          this.workoutSessions.some(
            (candidate) =>
              candidate.scheduleId === row.scheduleId &&
              candidate.generatedForDate === row.generatedForDate
          )
      );
    }

    private hasCardioGeneratedDuplicate(row: MockCardioSessionRow): boolean {
      return Boolean(
        this.cardioGeneratedUniqueIndex &&
          row.scheduleId &&
          row.generatedForDate &&
          this.cardioSessions.some(
            (candidate) =>
              candidate.scheduleId === row.scheduleId &&
              candidate.generatedForDate === row.generatedForDate
          )
      );
    }

    private recordSchema(source: string): void {
      if (source.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
        this.upsertSchemaObject({
          type: 'table',
          name: 'schema_version',
          sql: 'CREATE TABLE schema_version (version INTEGER NOT NULL)',
        });
      }

      if (source.includes('CREATE TABLE IF NOT EXISTS WorkoutSession')) {
        this.setColumns('WorkoutSession', [
          'id',
          'userId',
          'templateId',
          'scheduleId',
          'name',
          'templateNameSnapshot',
          'status',
          'scheduledDate',
          'scheduledTime',
          'startedAt',
          'completedAt',
          'loggedAt',
          'isRetroactive',
          'workoutDate',
          'durationMinutes',
          'durationOverridden',
          'rpe',
          'note',
        ]);
      }

      if (source.includes('CREATE TABLE IF NOT EXISTS CardioSession')) {
        this.setColumns('CardioSession', [
          'id',
          'userId',
          'templateId',
          'scheduleId',
          'templateNameSnapshot',
          'type',
          'subtype',
          'sportName',
          'status',
          'scheduledDate',
          'scheduledTime',
          'startedAt',
          'completedAt',
          'loggedAt',
          'isRetroactive',
          'cardioDate',
          'durationMinutes',
          'durationOverridden',
          'distanceMiles',
          'caloriesBurned',
          'elevationGainFt',
          'rpe',
          'heartRateAvg',
          'heartRateMax',
          'cadence',
          'resistance',
          'powerWatts',
          'route',
          'note',
        ]);
      }

      if (source.includes('CREATE TABLE WorkoutSession_migration_3')) {
        this.setColumns('WorkoutSession', [
          'id',
          'userId',
          'templateId',
          'scheduleId',
          'generatedForDate',
          'name',
          'templateNameSnapshot',
          'status',
          'scheduledDate',
          'scheduledTime',
          'startedAt',
          'completedAt',
          'loggedAt',
          'isRetroactive',
          'workoutDate',
          'durationMinutes',
          'durationOverridden',
          'rpe',
          'note',
          'liveState',
        ]);
      }

      if (source.includes('CREATE TABLE CardioSession_migration_3')) {
        this.setColumns('CardioSession', [
          'id',
          'userId',
          'templateId',
          'scheduleId',
          'generatedForDate',
          'templateNameSnapshot',
          'type',
          'subtype',
          'sportName',
          'status',
          'scheduledDate',
          'scheduledTime',
          'startedAt',
          'completedAt',
          'loggedAt',
          'isRetroactive',
          'cardioDate',
          'durationMinutes',
          'durationOverridden',
          'distanceMiles',
          'caloriesBurned',
          'elevationGainFt',
          'rpe',
          'heartRateAvg',
          'heartRateMax',
          'cadence',
          'resistance',
          'powerWatts',
          'route',
          'note',
        ]);
      }

      if (source.includes('idx_workoutSession_schedule_generatedForDate')) {
        this.workoutGeneratedUniqueIndex = true;
        this.upsertSchemaObject({
          type: 'index',
          name: 'idx_workoutSession_schedule_generatedForDate',
          sql: 'CREATE UNIQUE INDEX idx_workoutSession_schedule_generatedForDate ON WorkoutSession(scheduleId, generatedForDate) WHERE generatedForDate IS NOT NULL',
        });
      }

      if (source.includes('idx_cardioSession_schedule_generatedForDate')) {
        this.cardioGeneratedUniqueIndex = true;
        this.upsertSchemaObject({
          type: 'index',
          name: 'idx_cardioSession_schedule_generatedForDate',
          sql: 'CREATE UNIQUE INDEX idx_cardioSession_schedule_generatedForDate ON CardioSession(scheduleId, generatedForDate) WHERE generatedForDate IS NOT NULL',
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

    private setColumns(table: string, columns: string[]): void {
      this.tableColumns.set(table, new Set(columns));
    }

    private snapshotInternal(): MockSnapshot {
      return {
        schemaVersion: this.schemaVersion,
        schemaObjects: this.schemaObjects.map(cloneSchemaObjectRow),
        tableColumns: Object.fromEntries(
          [...this.tableColumns.entries()].map(([table, columns]) => [
            table,
            [...columns],
          ])
        ),
        workoutSessions: this.workoutSessions.map(cloneWorkoutSessionRow),
        cardioSessions: this.cardioSessions.map(cloneCardioSessionRow),
      };
    }

    private restore(snapshot: MockSnapshot): void {
      this.schemaVersion = snapshot.schemaVersion;
      this.schemaObjects = snapshot.schemaObjects.map(cloneSchemaObjectRow);
      this.tableColumns = new Map(
        Object.entries(snapshot.tableColumns).map(([table, columns]) => [
          table,
          new Set(columns),
        ])
      );
      this.workoutSessions = snapshot.workoutSessions.map(cloneWorkoutSessionRow);
      this.cardioSessions = snapshot.cardioSessions.map(cloneCardioSessionRow);
    }
  }

  const namedDatabases = new Map<string, MockSQLiteDatabase>();

  return {
    __clearQueryFailures: () => {
      failNextWorkoutScheduleLoad = false;
    },
    __failNextWorkoutScheduleLoad: () => {
      failNextWorkoutScheduleLoad = true;
    },
    __getSnapshot: (databaseName = ':current:') => {
      const database =
        databaseName === ':current:' ? currentDatabase : namedDatabases.get(databaseName);

      if (!database) {
        throw new Error(`Mock database "${databaseName}" was not opened.`);
      }

      return database.snapshot();
    },
    __resetDatabase: (databaseName: string) => {
      namedDatabases.delete(databaseName);
      if (databaseName === ':current:') {
        currentDatabase = null;
      }
    },
    __setSchemaVersion: (databaseName: string, version: number) => {
      getNamedDatabase(databaseName).setSchemaVersion(version);
    },
    openDatabaseAsync: async (databaseName = 'habit.db') => {
      const database =
        databaseName === ':memory:' ? new MockSQLiteDatabase() : getNamedDatabase(databaseName);
      currentDatabase = database;
      return database;
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

  function readScheduleInsert(
    source: string,
    params: MockBindValue[]
  ): MockScheduleRow {
    const columns = readInsertColumns(source, 'WorkoutSchedule', 'CardioSchedule');

    return {
      id: readStringColumn(columns, params, 'id'),
      userId: readStringColumn(columns, params, 'userId'),
      templateId: readStringColumn(columns, params, 'templateId'),
      name: readNullableStringColumn(columns, params, 'name'),
      frequencyType: readStringColumn(columns, params, 'frequencyType'),
      daysOfWeek: readNullableStringColumn(columns, params, 'daysOfWeek'),
      intervalDays: readNullableNumberColumn(columns, params, 'intervalDays'),
      intervalWeeks: readNullableNumberColumn(columns, params, 'intervalWeeks'),
      scheduledTime: readNullableStringColumn(columns, params, 'scheduledTime'),
      startDate: readStringColumn(columns, params, 'startDate'),
      endDate: readNullableStringColumn(columns, params, 'endDate'),
      isActive: readNumberColumn(columns, params, 'isActive', 1),
      createdAt: readStringColumn(columns, params, 'createdAt'),
      deletedAt: readNullableStringColumn(columns, params, 'deletedAt'),
    };
  }

  function readWorkoutSessionInsert(
    source: string,
    params: MockBindValue[]
  ): MockWorkoutSessionRow {
    const columns = readInsertColumns(source, 'WorkoutSession');

    return {
      id: readStringColumn(columns, params, 'id'),
      userId: readStringColumn(columns, params, 'userId'),
      templateId: readNullableStringColumn(columns, params, 'templateId'),
      scheduleId: readNullableStringColumn(columns, params, 'scheduleId'),
      generatedForDate: readNullableStringColumn(columns, params, 'generatedForDate'),
      name: readNullableStringColumn(columns, params, 'name'),
      templateNameSnapshot: readNullableStringColumn(
        columns,
        params,
        'templateNameSnapshot'
      ),
      status: readStringColumn(columns, params, 'status', 'planned'),
      scheduledDate: readNullableStringColumn(columns, params, 'scheduledDate'),
      scheduledTime: readNullableStringColumn(columns, params, 'scheduledTime'),
      startedAt: readNullableStringColumn(columns, params, 'startedAt'),
      completedAt: readNullableStringColumn(columns, params, 'completedAt'),
      loggedAt: readStringColumn(columns, params, 'loggedAt'),
      isRetroactive: readNumberColumn(columns, params, 'isRetroactive', 0),
      workoutDate: readNullableStringColumn(columns, params, 'workoutDate'),
      durationMinutes: readNullableNumberColumn(columns, params, 'durationMinutes'),
      durationOverridden: readNumberColumn(columns, params, 'durationOverridden', 0),
      rpe: readNullableNumberColumn(columns, params, 'rpe'),
      note: readNullableStringColumn(columns, params, 'note'),
      liveState: readNullableStringColumn(columns, params, 'liveState'),
    };
  }

  function readCardioSessionInsert(
    source: string,
    params: MockBindValue[]
  ): MockCardioSessionRow {
    const columns = readInsertColumns(source, 'CardioSession');

    return {
      id: readStringColumn(columns, params, 'id'),
      userId: readStringColumn(columns, params, 'userId'),
      templateId: readNullableStringColumn(columns, params, 'templateId'),
      scheduleId: readNullableStringColumn(columns, params, 'scheduleId'),
      generatedForDate: readNullableStringColumn(columns, params, 'generatedForDate'),
      templateNameSnapshot: readNullableStringColumn(
        columns,
        params,
        'templateNameSnapshot'
      ),
      type: readStringColumn(columns, params, 'type'),
      subtype: readNullableStringColumn(columns, params, 'subtype'),
      sportName: readNullableStringColumn(columns, params, 'sportName'),
      status: readStringColumn(columns, params, 'status', 'planned'),
      scheduledDate: readNullableStringColumn(columns, params, 'scheduledDate'),
      scheduledTime: readNullableStringColumn(columns, params, 'scheduledTime'),
      startedAt: readNullableStringColumn(columns, params, 'startedAt'),
      completedAt: readNullableStringColumn(columns, params, 'completedAt'),
      loggedAt: readStringColumn(columns, params, 'loggedAt'),
      isRetroactive: readNumberColumn(columns, params, 'isRetroactive', 0),
      cardioDate: readNullableStringColumn(columns, params, 'cardioDate'),
      durationMinutes: readNullableNumberColumn(columns, params, 'durationMinutes'),
      durationOverridden: readNumberColumn(columns, params, 'durationOverridden', 0),
      distanceMiles: readNullableNumberColumn(columns, params, 'distanceMiles'),
      caloriesBurned: readNullableNumberColumn(columns, params, 'caloriesBurned'),
      elevationGainFt: readNullableNumberColumn(columns, params, 'elevationGainFt'),
      rpe: readNullableNumberColumn(columns, params, 'rpe'),
      heartRateAvg: readNullableNumberColumn(columns, params, 'heartRateAvg'),
      heartRateMax: readNullableNumberColumn(columns, params, 'heartRateMax'),
      cadence: readNullableNumberColumn(columns, params, 'cadence'),
      resistance: readNullableNumberColumn(columns, params, 'resistance'),
      powerWatts: readNullableNumberColumn(columns, params, 'powerWatts'),
      route: readNullableStringColumn(columns, params, 'route'),
      note: readNullableStringColumn(columns, params, 'note'),
    };
  }

  function readInsertColumns(source: string, ...tableNames: string[]): string[] {
    for (const tableName of tableNames) {
      const match = new RegExp(
        `INSERT(?:\\s+OR\\s+IGNORE)?\\s+INTO\\s+${tableName}\\s*\\(([\\s\\S]*?)\\)`,
        'i'
      ).exec(source);

      if (match?.[1]) {
        return match[1]
          .split(',')
          .map((column) => column.trim().replaceAll('"', ''));
      }
    }

    throw new Error('Unable to read insert columns.');
  }

  function readStringColumn(
    columns: string[],
    params: MockBindValue[],
    column: string,
    fallback?: string
  ): string {
    const value = readColumnValue(columns, params, column);

    if (value === undefined && fallback !== undefined) {
      return fallback;
    }

    if (typeof value !== 'string') {
      throw new Error(`Expected ${column} to be a string.`);
    }

    return value;
  }

  function readNullableStringColumn(
    columns: string[],
    params: MockBindValue[],
    column: string
  ): string | null {
    const value = readColumnValue(columns, params, column);

    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new Error(`Expected ${column} to be a string or null.`);
    }

    return value;
  }

  function readNumberColumn(
    columns: string[],
    params: MockBindValue[],
    column: string,
    fallback?: number
  ): number {
    const value = readColumnValue(columns, params, column);

    if (value === undefined && fallback !== undefined) {
      return fallback;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Expected ${column} to be a number.`);
    }

    return value;
  }

  function readNullableNumberColumn(
    columns: string[],
    params: MockBindValue[],
    column: string
  ): number | null {
    const value = readColumnValue(columns, params, column);

    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Expected ${column} to be a number or null.`);
    }

    return value;
  }

  function readColumnValue(
    columns: string[],
    params: MockBindValue[],
    column: string
  ): MockBindValue | undefined {
    const index = columns.indexOf(column);
    return index >= 0 ? params[index] : undefined;
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

    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new Error(`Expected ${label} to be a string or null.`);
    }

    return value;
  }

  function readNumberParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): number {
    const value = params[index];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
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

    if (value === null) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Expected ${label} to be a number or null.`);
    }

    return value;
  }

  function isTodayFitnessStatus(status: string): boolean {
    return ['planned', 'live', 'completed', 'skipped'].includes(status);
  }

  function compareFitnessRows(
    a: MockWorkoutSessionRow | MockCardioSessionRow,
    b: MockWorkoutSessionRow | MockCardioSessionRow
  ): number {
    const timeCompare = compareNullableStrings(a.scheduledTime, b.scheduledTime);
    if (timeCompare !== 0) return timeCompare;
    return a.id.localeCompare(b.id);
  }

  function compareNullableStrings(a: string | null, b: string | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  }

  function datePart(value: string | null): string | null {
    return value ? value.slice(0, 10) : null;
  }

  function cloneSchemaObjectRow(row: MockSchemaObjectRow): MockSchemaObjectRow {
    return { ...row };
  }

  function cloneScheduleRow(row: MockScheduleRow): MockScheduleRow {
    return { ...row };
  }

  function cloneWorkoutSessionRow(row: MockWorkoutSessionRow): MockWorkoutSessionRow {
    return { ...row };
  }

  function cloneCardioSessionRow(row: MockCardioSessionRow): MockCardioSessionRow {
    return { ...row };
  }
});

describe('schedule generation service', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    await runMigrations(':memory:');
    getMockSqlite().__clearQueryFailures();
    useWorkoutStore.getState().abandonSession();
    useUserStore.setState({
      userId: 'user-id',
      timezone: 'UTC',
      appMode: AppMode.COMBINED,
      preferences: preferences(),
    });
    await seedUser();
    await seedUserPreferences();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('applies the fitness session migration on fresh and prior databases', async () => {
    const sqlite = getMockSqlite();
    const freshDatabaseName = 'fitness-migration-fresh.db';
    sqlite.__resetDatabase(freshDatabaseName);

    await runMigrations(freshDatabaseName);

    const freshSnapshot = sqlite.__getSnapshot(freshDatabaseName);
    expect(freshSnapshot.schemaVersion).toBe(3);
    expect(freshSnapshot.tableColumns.WorkoutSession).toEqual(
      expect.arrayContaining(['generatedForDate', 'liveState'])
    );
    expect(freshSnapshot.tableColumns.CardioSession).toEqual(
      expect.arrayContaining(['generatedForDate'])
    );
    expect(freshSnapshot.schemaObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'index',
          name: 'idx_workoutSession_schedule_generatedForDate',
          sql: expect.stringContaining('WHERE generatedForDate IS NOT NULL'),
        }),
        expect.objectContaining({
          type: 'index',
          name: 'idx_cardioSession_schedule_generatedForDate',
          sql: expect.stringContaining('WHERE generatedForDate IS NOT NULL'),
        }),
      ])
    );

    const priorDatabaseName = 'fitness-migration-prior.db';
    sqlite.__resetDatabase(priorDatabaseName);
    sqlite.__setSchemaVersion(priorDatabaseName, 2);

    await runMigrations(priorDatabaseName);

    const priorSnapshot = sqlite.__getSnapshot(priorDatabaseName);
    expect(priorSnapshot.schemaVersion).toBe(3);
    expect(priorSnapshot.tableColumns.WorkoutSession).toEqual(
      expect.arrayContaining(['generatedForDate', 'liveState'])
    );
    expect(priorSnapshot.tableColumns.CardioSession).toEqual(
      expect.arrayContaining(['generatedForDate'])
    );
  });

  it('rejects duplicate generated slots through the partial unique index', async () => {
    await insertWorkoutSession({
      id: 'generated-one',
      scheduleId: 'schedule-id',
      generatedForDate: '2026-05-04',
      scheduledDate: '2026-05-04',
    });

    await expect(
      insertWorkoutSession({
        id: 'generated-two',
        scheduleId: 'schedule-id',
        generatedForDate: '2026-05-04',
        scheduledDate: '2026-05-04',
      })
    ).rejects.toThrow('UNIQUE constraint failed');

    await expect(
      insertWorkoutSession({
        id: 'manual-one',
        scheduleId: 'schedule-id',
        generatedForDate: null,
        scheduledDate: '2026-05-04',
      })
    ).resolves.toBeUndefined();
    await expect(
      insertWorkoutSession({
        id: 'manual-two',
        scheduleId: 'schedule-id',
        generatedForDate: null,
        scheduledDate: '2026-05-04',
      })
    ).resolves.toBeUndefined();
  });

  it('generates planned workout and cardio sessions for each slot and is idempotent', async () => {
    await seedWorkoutTemplate({ id: 'strength-template', name: 'Strength' });
    await seedWorkoutSchedule({
      id: 'strength-schedule',
      templateId: 'strength-template',
      name: 'Lift',
      frequencyType: WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK,
      daysOfWeek: [1, 3, 5],
      scheduledTime: '08:00',
      startDate: '2026-05-04',
    });
    await seedCardioTemplate({ id: 'run-template', name: 'Run' });
    await seedCardioSchedule({
      id: 'run-schedule',
      templateId: 'run-template',
      frequencyType: WorkoutScheduleFrequency.EVERY_N_DAYS,
      intervalDays: 2,
      scheduledTime: '18:00',
      startDate: '2026-05-04',
    });

    await generateSessions('user-id', '2026-05-04T12:00:00.000Z');
    await generateSessions('user-id', '2026-05-04T12:00:00.000Z');

    const snapshot = getMockSqlite().__getSnapshot();
    expect(
      snapshot.workoutSessions.map((session) => [
        session.status,
        session.scheduledDate,
        session.generatedForDate,
        session.name,
        session.templateNameSnapshot,
      ])
    ).toEqual([
      ['planned', '2026-05-04', '2026-05-04', 'Lift', 'Strength'],
      ['planned', '2026-05-06', '2026-05-06', 'Lift', 'Strength'],
      ['planned', '2026-05-08', '2026-05-08', 'Lift', 'Strength'],
    ]);
    expect(
      snapshot.cardioSessions.map((session) => [
        session.status,
        session.scheduledDate,
        session.generatedForDate,
        session.templateNameSnapshot,
        session.type,
      ])
    ).toEqual([
      ['planned', '2026-05-04', '2026-05-04', 'Run', CardioType.RUNNING],
      ['planned', '2026-05-06', '2026-05-06', 'Run', CardioType.RUNNING],
      ['planned', '2026-05-08', '2026-05-08', 'Run', CardioType.RUNNING],
      ['planned', '2026-05-10', '2026-05-10', 'Run', CardioType.RUNNING],
    ]);
  });

  it('does not backfill a generated slot vacated by Move to Tomorrow', async () => {
    await seedWorkoutTemplate({ id: 'template-id', name: 'Strength' });
    await seedWorkoutSchedule({
      id: 'schedule-id',
      templateId: 'template-id',
      frequencyType: WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK,
      daysOfWeek: [1],
      startDate: '2026-05-04',
    });
    await generateSessions('user-id', '2026-05-04T12:00:00.000Z');

    const generatedSession = requireSingleWorkoutSession();
    await expect(
      moveTodayFitnessSessionToTomorrow('workout', generatedSession.id, '2026-05-04')
    ).resolves.toEqual({
      ok: true,
      kind: 'workout',
      sessionId: generatedSession.id,
      destinationDate: '2026-05-05',
    });

    await generateSessions('user-id', '2026-05-04T12:00:00.000Z');

    const sessions = getMockSqlite().__getSnapshot().workoutSessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual(
      expect.objectContaining({
        id: generatedSession.id,
        scheduledDate: '2026-05-05',
        generatedForDate: '2026-05-04',
      })
    );
    expect(sessions.some((session) => session.scheduledDate === '2026-05-04')).toBe(
      false
    );
  });

  it('treats skipped and completed generated sessions as occupying their origin slot', async () => {
    await seedWorkoutTemplate({ id: 'skip-template', name: 'Skip Lift' });
    await seedWorkoutTemplate({ id: 'done-template', name: 'Done Lift' });
    await seedWorkoutSchedule({
      id: 'skip-schedule',
      templateId: 'skip-template',
      frequencyType: WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK,
      daysOfWeek: [1],
      startDate: '2026-05-04',
    });
    await seedWorkoutSchedule({
      id: 'done-schedule',
      templateId: 'done-template',
      frequencyType: WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK,
      daysOfWeek: [3],
      startDate: '2026-05-04',
    });
    await insertWorkoutSession({
      id: 'skipped-session',
      templateId: 'skip-template',
      scheduleId: 'skip-schedule',
      generatedForDate: '2026-05-04',
      scheduledDate: '2026-05-04',
      status: 'skipped',
    });
    await insertWorkoutSession({
      id: 'completed-session',
      templateId: 'done-template',
      scheduleId: 'done-schedule',
      generatedForDate: '2026-05-06',
      scheduledDate: '2026-05-06',
      status: 'completed',
      workoutDate: '2026-05-06',
    });

    await generateSessions('user-id', '2026-05-04T12:00:00.000Z');

    const sessions = getMockSqlite().__getSnapshot().workoutSessions;
    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => [session.id, session.status])).toEqual([
      ['skipped-session', 'skipped'],
      ['completed-session', 'completed'],
    ]);
  });

  it('generates a scheduled slot even when a manual session exists on that date', async () => {
    await seedWorkoutTemplate({ id: 'template-id', name: 'Strength' });
    await seedWorkoutSchedule({
      id: 'schedule-id',
      templateId: 'template-id',
      frequencyType: WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK,
      daysOfWeek: [1],
      startDate: '2026-05-04',
    });
    await insertWorkoutSession({
      id: 'manual-session',
      templateId: 'template-id',
      scheduleId: null,
      generatedForDate: null,
      scheduledDate: '2026-05-04',
      status: 'planned',
    });

    await generateSessions('user-id', '2026-05-04T12:00:00.000Z');

    const sessions = getMockSqlite().__getSnapshot().workoutSessions;
    expect(sessions).toHaveLength(2);
    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manual-session',
          generatedForDate: null,
          scheduledDate: '2026-05-04',
        }),
        expect.objectContaining({
          scheduleId: 'schedule-id',
          generatedForDate: '2026-05-04',
          scheduledDate: '2026-05-04',
        }),
      ])
    );
  });

  it('starts the generation window from the current logical date at dayEndTime boundary', async () => {
    await seedUser('user-id', 'America/New_York');
    await seedUserPreferences('user-id', '03:00');
    await seedWorkoutTemplate({ id: 'template-id', name: 'Daily Lift' });
    await seedWorkoutSchedule({
      id: 'schedule-id',
      templateId: 'template-id',
      frequencyType: WorkoutScheduleFrequency.EVERY_N_DAYS,
      intervalDays: 1,
      startDate: '2026-05-01',
    });

    await generateSessions('user-id', '2026-05-08T05:00:00.000Z');

    expect(
      getMockSqlite()
        .__getSnapshot()
        .workoutSessions.map((session) => session.generatedForDate)
    ).toEqual([
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
    ]);
  });

  it('logs and continues Today composition when generation throws', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await seedWorkoutTemplate({ id: 'template-id', name: 'Strength' });
    await insertWorkoutSession({
      id: 'existing-session',
      templateId: 'template-id',
      scheduledDate: '2026-05-04',
      status: 'planned',
    });
    getMockSqlite().__failNextWorkoutScheduleLoad();

    await expect(
      getTodayViewModel({
        selectedDate: '2026-05-04',
        currentDate: '2026-05-04T12:00:00.000Z',
        userId: 'user-id',
        preferences: preferences(),
      })
    ).resolves.toEqual(
      expect.objectContaining({
        fitnessItems: [
          expect.objectContaining({
            id: 'existing-session',
            status: 'planned',
          }),
        ],
      })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Schedule generation failed during Today composition.',
      expect.any(Error)
    );
  });

  it('leaves generatedForDate untouched when sessions are skipped', async () => {
    await insertWorkoutSession({
      id: 'skip-session',
      scheduleId: 'schedule-id',
      generatedForDate: '2026-05-04',
      scheduledDate: '2026-05-04',
      status: 'planned',
    });

    await expect(skipTodayFitnessSession('workout', 'skip-session')).resolves.toEqual({
      ok: true,
      kind: 'workout',
      sessionId: 'skip-session',
    });

    expect(requireSingleWorkoutSession()).toEqual(
      expect.objectContaining({
        status: 'skipped',
        scheduledDate: '2026-05-04',
        generatedForDate: '2026-05-04',
      })
    );
  });

  it('updates an existing planned workout session in place on completion', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-08T06:00:00.000Z'));
    useUserStore.setState({
      userId: 'user-id',
      timezone: 'America/New_York',
      appMode: AppMode.COMBINED,
      preferences: preferences({ dayEndTime: '03:00' }),
    });
    await insertWorkoutSession({
      id: 'planned-session',
      templateId: 'template-id',
      scheduleId: 'schedule-id',
      generatedForDate: '2026-05-04',
      scheduledDate: '2026-05-04',
      status: 'planned',
    });
    useWorkoutStore.getState().startSession(
      workoutSession({
        id: 'planned-session',
        templateId: 'template-id',
        scheduleId: 'schedule-id',
        generatedForDate: '2026-05-04',
        scheduledDate: '2026-05-04',
        startedAt: '2026-05-08T05:00:00.000Z',
      })
    );

    await useWorkoutStore.getState().completeSession();

    const sessions = getMockSqlite().__getSnapshot().workoutSessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual(
      expect.objectContaining({
        id: 'planned-session',
        status: 'completed',
        startedAt: '2026-05-08T05:00:00.000Z',
        completedAt: '2026-05-08T06:00:00.000Z',
        workoutDate: '2026-05-07',
        scheduledDate: '2026-05-04',
        generatedForDate: '2026-05-04',
      })
    );
  });

  it('still inserts when workout completion has no existing session row', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-08T06:00:00.000Z'));
    useUserStore.setState({
      userId: 'user-id',
      timezone: 'UTC',
      appMode: AppMode.COMBINED,
      preferences: preferences(),
    });
    useWorkoutStore.getState().startSession(
      workoutSession({
        id: 'new-retro-session',
        isRetroactive: true,
        workoutDate: '2026-05-05',
        startedAt: '2026-05-08T05:00:00.000Z',
      })
    );

    await useWorkoutStore.getState().completeSession();

    expect(getMockSqlite().__getSnapshot().workoutSessions).toEqual([
      expect.objectContaining({
        id: 'new-retro-session',
        status: 'completed',
        isRetroactive: 1,
        workoutDate: '2026-05-05',
        completedAt: '2026-05-08T06:00:00.000Z',
      }),
    ]);
  });
});

function getMockSqlite(): MockSqliteControls {
  return jest.requireMock('expo-sqlite') as MockSqliteControls;
}

function preferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    userId: overrides.userId ?? 'user-id',
    appMode: overrides.appMode ?? AppMode.COMBINED,
    weightUnit: overrides.weightUnit ?? 'lbs',
    distanceUnit: overrides.distanceUnit ?? 'mi',
    weekStartDay: overrides.weekStartDay ?? 0,
    defaultRestSeconds: overrides.defaultRestSeconds,
    defaultReps: overrides.defaultReps,
    defaultSets: overrides.defaultSets,
    theme: overrides.theme ?? 'system',
    colorScheme: overrides.colorScheme ?? 'muted',
    requireBiometricForHiddenHabits: overrides.requireBiometricForHiddenHabits ?? false,
    dayEndTime: overrides.dayEndTime ?? '00:00',
    seenProgressionIntentTooltip: overrides.seenProgressionIntentTooltip ?? false,
    modulesEnabled: overrides.modulesEnabled ?? [],
    heightCm: overrides.heightCm,
    dateOfBirth: overrides.dateOfBirth,
    biologicalSex: overrides.biologicalSex,
    tdeeCalories: overrides.tdeeCalories,
    goals: overrides.goals ?? [],
  };
}

async function seedUser(
  userId = 'user-id',
  timezone = 'UTC',
  createdAt = '2026-05-01T00:00:00.000Z'
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO User (id, timezone, createdAt)
    VALUES (?, ?, ?)`,
    userId,
    timezone,
    createdAt
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

async function seedWorkoutTemplate({
  id,
  userId = 'user-id',
  name = 'Workout Template',
}: {
  id: string;
  userId?: string;
  name?: string | null;
}): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO WorkoutTemplate (id, userId, name)
    VALUES (?, ?, ?)`,
    id,
    userId,
    name
  );
}

async function seedCardioTemplate({
  id,
  userId = 'user-id',
  name = 'Cardio Template',
  type = CardioType.RUNNING,
  subtype = null,
}: {
  id: string;
  userId?: string;
  name?: string | null;
  type?: string;
  subtype?: string | null;
}): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO CardioTemplate (id, userId, name, type, subtype)
    VALUES (?, ?, ?, ?, ?)`,
    id,
    userId,
    name,
    type,
    subtype
  );
}

async function seedWorkoutSchedule(
  overrides: Partial<{
    id: string;
    userId: string;
    templateId: string;
    name: string | null;
    frequencyType: string;
    daysOfWeek: number[];
    intervalDays: number | null;
    intervalWeeks: number | null;
    scheduledTime: string | null;
    startDate: string;
    endDate: string | null;
    isActive: number;
    createdAt: string;
    deletedAt: string | null;
  }>
): Promise<void> {
  await seedSchedule('WorkoutSchedule', overrides);
}

async function seedCardioSchedule(
  overrides: Partial<{
    id: string;
    userId: string;
    templateId: string;
    name: string | null;
    frequencyType: string;
    daysOfWeek: number[];
    intervalDays: number | null;
    intervalWeeks: number | null;
    scheduledTime: string | null;
    startDate: string;
    endDate: string | null;
    isActive: number;
    createdAt: string;
    deletedAt: string | null;
  }>
): Promise<void> {
  await seedSchedule('CardioSchedule', overrides);
}

async function seedSchedule(
  tableName: 'WorkoutSchedule' | 'CardioSchedule',
  overrides: Partial<{
    id: string;
    userId: string;
    templateId: string;
    name: string | null;
    frequencyType: string;
    daysOfWeek: number[];
    intervalDays: number | null;
    intervalWeeks: number | null;
    scheduledTime: string | null;
    startDate: string;
    endDate: string | null;
    isActive: number;
    createdAt: string;
    deletedAt: string | null;
  }>
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO ${tableName} (
      id, userId, templateId, name, frequencyType, daysOfWeek, intervalDays,
      intervalWeeks, scheduledTime, startDate, endDate, isActive, createdAt,
      deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    overrides.id ?? `${tableName}-id`,
    overrides.userId ?? 'user-id',
    overrides.templateId ?? 'template-id',
    overrides.name ?? null,
    overrides.frequencyType ?? WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK,
    overrides.daysOfWeek ? JSON.stringify(overrides.daysOfWeek) : null,
    overrides.intervalDays ?? null,
    overrides.intervalWeeks ?? null,
    overrides.scheduledTime ?? null,
    overrides.startDate ?? '2026-05-04',
    overrides.endDate ?? null,
    overrides.isActive ?? 1,
    overrides.createdAt ?? '2026-05-01T00:00:00.000Z',
    overrides.deletedAt ?? null
  );
}

async function insertWorkoutSession(
  overrides: Partial<{
    id: string;
    userId: string;
    templateId: string | null;
    scheduleId: string | null;
    generatedForDate: string | null;
    name: string | null;
    templateNameSnapshot: string | null;
    status: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    startedAt: string | null;
    completedAt: string | null;
    loggedAt: string;
    isRetroactive: number;
    workoutDate: string | null;
    durationMinutes: number | null;
    durationOverridden: number;
    rpe: number | null;
    note: string | null;
  }>
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO WorkoutSession (
      id, userId, templateId, scheduleId, generatedForDate, name,
      templateNameSnapshot, status, scheduledDate, scheduledTime, startedAt,
      completedAt, loggedAt, isRetroactive, workoutDate, durationMinutes,
      durationOverridden, rpe, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    overrides.id ?? 'session-id',
    overrides.userId ?? 'user-id',
    overrides.templateId ?? null,
    overrides.scheduleId ?? null,
    overrides.generatedForDate ?? null,
    overrides.name ?? null,
    overrides.templateNameSnapshot ?? null,
    overrides.status ?? 'planned',
    overrides.scheduledDate ?? null,
    overrides.scheduledTime ?? null,
    overrides.startedAt ?? null,
    overrides.completedAt ?? null,
    overrides.loggedAt ?? '2026-05-04T12:00:00.000Z',
    overrides.isRetroactive ?? 0,
    overrides.workoutDate ?? null,
    overrides.durationMinutes ?? null,
    overrides.durationOverridden ?? 0,
    overrides.rpe ?? null,
    overrides.note ?? null
  );
}

function workoutSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: overrides.id ?? 'active-session',
    userId: overrides.userId ?? 'user-id',
    templateId: overrides.templateId,
    scheduleId: overrides.scheduleId,
    generatedForDate: overrides.generatedForDate,
    name: overrides.name,
    templateNameSnapshot: overrides.templateNameSnapshot,
    status: overrides.status ?? 'live',
    scheduledDate: overrides.scheduledDate,
    scheduledTime: overrides.scheduledTime,
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    loggedAt: overrides.loggedAt ?? '2026-05-04T12:00:00.000Z',
    isRetroactive: overrides.isRetroactive ?? false,
    workoutDate: overrides.workoutDate,
    durationMinutes: overrides.durationMinutes,
    durationOverridden: overrides.durationOverridden ?? false,
    rpe: overrides.rpe,
    note: overrides.note,
    exerciseLogs: overrides.exerciseLogs ?? [],
  };
}

function requireSingleWorkoutSession(): MockWorkoutSessionRow {
  const sessions = getMockSqlite().__getSnapshot().workoutSessions;
  expect(sessions).toHaveLength(1);
  const session = sessions[0];

  if (!session) {
    throw new Error('Expected one workout session.');
  }

  return session;
}
