import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LoadType, SetType } from '../../constants/enums';
import type { ExerciseConfig } from '../../types/schema';
import { getDb, runMigrations } from '../db';
import {
  MAX_WORKOUT_EXERCISES,
  addExerciseInSession,
  advanceExercise,
  completeSession,
  getLiveSession,
  logSet,
  markExerciseComplete,
  removeExerciseInSession,
  startSession,
  unmarkExerciseComplete,
  validateTemplateExerciseConfigs,
} from '../workoutSessionService';

type MockBindValue = string | number | null | boolean | Uint8Array;

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

interface MockExerciseLogRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  exerciseSetModeSnapshot: string;
  exerciseLoadTypeSnapshot: string;
  exerciseAttributesSnapshot: string | null;
  order: number;
  groupId: string | null;
  groupType: string | null;
  note: string | null;
  progressionIntent: string | null;
}

interface MockSetLogRow {
  id: string;
  exerciseLogId: string;
  setNumber: number;
  setType: string;
  setDescriptor: string | null;
  setNote: string | null;
  setMode: string;
  reps: number | null;
  weightLbs: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  completedAt: string | null;
  attributeValues: string | null;
}

interface MockSnapshot {
  workoutSessions: MockWorkoutSessionRow[];
  exerciseLogs: MockExerciseLogRow[];
  setLogs: MockSetLogRow[];
}

interface MockSqliteControls {
  __getSnapshot: () => MockSnapshot;
}

jest.mock('expo-sqlite', () => {
  interface MockUserRow {
    id: string;
    timezone: string;
    createdAt: string;
  }

  interface MockPreferenceRow {
    userId: string;
    dayEndTime: string;
  }

  interface MockExerciseRow {
    id: string;
    userId: string | null;
    name: string;
    category: string;
    setMode: string;
    loadType: string;
    attributes: string;
    deletedAt: string | null;
  }

  interface MockWorkoutTemplateRow {
    id: string;
    userId: string;
    name: string | null;
    exerciseConfigs: string;
  }

  let activeDatabase: MockSQLiteDatabase | null = null;

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private users: MockUserRow[] = [];
    private preferences: MockPreferenceRow[] = [];
    private exercises: MockExerciseRow[] = [];
    private workoutTemplates: MockWorkoutTemplateRow[] = [];
    private workoutSessions: MockWorkoutSessionRow[] = [];
    private exerciseLogs: MockExerciseLogRow[] = [];
    private setLogs: MockSetLogRow[] = [];

    async execAsync(_source: string): Promise<void> {}

    execSync(_source: string): void {}

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
        const row: MockUserRow = {
          id: readStringParam(params, 0, 'id'),
          timezone: readStringParam(params, 1, 'timezone'),
          createdAt: readStringParam(params, 2, 'createdAt'),
        };
        this.users = [...this.users.filter((user) => user.id !== row.id), row];
        return { lastInsertRowId: this.users.length, changes: 1 };
      }

      if (source.includes('INSERT INTO ExerciseLog')) {
        const row = readExerciseLogInsert(source, params);
        this.exerciseLogs.push(row);
        return { lastInsertRowId: this.exerciseLogs.length, changes: 1 };
      }

      if (source.includes('INSERT INTO SetLog')) {
        const row = readSetLogInsert(source, params);
        this.setLogs.push(row);
        return { lastInsertRowId: this.setLogs.length, changes: 1 };
      }

      if (source.includes('INSERT INTO WorkoutSession')) {
        const row = readWorkoutSessionInsert(source, params);
        this.workoutSessions.push(row);
        return { lastInsertRowId: this.workoutSessions.length, changes: 1 };
      }

      if (source.includes('INSERT INTO WorkoutTemplate')) {
        const columns = readInsertColumns(source, 'WorkoutTemplate');
        const row: MockWorkoutTemplateRow = {
          id: readStringColumn(columns, params, 'id'),
          userId: readStringColumn(columns, params, 'userId'),
          name: readNullableStringColumn(columns, params, 'name'),
          exerciseConfigs: readStringColumn(columns, params, 'exerciseConfigs', '[]'),
        };
        this.workoutTemplates.push(row);
        return { lastInsertRowId: this.workoutTemplates.length, changes: 1 };
      }

      if (source.includes('INSERT INTO Exercise ')) {
        const columns = readInsertColumns(source, 'Exercise');
        const row: MockExerciseRow = {
          id: readStringColumn(columns, params, 'id'),
          userId: readNullableStringColumn(columns, params, 'userId'),
          name: readStringColumn(columns, params, 'name'),
          category: readStringColumn(columns, params, 'category', 'workout'),
          setMode: readStringColumn(columns, params, 'setMode', 'reps'),
          loadType: readStringColumn(columns, params, 'loadType', 'weighted'),
          attributes: readStringColumn(columns, params, 'attributes', '[]'),
          deletedAt: readNullableStringColumn(columns, params, 'deletedAt'),
        };
        this.exercises.push(row);
        return { lastInsertRowId: this.exercises.length, changes: 1 };
      }

      if (
        source.includes('UPDATE WorkoutSession') &&
        source.includes('SET status = ?')
      ) {
        const completeUpdate = source.includes('scheduledDate = ?');
        const sessionId = readStringParam(
          params,
          completeUpdate ? 12 : 5,
          'sessionId'
        );
        const index = this.workoutSessions.findIndex((row) => row.id === sessionId);

        if (index < 0) {
          return { lastInsertRowId: 0, changes: 0 };
        }

        this.workoutSessions[index] = completeUpdate
          ? {
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
              liveState: readNullableStringParam(params, 11, 'liveState'),
            }
          : {
              ...this.workoutSessions[index],
              status: readStringParam(params, 0, 'status'),
              startedAt: readNullableStringParam(params, 1, 'startedAt'),
              completedAt: readNullableStringParam(params, 2, 'completedAt'),
              workoutDate: readNullableStringParam(params, 3, 'workoutDate'),
              liveState: readNullableStringParam(params, 4, 'liveState'),
            };
        return { lastInsertRowId: 0, changes: 1 };
      }

      if (source.includes('UPDATE WorkoutSession') && source.includes('SET liveState = ?')) {
        const liveState = readStringParam(params, 0, 'liveState');
        const sessionId = readStringParam(params, 1, 'sessionId');
        const index = this.workoutSessions.findIndex((row) => row.id === sessionId);

        if (index >= 0) {
          this.workoutSessions[index] = {
            ...this.workoutSessions[index],
            liveState,
          };
        }

        return { lastInsertRowId: 0, changes: index >= 0 ? 1 : 0 };
      }

      if (source.includes('UPDATE ExerciseLog') && source.includes('SET "order" = ?')) {
        const order = readNumberParam(params, 0, 'order');
        const exerciseLogId = readStringParam(params, 1, 'exerciseLogId');
        const index = this.exerciseLogs.findIndex((row) => row.id === exerciseLogId);

        if (index >= 0) {
          this.exerciseLogs[index] = {
            ...this.exerciseLogs[index],
            order,
          };
        }

        return { lastInsertRowId: 0, changes: index >= 0 ? 1 : 0 };
      }

      if (source.includes('DELETE FROM SetLog')) {
        const exerciseLogId = readStringParam(params, 0, 'exerciseLogId');
        const before = this.setLogs.length;
        this.setLogs = this.setLogs.filter((row) => row.exerciseLogId !== exerciseLogId);
        return { lastInsertRowId: 0, changes: before - this.setLogs.length };
      }

      if (source.includes('DELETE FROM ExerciseLog') && source.includes('WHERE id = ?')) {
        const exerciseLogId = readStringParam(params, 0, 'exerciseLogId');
        const before = this.exerciseLogs.length;
        this.exerciseLogs = this.exerciseLogs.filter((row) => row.id !== exerciseLogId);
        return { lastInsertRowId: 0, changes: before - this.exerciseLogs.length };
      }

      if (
        source.includes('DELETE FROM ExerciseLog') &&
        source.includes('WHERE sessionId = ?')
      ) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const before = this.exerciseLogs.length;
        this.exerciseLogs = this.exerciseLogs.filter((row) => row.sessionId !== sessionId);
        return { lastInsertRowId: 0, changes: before - this.exerciseLogs.length };
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

      if (source.includes('FROM WorkoutSession') && source.includes('status = \'live\'') && source.includes('id != ?')) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const row =
          this.workoutSessions.find(
            (session) => session.status === 'live' && session.id !== sessionId
          ) ?? null;
        return row ? ({ id: row.id } as T) : null;
      }

      if (
        source.includes('FROM WorkoutSession') &&
        source.includes('userId = ?') &&
        source.includes("status = 'live'")
      ) {
        const userId = readStringParam(params, 0, 'userId');
        const row =
          this.workoutSessions.find(
            (session) => session.userId === userId && session.status === 'live'
          ) ?? null;
        return row ? (cloneWorkoutSessionRow(row) as T) : null;
      }

      if (source.includes('FROM WorkoutSession')) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const row =
          this.workoutSessions.find((session) => session.id === sessionId) ?? null;
        return row ? (cloneWorkoutSessionRow(row) as T) : null;
      }

      if (source.includes('FROM WorkoutTemplate')) {
        const templateId = readStringParam(params, 0, 'templateId');
        const row =
          this.workoutTemplates.find((template) => template.id === templateId) ??
          null;
        return row
          ? ({ id: row.id, exerciseConfigs: row.exerciseConfigs } as T)
          : null;
      }

      if (source.includes('FROM Exercise')) {
        const exerciseId = readStringParam(params, 0, 'exerciseId');
        const userId = params.length > 1 ? readStringParam(params, 1, 'userId') : null;
        const row =
          this.exercises.find(
            (exercise) =>
              exercise.id === exerciseId &&
              exercise.deletedAt === null &&
              (userId === null || exercise.userId === null || exercise.userId === userId)
          ) ?? null;
        return row ? (cloneExerciseSnapshotRow(row) as T) : null;
      }

      if (source.includes('FROM User u')) {
        const userId = readStringParam(params, 0, 'userId');
        const user = this.users.find((row) => row.id === userId) ?? null;

        if (!user) return null;

        const preference = this.preferences.find((row) => row.userId === user.id);
        return {
          timezone: user.timezone,
          dayEndTime: preference?.dayEndTime ?? null,
        } as T;
      }

      return null;
    }

    async getAllAsync<T>(
      source: string,
      ...params: MockBindValue[]
    ): Promise<T[]> {
      if (source.includes('FROM ExerciseLog')) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        return this.exerciseLogs
          .filter((row) => row.sessionId === sessionId)
          .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
          .map(cloneExerciseLogRow) as T[];
      }

      if (source.includes('FROM SetLog')) {
        const exerciseLogIds = params.filter(
          (value): value is string => typeof value === 'string'
        );
        const exerciseLogIdSet = new Set(exerciseLogIds);
        return this.setLogs
          .filter((row) => exerciseLogIdSet.has(row.exerciseLogId))
          .sort((a, b) => a.setNumber - b.setNumber || a.id.localeCompare(b.id))
          .map(cloneSetLogRow) as T[];
      }

      if (source.includes('FROM Exercise') && source.includes('WHERE id IN')) {
        const exerciseIds = params.filter(
          (value): value is string => typeof value === 'string'
        );
        const exerciseIdSet = new Set(exerciseIds);
        return this.exercises
          .filter((row) => exerciseIdSet.has(row.id))
          .map(cloneExerciseSnapshotRow) as T[];
      }

      if (source.includes('FROM Exercise')) {
        const userId = readStringParam(params, 0, 'userId');
        return this.exercises
          .filter(
            (row) =>
              row.deletedAt === null &&
              (row.category === 'workout' || row.category === 'mobility') &&
              (row.userId === null || row.userId === userId)
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((row) => ({ id: row.id, name: row.name })) as T[];
      }

      return [];
    }

    snapshot(): MockSnapshot {
      return {
        workoutSessions: this.workoutSessions.map(cloneWorkoutSessionRow),
        exerciseLogs: this.exerciseLogs.map(cloneExerciseLogRow),
        setLogs: this.setLogs.map(cloneSetLogRow),
      };
    }

    private snapshotInternal(): {
      schemaVersion: number | null;
      users: MockUserRow[];
      preferences: MockPreferenceRow[];
      exercises: MockExerciseRow[];
      workoutTemplates: MockWorkoutTemplateRow[];
      workoutSessions: MockWorkoutSessionRow[];
      exerciseLogs: MockExerciseLogRow[];
      setLogs: MockSetLogRow[];
    } {
      return {
        schemaVersion: this.schemaVersion,
        users: this.users.map((row) => ({ ...row })),
        preferences: this.preferences.map((row) => ({ ...row })),
        exercises: this.exercises.map((row) => ({ ...row })),
        workoutTemplates: this.workoutTemplates.map((row) => ({ ...row })),
        workoutSessions: this.workoutSessions.map(cloneWorkoutSessionRow),
        exerciseLogs: this.exerciseLogs.map(cloneExerciseLogRow),
        setLogs: this.setLogs.map(cloneSetLogRow),
      };
    }

    private restore(snapshot: ReturnType<MockSQLiteDatabase['snapshotInternal']>): void {
      this.schemaVersion = snapshot.schemaVersion;
      this.users = snapshot.users.map((row) => ({ ...row }));
      this.preferences = snapshot.preferences.map((row) => ({ ...row }));
      this.exercises = snapshot.exercises.map((row) => ({ ...row }));
      this.workoutTemplates = snapshot.workoutTemplates.map((row) => ({ ...row }));
      this.workoutSessions = snapshot.workoutSessions.map(cloneWorkoutSessionRow);
      this.exerciseLogs = snapshot.exerciseLogs.map(cloneExerciseLogRow);
      this.setLogs = snapshot.setLogs.map(cloneSetLogRow);
    }
  }

  return {
    __getSnapshot: () => {
      if (!activeDatabase) {
        throw new Error('Database has not been opened.');
      }

      return activeDatabase.snapshot();
    },
    openDatabaseAsync: async () => {
      activeDatabase = new MockSQLiteDatabase();
      return activeDatabase;
    },
  };

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

  function readExerciseLogInsert(
    source: string,
    params: MockBindValue[]
  ): MockExerciseLogRow {
    const columns = readInsertColumns(source, 'ExerciseLog');

    return {
      id: readStringColumn(columns, params, 'id'),
      sessionId: readStringColumn(columns, params, 'sessionId'),
      exerciseId: readStringColumn(columns, params, 'exerciseId'),
      exerciseNameSnapshot: readStringColumn(columns, params, 'exerciseNameSnapshot'),
      exerciseSetModeSnapshot: readStringColumn(
        columns,
        params,
        'exerciseSetModeSnapshot'
      ),
      exerciseLoadTypeSnapshot: readStringColumn(
        columns,
        params,
        'exerciseLoadTypeSnapshot'
      ),
      exerciseAttributesSnapshot: readNullableStringColumn(
        columns,
        params,
        'exerciseAttributesSnapshot'
      ),
      order: readNumberColumn(columns, params, 'order'),
      groupId: readNullableStringColumn(columns, params, 'groupId'),
      groupType: readNullableStringColumn(columns, params, 'groupType'),
      note: readNullableStringColumn(columns, params, 'note'),
      progressionIntent: readNullableStringColumn(columns, params, 'progressionIntent'),
    };
  }

  function readSetLogInsert(
    source: string,
    params: MockBindValue[]
  ): MockSetLogRow {
    const columns = readInsertColumns(source, 'SetLog');

    return {
      id: readStringColumn(columns, params, 'id'),
      exerciseLogId: readStringColumn(columns, params, 'exerciseLogId'),
      setNumber: readNumberColumn(columns, params, 'setNumber'),
      setType: readStringColumn(columns, params, 'setType', 'normal'),
      setDescriptor: readNullableStringColumn(columns, params, 'setDescriptor'),
      setNote: readNullableStringColumn(columns, params, 'setNote'),
      setMode: readStringColumn(columns, params, 'setMode', 'reps'),
      reps: readNullableNumberColumn(columns, params, 'reps'),
      weightLbs: readNullableNumberColumn(columns, params, 'weightLbs'),
      durationSeconds: readNullableNumberColumn(columns, params, 'durationSeconds'),
      restSeconds: readNullableNumberColumn(columns, params, 'restSeconds'),
      completedAt: readNullableStringColumn(columns, params, 'completedAt'),
      attributeValues: readNullableStringColumn(columns, params, 'attributeValues'),
    };
  }

  function readInsertColumns(source: string, table: string): string[] {
    const tableIndex = source.indexOf(table);
    const openIndex = source.indexOf('(', tableIndex);
    const closeIndex = source.indexOf(')', openIndex);

    if (tableIndex < 0 || openIndex < 0 || closeIndex < 0) {
      throw new Error(`Could not read INSERT columns for ${table}.`);
    }

    return source
      .slice(openIndex + 1, closeIndex)
      .split(',')
      .map((column) => column.trim().replaceAll('"', ''));
  }

  function readStringColumn(
    columns: readonly string[],
    params: readonly MockBindValue[],
    column: string,
    fallback?: string
  ): string {
    const index = columns.indexOf(column);
    if (index < 0 && fallback !== undefined) return fallback;
    return readStringParam(params, index, column);
  }

  function readNullableStringColumn(
    columns: readonly string[],
    params: readonly MockBindValue[],
    column: string
  ): string | null {
    const index = columns.indexOf(column);
    return index < 0 ? null : readNullableStringParam(params, index, column);
  }

  function readNumberColumn(
    columns: readonly string[],
    params: readonly MockBindValue[],
    column: string,
    fallback?: number
  ): number {
    const index = columns.indexOf(column);
    if (index < 0 && fallback !== undefined) return fallback;
    return readNumberParam(params, index, column);
  }

  function readNullableNumberColumn(
    columns: readonly string[],
    params: readonly MockBindValue[],
    column: string
  ): number | null {
    const index = columns.indexOf(column);
    return index < 0 ? null : readNullableNumberParam(params, index, column);
  }

  function readStringParam(
    params: readonly MockBindValue[],
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
    params: readonly MockBindValue[],
    index: number,
    label: string
  ): string | null {
    const value = params[index];

    if (value === null) return null;
    if (typeof value !== 'string') {
      throw new Error(`Expected ${label} to be a string or null.`);
    }

    return value;
  }

  function readNumberParam(
    params: readonly MockBindValue[],
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
    params: readonly MockBindValue[],
    index: number,
    label: string
  ): number | null {
    const value = params[index];

    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Expected ${label} to be a number or null.`);
    }

    return value;
  }

  function cloneWorkoutSessionRow(row: MockWorkoutSessionRow): MockWorkoutSessionRow {
    return { ...row };
  }

  function cloneExerciseLogRow(row: MockExerciseLogRow): MockExerciseLogRow {
    return { ...row };
  }

  function cloneSetLogRow(row: MockSetLogRow): MockSetLogRow {
    return { ...row };
  }

  function cloneExerciseSnapshotRow(row: MockExerciseRow): {
    id: string;
    name: string;
    setMode: string;
    loadType: string;
    attributes: string;
  } {
    return {
      id: row.id,
      name: row.name,
      setMode: row.setMode,
      loadType: row.loadType,
      attributes: row.attributes,
    };
  }
});

describe('workout session service', () => {
  beforeEach(async () => {
    await runMigrations(':memory:');
    await seedUser('user-id', 'America/New_York');
    await seedUserPreferences('user-id', '03:00');
  });

  it('round-trips liveState without inferring completion from logged sets', async () => {
    await seedWorkoutWithExercises('session-id', ['ex-1', 'ex-2', 'ex-3']);

    await startSession('session-id', '2026-05-08T04:00:00.000Z');
    await advanceExercise('session-id', '2026-05-08T04:01:00.000Z');
    await advanceExercise('session-id', '2026-05-08T04:02:00.000Z');
    await logSet(
      'session-id',
      'ex-3',
      { exerciseLogId: 'log-ex-3', reps: 8 },
      '2026-05-08T04:03:00.000Z'
    );

    const resumed = await getLiveSession('user-id');

    expect(resumed?.liveState).toEqual({
      currentExerciseIndex: 2,
      completedExerciseIds: ['ex-1', 'ex-2'],
      updatedAt: '2026-05-08T04:02:00.000Z',
    });
    expect(resumed?.session.exerciseLogs[2]?.sets).toHaveLength(1);
    expect(resumed?.liveState.completedExerciseIds).not.toContain('ex-3');
  });

  it('persists unmark and keeps liveState consistent across add and remove', async () => {
    await seedWorkoutWithExercises('session-id', ['ex-1', 'ex-2', 'ex-3']);
    await seedExercise('ex-4', 'Exercise 4');

    await startSession('session-id', '2026-05-08T04:00:00.000Z');
    await advanceExercise('session-id', '2026-05-08T04:01:00.000Z');
    await advanceExercise('session-id', '2026-05-08T04:02:00.000Z');
    await unmarkExerciseComplete('session-id', 'ex-1', '2026-05-08T04:03:00.000Z');
    await addExerciseInSession('session-id', 'ex-4', '2026-05-08T04:04:00.000Z');
    await removeExerciseInSession('session-id', 1, '2026-05-08T04:05:00.000Z');

    const resumed = await getLiveSession('user-id');

    expect(resumed?.liveState).toEqual({
      currentExerciseIndex: 1,
      completedExerciseIds: [],
      updatedAt: '2026-05-08T04:05:00.000Z',
    });
    expect(resumed?.session.exerciseLogs.map((exercise) => exercise.exerciseId)).toEqual([
      'ex-1',
      'ex-3',
      'ex-4',
    ]);
    expect(
      getMockSqlite().__getSnapshot().exerciseLogs.map((exercise) => exercise.order)
    ).toEqual([0, 1, 2]);
  });

  it('hard-errors template and in-session exercise additions at 21', async () => {
    expect(() => validateTemplateExerciseConfigs(makeConfigs(20))).not.toThrow();
    expect(() => validateTemplateExerciseConfigs(makeConfigs(21))).toThrow(
      /cannot contain more than 20 exercises/
    );

    await seedWorkoutWithExercises(
      'session-id',
      Array.from({ length: 19 }, (_, index) => `ex-${index + 1}`)
    );
    await seedExercise('ex-20', 'Exercise 20');
    await seedExercise('ex-21', 'Exercise 21');
    await startSession('session-id', '2026-05-08T04:00:00.000Z');

    await expect(
      addExerciseInSession('session-id', 'ex-20', '2026-05-08T04:01:00.000Z')
    ).resolves.toEqual(
      expect.objectContaining({
        session: expect.objectContaining({
          exerciseLogs: expect.arrayContaining([
            expect.objectContaining({ exerciseId: 'ex-20' }),
          ]),
        }),
      })
    );
    await expect(
      addExerciseInSession('session-id', 'ex-21', '2026-05-08T04:02:00.000Z')
    ).rejects.toMatchObject({
      code: 'exercise_limit_exceeded',
    });
  });

  it('blocks a second live workout until the first completes', async () => {
    await seedWorkoutWithExercises('first-session', ['first-ex']);
    await seedWorkoutWithExercises('second-session', ['second-ex']);

    await startSession('first-session', '2026-05-08T04:00:00.000Z');
    await expect(
      startSession('second-session', '2026-05-08T04:01:00.000Z')
    ).rejects.toMatchObject({
      code: 'live_session_exists',
    });
    await completeSession('first-session', '2026-05-08T04:30:00.000Z');

    const snapshot = getMockSqlite().__getSnapshot();
    expect(snapshot.workoutSessions).toHaveLength(2);
    expect(snapshot.workoutSessions.find((row) => row.id === 'first-session')).toEqual(
      expect.objectContaining({
        status: 'completed',
        liveState: null,
      })
    );
    await expect(
      startSession('second-session', '2026-05-08T04:31:00.000Z')
    ).resolves.toEqual(expect.objectContaining({ liveStateStatus: 'valid' }));
  });

  it('falls back for malformed liveState without dropping logged sets', async () => {
    await seedWorkoutWithExercises('session-id', ['ex-1', 'ex-2'], {
      status: 'live',
      startedAt: '2026-05-08T04:00:00.000Z',
      liveState: 'garbage json',
    });
    await seedSetLog('set-id', 'log-ex-2', 1);

    const resumed = await getLiveSession('user-id');

    expect(resumed?.liveStateStatus).toBe('fallback_malformed');
    expect(resumed?.liveState).toEqual({
      currentExerciseIndex: 0,
      completedExerciseIds: [],
      updatedAt: '2026-05-08T04:00:00.000Z',
    });
    expect(resumed?.session.exerciseLogs[1]?.sets).toHaveLength(1);
  });

  it('does not mutate completedExerciseIds when logging a set', async () => {
    await seedWorkoutWithExercises('session-id', ['ex-1', 'ex-2']);
    await startSession('session-id', '2026-05-08T04:00:00.000Z');
    await markExerciseComplete('session-id', 'ex-1', '2026-05-08T04:01:00.000Z');
    const before = readStoredLiveState('session-id');

    await logSet(
      'session-id',
      'ex-2',
      { exerciseLogId: 'log-ex-2', reps: 5 },
      '2026-05-08T04:02:00.000Z'
    );
    const after = readStoredLiveState('session-id');

    expect(after).toEqual(before);
  });

  it('clears liveState through completion update and materializes workoutDate', async () => {
    await seedWorkoutWithExercises('session-id', ['ex-1'], {
      status: 'live',
      startedAt: '2026-05-08T05:00:00.000Z',
      liveState: JSON.stringify({
        currentExerciseIndex: 0,
        completedExerciseIds: ['ex-1'],
        updatedAt: '2026-05-08T05:01:00.000Z',
      }),
    });
    const beforeCount = getMockSqlite().__getSnapshot().workoutSessions.length;

    await completeSession('session-id', '2026-05-08T06:00:00.000Z');

    const snapshot = getMockSqlite().__getSnapshot();
    expect(snapshot.workoutSessions).toHaveLength(beforeCount);
    expect(snapshot.workoutSessions[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        completedAt: '2026-05-08T06:00:00.000Z',
        liveState: null,
        workoutDate: '2026-05-07',
      })
    );
  });
});

function getMockSqlite(): MockSqliteControls {
  return jest.requireMock('expo-sqlite') as MockSqliteControls;
}

async function seedUser(
  id: string,
  timezone: string,
  createdAt = '2026-05-01T00:00:00.000Z'
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO User (id, timezone, createdAt)
    VALUES (?, ?, ?)`,
    id,
    timezone,
    createdAt
  );
}

async function seedUserPreferences(userId: string, dayEndTime: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO UserPreferences (userId, dayEndTime)
    VALUES (?, ?)`,
    userId,
    dayEndTime
  );
}

async function seedExercise(
  id: string,
  name: string,
  setMode: 'reps' | 'duration' = 'reps'
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO Exercise (
      id, userId, name, category, setMode, loadType, attributes, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    'user-id',
    name,
    'workout',
    setMode,
    LoadType.WEIGHTED,
    '[]',
    null
  );
}

async function seedWorkoutSession(
  id: string,
  overrides: Partial<MockWorkoutSessionRow> = {}
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO WorkoutSession (
      id, userId, templateId, scheduleId, generatedForDate, name,
      templateNameSnapshot, status, scheduledDate, scheduledTime, startedAt,
      completedAt, loggedAt, isRetroactive, workoutDate, durationMinutes,
      durationOverridden, rpe, note, liveState
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    overrides.userId ?? 'user-id',
    overrides.templateId ?? null,
    overrides.scheduleId ?? null,
    overrides.generatedForDate ?? null,
    overrides.name ?? 'Workout',
    overrides.templateNameSnapshot ?? null,
    overrides.status ?? 'planned',
    overrides.scheduledDate ?? '2026-05-08',
    overrides.scheduledTime ?? null,
    overrides.startedAt ?? null,
    overrides.completedAt ?? null,
    overrides.loggedAt ?? '2026-05-08T03:00:00.000Z',
    overrides.isRetroactive ?? 0,
    overrides.workoutDate ?? null,
    overrides.durationMinutes ?? null,
    overrides.durationOverridden ?? 0,
    overrides.rpe ?? null,
    overrides.note ?? null,
    overrides.liveState ?? null
  );
}

async function seedExerciseLog(
  sessionId: string,
  exerciseId: string,
  order: number
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO ExerciseLog (
      id, sessionId, exerciseId, exerciseNameSnapshot,
      exerciseSetModeSnapshot, exerciseLoadTypeSnapshot,
      exerciseAttributesSnapshot, "order", groupId, groupType,
      note, progressionIntent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    `log-${exerciseId}`,
    sessionId,
    exerciseId,
    `Exercise ${exerciseId.replace('ex-', '')}`,
    'reps',
    LoadType.WEIGHTED,
    null,
    order,
    null,
    null,
    null,
    null
  );
}

async function seedSetLog(
  id: string,
  exerciseLogId: string,
  setNumber: number
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO SetLog (
      id, exerciseLogId, setNumber, setType, setDescriptor,
      setNote, setMode, reps, weightLbs, durationSeconds,
      restSeconds, completedAt, attributeValues
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    exerciseLogId,
    setNumber,
    SetType.NORMAL,
    null,
    null,
    'reps',
    10,
    null,
    null,
    null,
    '2026-05-08T04:00:00.000Z',
    null
  );
}

async function seedWorkoutWithExercises(
  sessionId: string,
  exerciseIds: readonly string[],
  sessionOverrides: Partial<MockWorkoutSessionRow> = {}
): Promise<void> {
  await seedWorkoutSession(sessionId, sessionOverrides);

  for (const [index, exerciseId] of exerciseIds.entries()) {
    await seedExercise(exerciseId, `Exercise ${exerciseId.replace('ex-', '')}`);
    await seedExerciseLog(sessionId, exerciseId, index);
  }
}

function makeConfigs(count: number): ExerciseConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    exerciseId: `ex-${index + 1}`,
    order: index,
    defaultSets: 3,
    progressionType: 'consistent',
  }));
}

function readStoredLiveState(sessionId: string): unknown {
  const row = getMockSqlite()
    .__getSnapshot()
    .workoutSessions.find((session) => session.id === sessionId);

  if (!row?.liveState) {
    return null;
  }

  return JSON.parse(row.liveState) as unknown;
}
