import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppMode, EnabledModule, FrequencyType } from '../../constants/enums';
import { useUserStore } from '../../store/userStore';
import type { HabitLog, UserPreferences } from '../../types/schema';
import { getDb, runMigrations } from '../db';
import {
  completeTodayHabit,
  getTodayViewModel,
  moveTodayFitnessSessionToTomorrow,
  saveTodayHabitValue,
  undoTodayHabitCompletion,
} from '../todayService';
import {
  HABIT_LOG_ROW_COLUMNS,
  rowToHabitLog,
  type HabitLogRow,
} from '../mappers/habitLogMapper';
import type { HabitRow } from '../mappers/habitMapper';
import type { HabitTargetRow } from '../mappers/habitTargetMapper';

type TestBindValue = string | number | null | boolean | Uint8Array;

interface QueryLogEntry {
  source: string;
  params: TestBindValue[];
}

interface HabitCompletionEventRow {
  id: string;
  userId: string;
  habitId: string;
  date: string;
  occurredAt: string;
  value: number | null;
  createdAt: string;
}

interface MockSqliteControls {
  __clearQueryLog: () => void;
  __getQueryLog: () => QueryLogEntry[];
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

  interface MockWorkoutSessionRow {
    id: string;
    userId: string;
    templateId: string | null;
    scheduleId: string | null;
    name: string | null;
    templateNameSnapshot: string | null;
    status: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    startedAt: string | null;
    completedAt: string | null;
    loggedAt: string;
    workoutDate: string | null;
  }

  interface MockCardioSessionRow {
    id: string;
    userId: string;
    templateId: string | null;
    scheduleId: string | null;
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
    cardioDate: string | null;
  }

  interface MockSnapshot {
    schemaVersion: number | null;
    users: MockUserRow[];
    preferences: MockUserPreferenceRow[];
    habits: MockHabitRow[];
    habitTargets: MockHabitTargetRow[];
    habitLogs: MockHabitLogRow[];
    habitCompletionEvents: MockHabitCompletionEventRow[];
    workoutSessions: MockWorkoutSessionRow[];
    cardioSessions: MockCardioSessionRow[];
  }

  const queryLog: QueryLogEntry[] = [];

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private users: MockUserRow[] = [];
    private preferences: MockUserPreferenceRow[] = [];
    private habits: MockHabitRow[] = [];
    private habitTargets: MockHabitTargetRow[] = [];
    private habitLogs: MockHabitLogRow[] = [];
    private habitCompletionEvents: MockHabitCompletionEventRow[] = [];
    private workoutSessions: MockWorkoutSessionRow[] = [];
    private cardioSessions: MockCardioSessionRow[] = [];

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
      recordQuery(source, params);

      if (source.includes('INSERT INTO schema_version')) {
        this.schemaVersion = readNumberParam(params, 0, 'schema version');
        return { lastInsertRowId: 1, changes: 1 };
      }

      if (source.includes('INSERT INTO UserPreferences')) {
        const row = {
          userId: readStringParam(params, 0, 'userId'),
          dayEndTime: readStringParam(params, 1, 'dayEndTime'),
        };
        const existingIndex = this.preferences.findIndex(
          (candidate) => candidate.userId === row.userId
        );

        if (existingIndex >= 0) {
          this.preferences[existingIndex] = row;
        } else {
          this.preferences.push(row);
        }

        return { lastInsertRowId: existingIndex + 1, changes: 1 };
      }

      if (source.includes('INSERT INTO User ')) {
        this.users.push({
          id: readStringParam(params, 0, 'id'),
          timezone: readStringParam(params, 1, 'timezone'),
          createdAt: readStringParam(params, 2, 'createdAt'),
        });
        return { lastInsertRowId: this.users.length, changes: 1 };
      }

      if (source.includes('INSERT INTO HabitCompletionEvent')) {
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

      if (source.includes('INSERT INTO HabitTarget')) {
        this.habitTargets.push(readHabitTargetParams(params));
        return { lastInsertRowId: this.habitTargets.length, changes: 1 };
      }

      if (source.includes('INSERT INTO Habit ')) {
        this.habits.push(readHabitParams(params));
        return { lastInsertRowId: this.habits.length, changes: 1 };
      }

      if (source.includes('INSERT INTO WorkoutSession')) {
        this.workoutSessions.push(readWorkoutSessionParams(params));
        return { lastInsertRowId: this.workoutSessions.length, changes: 1 };
      }

      if (source.includes('INSERT INTO CardioSession')) {
        this.cardioSessions.push(readCardioSessionParams(params));
        return { lastInsertRowId: this.cardioSessions.length, changes: 1 };
      }

      if (source.includes('UPDATE WorkoutSession SET scheduledDate = ?')) {
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

      if (source.includes('UPDATE CardioSession SET scheduledDate = ?')) {
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

      if (source.includes('UPDATE WorkoutSession SET status =')) {
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

      if (source.includes('UPDATE CardioSession SET status =')) {
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
      recordQuery(source, params);

      if (source.includes('SELECT version FROM schema_version')) {
        return this.schemaVersion === null
          ? null
          : ({ version: this.schemaVersion } as T);
      }

      if (source.includes('FROM Habit h')) {
        const habitId = readStringParam(params, 0, 'habitId');
        return this.resolveHabitContextRow(habitId) as T | null;
      }

      if (source.includes('FROM HabitTarget')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date =
          params.length > 1 ? readStringParam(params, 1, 'date') : undefined;
        return resolveTargetRow(this.habitTargets, habitId, date) as T | null;
      }

      if (source.includes('FROM HabitLog') && source.includes('WHERE id = ?')) {
        const logId = readStringParam(params, 0, 'logId');
        const row = this.habitLogs.find((candidate) => candidate.id === logId) ?? null;
        return row ? (cloneHabitLogRow(row) as T) : null;
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

      if (source.includes('FROM Habit')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const row = this.habits.find((candidate) => candidate.id === habitId) ?? null;
        return row ? (cloneHabitRow(row) as T) : null;
      }

      if (source.includes('FROM WorkoutSession') && source.includes('id != ?')) {
        const sourceSessionId = readStringParam(params, 0, 'sessionId');
        const destinationDate = readStringParam(params, 1, 'destinationDate');

        if (source.includes('templateId = ?')) {
          const templateId = readStringParam(params, 2, 'templateId');
          const conflict = this.workoutSessions.find(
            (row) =>
              row.id !== sourceSessionId &&
              row.scheduledDate === destinationDate &&
              row.templateId === templateId
          );
          return conflict ? ({ id: conflict.id } as T) : null;
        }

        const name = readStringParam(params, 2, 'name');
        const conflict = this.workoutSessions.find(
          (row) =>
            row.id !== sourceSessionId &&
            row.scheduledDate === destinationDate &&
            row.templateId === null &&
            row.name === name
        );
        return conflict ? ({ id: conflict.id } as T) : null;
      }

      if (source.includes('FROM CardioSession') && source.includes('id != ?')) {
        const sourceSessionId = readStringParam(params, 0, 'sessionId');
        const destinationDate = readStringParam(params, 1, 'destinationDate');
        const templateId = readStringParam(params, 2, 'templateId');
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
        const row =
          this.workoutSessions.find((candidate) => candidate.id === sessionId) ?? null;
        return row ? (cloneWorkoutSessionRow(row) as T) : null;
      }

      if (source.includes('FROM CardioSession')) {
        const sessionId = readStringParam(params, 0, 'sessionId');
        const row =
          this.cardioSessions.find((candidate) => candidate.id === sessionId) ?? null;
        return row ? (cloneCardioSessionRow(row) as T) : null;
      }

      return null;
    }

    async getAllAsync<T>(
      source: string,
      ...params: MockBindValue[]
    ): Promise<T[]> {
      recordQuery(source, params);

      if (source.includes('FROM HabitCompletionEvent')) {
        const habitId = readStringParam(params, 0, 'habitId');
        const date = readStringParam(params, 1, 'date');

        return this.habitCompletionEvents
          .filter((row) => row.habitId === habitId && row.date === date)
          .sort(compareHabitCompletionEventRows)
          .map(cloneHabitCompletionEventRow) as T[];
      }

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

      if (source.includes('FROM HabitLog')) {
        const date = readStringParam(params, params.length - 1, 'date');
        const habitIds = params
          .slice(0, -1)
          .filter((value): value is string => typeof value === 'string');
        const habitIdSet = new Set(habitIds);

        if (source.includes('date <= ?')) {
          return this.habitLogs
            .filter(
              (row) =>
                habitIdSet.has(row.habitId) &&
                row.date <= date &&
                row.completed === 1
            )
            .sort(compareHabitLogRowsDescending)
            .map(cloneHabitLogRow) as T[];
        }

        return this.habitLogs
          .filter((row) => habitIdSet.has(row.habitId) && row.date === date)
          .map(cloneHabitLogRow) as T[];
      }

      if (source.includes('FROM Habit')) {
        const userId = readStringParam(params, 0, 'userId');

        return this.habits
          .filter((row) => row.userId === userId)
          .sort(compareHabitRows)
          .map(cloneHabitRow) as T[];
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
        workoutSessions: this.workoutSessions.map(cloneWorkoutSessionRow),
        cardioSessions: this.cardioSessions.map(cloneCardioSessionRow),
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
      this.workoutSessions = snapshot.workoutSessions.map(cloneWorkoutSessionRow);
      this.cardioSessions = snapshot.cardioSessions.map(cloneCardioSessionRow);
    }
  }

  return {
    __clearQueryLog: () => {
      queryLog.length = 0;
    },
    __getQueryLog: () => queryLog.map((entry) => ({
      source: entry.source,
      params: [...entry.params],
    })),
    openDatabaseAsync: async () => new MockSQLiteDatabase(),
  };

  function recordQuery(source: string, params: MockBindValue[]): void {
    queryLog.push({ source, params: [...params] });
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

  function readWorkoutSessionParams(params: MockBindValue[]): MockWorkoutSessionRow {
    return {
      id: readStringParam(params, 0, 'id'),
      userId: readStringParam(params, 1, 'userId'),
      templateId: readNullableStringParam(params, 2, 'templateId'),
      scheduleId: readNullableStringParam(params, 3, 'scheduleId'),
      name: readNullableStringParam(params, 4, 'name'),
      templateNameSnapshot: readNullableStringParam(
        params,
        5,
        'templateNameSnapshot'
      ),
      status: readStringParam(params, 6, 'status'),
      scheduledDate: readNullableStringParam(params, 7, 'scheduledDate'),
      scheduledTime: readNullableStringParam(params, 8, 'scheduledTime'),
      startedAt: readNullableStringParam(params, 9, 'startedAt'),
      completedAt: readNullableStringParam(params, 10, 'completedAt'),
      loggedAt: readStringParam(params, 11, 'loggedAt'),
      workoutDate: readNullableStringParam(params, 12, 'workoutDate'),
    };
  }

  function readCardioSessionParams(params: MockBindValue[]): MockCardioSessionRow {
    return {
      id: readStringParam(params, 0, 'id'),
      userId: readStringParam(params, 1, 'userId'),
      templateId: readNullableStringParam(params, 2, 'templateId'),
      scheduleId: readNullableStringParam(params, 3, 'scheduleId'),
      templateNameSnapshot: readNullableStringParam(
        params,
        4,
        'templateNameSnapshot'
      ),
      type: readStringParam(params, 5, 'type'),
      subtype: readNullableStringParam(params, 6, 'subtype'),
      sportName: readNullableStringParam(params, 7, 'sportName'),
      status: readStringParam(params, 8, 'status'),
      scheduledDate: readNullableStringParam(params, 9, 'scheduledDate'),
      scheduledTime: readNullableStringParam(params, 10, 'scheduledTime'),
      startedAt: readNullableStringParam(params, 11, 'startedAt'),
      completedAt: readNullableStringParam(params, 12, 'completedAt'),
      loggedAt: readStringParam(params, 13, 'loggedAt'),
      cardioDate: readNullableStringParam(params, 14, 'cardioDate'),
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

  function compareHabitLogRowsDescending(
    a: MockHabitLogRow,
    b: MockHabitLogRow
  ): number {
    const habitCompare = a.habitId.localeCompare(b.habitId);
    if (habitCompare !== 0) return habitCompare;

    return b.date.localeCompare(a.date);
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

  function compareFitnessRows(
    a: MockWorkoutSessionRow | MockCardioSessionRow,
    b: MockWorkoutSessionRow | MockCardioSessionRow
  ): number {
    const timeCompare = compareNullableStrings(a.scheduledTime, b.scheduledTime);
    if (timeCompare !== 0) return timeCompare;
    return a.loggedAt.localeCompare(b.loggedAt);
  }

  function compareNullableStrings(a: string | null, b: string | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  }

  function isTodayFitnessStatus(status: string): boolean {
    return ['planned', 'live', 'completed', 'skipped'].includes(status);
  }

  function datePart(value: string | null): string | null {
    return value?.slice(0, 10) ?? null;
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

  function cloneWorkoutSessionRow(
    row: MockWorkoutSessionRow
  ): MockWorkoutSessionRow {
    return { ...row };
  }

  function cloneCardioSessionRow(row: MockCardioSessionRow): MockCardioSessionRow {
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

function preferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    userId: 'user-id',
    appMode: AppMode.COMBINED,
    weightUnit: 'lbs',
    distanceUnit: 'mi',
    weekStartDay: 0,
    theme: 'system',
    colorScheme: 'muted',
    requireBiometricForHiddenHabits: false,
    dayEndTime: '00:00',
    seenProgressionIntentTooltip: false,
    modulesEnabled: [],
    goals: [],
    ...overrides,
  };
}

function habitRow(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: overrides.id ?? 'habit-id',
    userId: overrides.userId ?? 'user-id',
    parentHabitId: overrides.parentHabitId ?? null,
    name: overrides.name ?? 'Habit',
    description: overrides.description ?? null,
    category: overrides.category ?? null,
    color: overrides.color ?? null,
    icon: overrides.icon ?? null,
    isHidden: overrides.isHidden ?? 0,
    trackEffort: overrides.trackEffort ?? 0,
    startDate: overrides.startDate ?? '2026-05-01',
    allowMultiplePerDay: overrides.allowMultiplePerDay ?? 0,
    displayOrder: overrides.displayOrder ?? 0,
    isPinned: overrides.isPinned ?? 0,
    archivedAt: overrides.archivedAt ?? null,
    linkedTallyItemId: overrides.linkedTallyItemId ?? null,
    createdAt: overrides.createdAt ?? '2026-05-01T12:00:00.000Z',
  };
}

function habitTargetRow(overrides: Partial<HabitTargetRow> = {}): HabitTargetRow {
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
    createdAt: overrides.createdAt ?? '2026-05-01T12:00:00.000Z',
  };
}

function habitLogRow(overrides: Partial<HabitLogRow> = {}): HabitLogRow {
  return {
    id: overrides.id ?? 'log-id',
    habitId: overrides.habitId ?? 'habit-id',
    userId: overrides.userId ?? 'user-id',
    date: overrides.date ?? '2026-05-07',
    completed: overrides.completed ?? 0,
    value: overrides.value ?? null,
    effortRating: overrides.effortRating ?? null,
    note: overrides.note ?? null,
    completedAt: overrides.completedAt ?? null,
  };
}

async function seedUser(
  userId = 'user-id',
  timezone = 'UTC',
  dayEndTime = '00:00'
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO User (id, timezone, createdAt)
    VALUES (?, ?, ?)`,
    userId,
    timezone,
    '2026-05-01T10:00:00.000Z'
  );
  await seedUserPreferences(userId, dayEndTime);
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

async function seedLog(row: HabitLogRow): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO HabitLog (
      id, habitId, userId, date, completed, value, effortRating, note, completedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...habitLogRowValues(row)
  );
}

async function seedWorkoutSession(
  overrides: {
    id: string;
    templateId?: string | null;
    scheduleId?: string | null;
    name?: string | null;
    templateNameSnapshot?: string | null;
    status?: string;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    loggedAt?: string;
    workoutDate?: string | null;
  }
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO WorkoutSession (
      id, userId, templateId, scheduleId, name, templateNameSnapshot, status,
      scheduledDate, scheduledTime, startedAt, completedAt, loggedAt, workoutDate
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    overrides.id,
    'user-id',
    overrides.templateId ?? null,
    overrides.scheduleId ?? null,
    overrides.name ?? null,
    overrides.templateNameSnapshot ?? null,
    overrides.status ?? 'planned',
    overrides.scheduledDate ?? null,
    overrides.scheduledTime ?? null,
    overrides.startedAt ?? null,
    overrides.completedAt ?? null,
    overrides.loggedAt ?? '2026-05-07T07:00:00.000Z',
    overrides.workoutDate ?? null
  );
}

async function seedCardioSession(
  overrides: {
    id: string;
    templateId?: string | null;
    scheduleId?: string | null;
    templateNameSnapshot?: string | null;
    type?: string;
    subtype?: string | null;
    sportName?: string | null;
    status?: string;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    loggedAt?: string;
    cardioDate?: string | null;
  }
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO CardioSession (
      id, userId, templateId, scheduleId, templateNameSnapshot, type, subtype,
      sportName, status, scheduledDate, scheduledTime, startedAt, completedAt,
      loggedAt, cardioDate
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    overrides.id,
    'user-id',
    overrides.templateId ?? null,
    overrides.scheduleId ?? null,
    overrides.templateNameSnapshot ?? null,
    overrides.type ?? 'running',
    overrides.subtype ?? null,
    overrides.sportName ?? null,
    overrides.status ?? 'planned',
    overrides.scheduledDate ?? null,
    overrides.scheduledTime ?? null,
    overrides.startedAt ?? null,
    overrides.completedAt ?? null,
    overrides.loggedAt ?? '2026-05-07T07:00:00.000Z',
    overrides.cardioDate ?? null
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

function setLoadedUser(overrides: Partial<UserPreferences> = {}): void {
  const prefs = preferences(overrides);
  useUserStore.setState({
    userId: prefs.userId,
    timezone: 'UTC',
    appMode: prefs.appMode,
    preferences: prefs,
  });
}

function getMockSqlite(): MockSqliteControls {
  return jest.requireMock('expo-sqlite') as MockSqliteControls;
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

function habitLogRowValues(row: HabitLogRow): Array<string | number | null> {
  return [
    row.id,
    row.habitId,
    row.userId,
    row.date,
    row.completed,
    row.value,
    row.effortRating,
    row.note,
    row.completedAt,
  ];
}

describe('todayService', () => {
  beforeEach(async () => {
    await runMigrations(':memory:');
    getMockSqlite().__clearQueryLog();
    await seedUser();
    useUserStore.setState({
      userId: null,
      timezone: 'UTC',
      appMode: AppMode.COMBINED,
      preferences: null,
    });
  });

  it('builds a basic Today view model without persisted data when no user is loaded', async () => {
    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00',
      userId: null,
      preferences: preferences(),
    });

    expect(viewModel).toMatchObject({
      selectedDate: '2026-05-07',
      title: 'Today',
      subtitle: 'May 7',
      fitnessItems: [],
      completedHabitCount: 0,
      totalVisibleHabitCount: 0,
    });
    expect(viewModel.quickActions.map((action) => action.kind)).toEqual([
      'checkIn',
      'nutrition',
      'tally',
    ]);
  });

  it('uses the user timezone and dayEndTime for unselected Today composition', async () => {
    useUserStore.setState({ timezone: 'America/New_York' });

    const viewModel = await getTodayViewModel({
      currentDate: '2026-05-08T06:59:59.000Z',
      userId: null,
      preferences: preferences({ dayEndTime: '03:00' }),
    });

    expect(viewModel).toMatchObject({
      selectedDate: '2026-05-07',
      title: 'Today',
      subtitle: 'May 7',
    });
  });

  it('composes visible habit items from persisted habits and logs', async () => {
    setLoadedUser();
    await seedHabit(habitRow({ id: 'pending', name: 'Pending', displayOrder: 2 }));
    await seedHabit(habitRow({ id: 'completed', name: 'Completed', displayOrder: 1 }));
    await seedHabit(habitRow({ id: 'hidden', name: 'Hidden', isHidden: 1 }));
    await seedHabit(
      habitRow({
        id: 'archived',
        name: 'Archived',
        archivedAt: '2026-05-06T12:00:00.000Z',
      })
    );
    await seedTarget(habitTargetRow({ id: 'pending-target', habitId: 'pending' }));
    await seedTarget(habitTargetRow({ id: 'completed-target', habitId: 'completed' }));
    await seedTarget(habitTargetRow({ id: 'hidden-target', habitId: 'hidden' }));
    await seedTarget(habitTargetRow({ id: 'archived-target', habitId: 'archived' }));
    await seedLog(
      habitLogRow({
        id: 'completed-log',
        habitId: 'completed',
        completed: 1,
        completedAt: '2026-05-07T08:00:00.000Z',
      })
    );
    await seedLog(habitLogRow({ id: 'hidden-log', habitId: 'hidden', completed: 1 }));

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-08T12:00:00.000Z',
      preferences: preferences(),
    });

    expect(viewModel.completedHabitCount).toBe(1);
    expect(viewModel.totalVisibleHabitCount).toBe(2);
    expect(viewModel.habitItems.map((item) => [item.habitId, item.status])).toEqual([
      ['pending', 'missed'],
      ['completed', 'completed'],
    ]);
  });

  it('adds target, schedule, and value metadata to habit items', async () => {
    setLoadedUser();
    await seedHabit(habitRow({ id: 'water', name: 'Water' }));
    await seedTarget(
      habitTargetRow({
        id: 'water-target',
        habitId: 'water',
        habitType: 'measurable',
        targetValue: 64,
        targetUnit: 'oz',
        scheduledTime: '08:00',
      })
    );
    await seedLog(
      habitLogRow({
        id: 'water-log-1',
        habitId: 'water',
        date: '2026-05-06',
        completed: 1,
        value: 64,
      })
    );
    await seedLog(
      habitLogRow({
        id: 'water-log-2',
        habitId: 'water',
        date: '2026-05-07',
        completed: 1,
        value: 72,
        completedAt: '2026-05-07T09:00:00.000Z',
      })
    );

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00.000Z',
      preferences: preferences(),
    });

    expect(viewModel.habitItems).toEqual([
      expect.objectContaining({
        habitId: 'water',
        status: 'completed',
        habitType: 'measurable',
        scheduledTime: '08:00',
        value: 72,
        targetValue: 64,
        targetUnit: 'oz',
      }),
    ]);
  });

  it('completes a binary habit and supports undoing the new persisted log', async () => {
    setLoadedUser();
    await seedHabit(habitRow({ id: 'walk' }));
    await seedTarget(habitTargetRow({ id: 'walk-target', habitId: 'walk' }));

    const result = await completeTodayHabit(
      'walk',
      '2026-05-07',
      '2026-05-07T08:00:00.000Z'
    );

    expect(result).toEqual({
      ok: true,
      log: expect.objectContaining({
        habitId: 'walk',
        date: '2026-05-07',
        completed: true,
        completedAt: '2026-05-07T08:00:00.000Z',
      }),
    });

    const logId = result.ok ? result.log.id : '';
    await expect(getHabitLog('walk', '2026-05-07')).resolves.toEqual(
      expect.objectContaining({ id: logId })
    );

    await expect(
      undoTodayHabitCompletion(logId, '2026-05-07T08:00:05.000Z')
    ).resolves.toEqual({ ok: true, logId });
    await expect(getHabitLog('walk', '2026-05-07')).resolves.toBeNull();
  });

  it('routes measurable Today submissions as first-time completions or edits', async () => {
    setLoadedUser();
    await seedHabit(habitRow({ id: 'water' }));
    await seedTarget(
      habitTargetRow({
        id: 'water-target',
        habitId: 'water',
        habitType: 'measurable',
        targetValue: 64,
        targetUnit: 'oz',
        directionality: 'at_least',
      })
    );

    const firstResult = await saveTodayHabitValue(
      'water',
      '2026-05-07',
      64,
      '2026-05-07T08:00:00.000Z'
    );

    expect(firstResult).toEqual({
      ok: true,
      log: expect.objectContaining({
        habitId: 'water',
        completed: true,
        value: 64,
        completedAt: '2026-05-07T08:00:00.000Z',
      }),
    });
    expect(await getHabitCompletionEvents('water', '2026-05-07')).toEqual([
      expect.objectContaining({
        userId: 'user-id',
        habitId: 'water',
        date: '2026-05-07',
        occurredAt: '2026-05-07T08:00:00.000Z',
        value: 64,
        createdAt: '2026-05-07T08:00:00.000Z',
      }),
    ]);

    const logId = firstResult.ok ? firstResult.log.id : '';
    const editedResult = await saveTodayHabitValue(
      'water',
      '2026-05-07',
      32,
      '2026-05-07T09:00:00.000Z'
    );

    expect(editedResult).toEqual({
      ok: true,
      log: expect.objectContaining({
        id: logId,
        habitId: 'water',
        completed: false,
        value: 32,
        completedAt: '2026-05-07T08:00:00.000Z',
      }),
    });
    await expect(getHabitLog('water', '2026-05-07')).resolves.toEqual(
      expect.objectContaining({
        id: logId,
        value: 32,
        completed: false,
        completedAt: '2026-05-07T08:00:00.000Z',
      })
    );
    await expect(getHabitCompletionEvents('water', '2026-05-07')).resolves.toHaveLength(
      1
    );

    await expect(
      undoTodayHabitCompletion(logId, '2026-05-07T09:30:00.000Z')
    ).resolves.toEqual({ ok: true, logId });
    await expect(getHabitLog('water', '2026-05-07')).resolves.toBeNull();
    await expect(getHabitCompletionEvents('water', '2026-05-07')).resolves.toEqual([]);

    const resubmittedResult = await saveTodayHabitValue(
      'water',
      '2026-05-07',
      64,
      '2026-05-07T10:00:00.000Z'
    );

    expect(resubmittedResult).toEqual({
      ok: true,
      log: expect.objectContaining({
        habitId: 'water',
        completed: true,
        value: 64,
        completedAt: '2026-05-07T10:00:00.000Z',
      }),
    });
    expect(await getHabitCompletionEvents('water', '2026-05-07')).toEqual([
      expect.objectContaining({
        userId: 'user-id',
        habitId: 'water',
        date: '2026-05-07',
        occurredAt: '2026-05-07T10:00:00.000Z',
        value: 64,
        createdAt: '2026-05-07T10:00:00.000Z',
      }),
    ]);
    await expect(getHabitLog('water', '2026-05-07')).resolves.toEqual(
      expect.objectContaining({
        value: 64,
        completed: true,
        completedAt: '2026-05-07T10:00:00.000Z',
      })
    );
  });

  it('uses module preferences when composing quick actions', async () => {
    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00.000Z',
      userId: null,
      preferences: preferences({ modulesEnabled: [EnabledModule.MEDICATIONS] }),
    });

    expect(viewModel.quickActions.map((action) => action.kind)).toEqual([
      'checkIn',
      'nutrition',
      'medication',
      'tally',
    ]);
  });

  it('loads cardio items by cardioDate while preserving timestamp date checks', async () => {
    setLoadedUser();
    await seedCardioSession({
      id: 'retro-cardio',
      status: 'completed',
      cardioDate: '2026-05-07',
      type: 'running',
    });

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00.000Z',
      preferences: preferences(),
    });

    expect(viewModel.fitnessItems).toEqual([
      expect.objectContaining({
        id: 'retro-cardio',
        kind: 'cardio',
        status: 'completed',
      }),
    ]);

    const cardioQuery = getMockSqlite()
      .__getQueryLog()
      .find((entry) => entry.source.includes('FROM CardioSession'));
    expect(cardioQuery?.source).toContain('OR cardioDate = ?');
    expect(cardioQuery?.source).toContain('OR date(startedAt) = ?');
    expect(cardioQuery?.source).toContain('OR date(completedAt) = ?');
    expect(cardioQuery?.params).toEqual([
      'user-id',
      '2026-05-07',
      '2026-05-07',
      '2026-05-07',
      '2026-05-07',
    ]);
  });

  it('moves a fitness session to the next calendar date without timestamp arithmetic', async () => {
    await seedWorkoutSession({
      id: 'session-id',
      status: 'planned',
      scheduledDate: '2026-12-31',
      name: 'Workout',
    });

    await expect(
      moveTodayFitnessSessionToTomorrow('workout', 'session-id', '2026-12-31')
    ).resolves.toEqual({
      ok: true,
      kind: 'workout',
      sessionId: 'session-id',
      destinationDate: '2027-01-01',
    });

    const viewModel = await getTodayViewModel({
      selectedDate: '2027-01-01',
      currentDate: '2027-01-01T12:00:00.000Z',
      userId: 'user-id',
      preferences: preferences(),
    });

    expect(viewModel.fitnessItems).toEqual([
      expect.objectContaining({
        id: 'session-id',
        scheduledDate: '2027-01-01',
      }),
    ]);
  });

  it('matches persisted sorting, counting, and visibility rules for mixed habits', async () => {
    setLoadedUser();
    await seedHabit(habitRow({ id: 'untimed-complete', name: 'Done Untimed', displayOrder: 0 }));
    await seedHabit(habitRow({ id: 'untimed-pending', name: 'Pending Untimed', displayOrder: 1 }));
    await seedHabit(habitRow({ id: 'measure', name: 'Measure', displayOrder: 2 }));
    await seedHabit(habitRow({ id: 'timed-pending', name: 'Timed Pending', displayOrder: 5 }));
    await seedHabit(habitRow({ id: 'timed-complete', name: 'Timed Complete', displayOrder: 6 }));
    await seedHabit(habitRow({ id: 'hidden', name: 'Hidden', isHidden: 1 }));
    await seedHabit(
      habitRow({
        id: 'archived',
        name: 'Archived',
        archivedAt: '2026-05-07T10:00:00.000Z',
      })
    );

    await seedTarget(habitTargetRow({ id: 'untimed-complete-target', habitId: 'untimed-complete' }));
    await seedTarget(habitTargetRow({ id: 'untimed-pending-target', habitId: 'untimed-pending' }));
    await seedTarget(
      habitTargetRow({
        id: 'measure-target',
        habitId: 'measure',
        habitType: 'measurable',
        targetValue: 10,
        targetUnit: 'min',
        directionality: 'at_least',
      })
    );
    await seedTarget(
      habitTargetRow({
        id: 'timed-pending-target',
        habitId: 'timed-pending',
        scheduledTime: '08:00',
      })
    );
    await seedTarget(
      habitTargetRow({
        id: 'timed-complete-target',
        habitId: 'timed-complete',
        scheduledTime: '12:00',
      })
    );
    await seedTarget(habitTargetRow({ id: 'hidden-target', habitId: 'hidden' }));
    await seedTarget(habitTargetRow({ id: 'archived-target', habitId: 'archived' }));
    await seedLog(habitLogRow({ id: 'untimed-complete-log', habitId: 'untimed-complete', completed: 1 }));
    await seedLog(habitLogRow({ id: 'timed-complete-log', habitId: 'timed-complete', completed: 1 }));

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T12:00:00.000Z',
      preferences: preferences(),
    });

    expect(viewModel.completedHabitCount).toBe(2);
    expect(viewModel.totalVisibleHabitCount).toBe(5);
    expect(viewModel.habitItems.map((item) => [item.habitId, item.status])).toEqual([
      ['timed-pending', 'pending'],
      ['timed-complete', 'completed'],
      ['untimed-pending', 'pending'],
      ['measure', 'pending'],
      ['untimed-complete', 'completed'],
    ]);
    expect(viewModel.habitItems.find((item) => item.habitId === 'measure')).toEqual(
      expect.objectContaining({
        habitType: 'measurable',
        targetValue: 10,
        targetUnit: 'min',
      })
    );
  });

  it('derives missed only after the selected logical day has ended without writing logs', async () => {
    setLoadedUser({ dayEndTime: '03:00' });
    await seedUserPreferences('user-id', '03:00');
    await seedHabit(habitRow({ id: 'boundary-habit' }));
    await seedTarget(habitTargetRow({ id: 'boundary-target', habitId: 'boundary-habit' }));

    const beforeEnd = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-08T02:59:59.000Z',
      preferences: preferences({ dayEndTime: '03:00' }),
    });
    const afterEnd = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-08T03:00:00.000Z',
      preferences: preferences({ dayEndTime: '03:00' }),
    });

    expect(beforeEnd.habitItems).toEqual([
      expect.objectContaining({ habitId: 'boundary-habit', status: 'pending' }),
    ]);
    expect(afterEnd.habitItems).toEqual([
      expect.objectContaining({ habitId: 'boundary-habit', status: 'missed' }),
    ]);
    await expect(getHabitLog('boundary-habit', '2026-05-07')).resolves.toBeNull();
  });

  it('uses the target phase in force for the selected past date', async () => {
    setLoadedUser();
    await seedHabit(habitRow({ id: 'phase-habit' }));
    await seedTarget(
      habitTargetRow({
        id: 'old-phase',
        habitId: 'phase-habit',
        habitType: 'binary',
        scheduledTime: '08:00',
        effectiveFrom: '2026-05-01',
        createdAt: '2026-05-01T08:00:00.000Z',
      })
    );
    await seedTarget(
      habitTargetRow({
        id: 'new-phase',
        habitId: 'phase-habit',
        habitType: 'measurable',
        targetValue: 30,
        targetUnit: 'min',
        directionality: 'at_least',
        scheduledTime: '20:00',
        effectiveFrom: '2026-06-01',
        createdAt: '2026-06-01T08:00:00.000Z',
      })
    );

    const viewModel = await getTodayViewModel({
      selectedDate: '2026-05-20',
      currentDate: '2026-06-15T12:00:00.000Z',
      preferences: preferences(),
    });

    expect(viewModel.habitItems).toEqual([
      expect.objectContaining({
        habitId: 'phase-habit',
        habitType: 'binary',
        scheduledTime: '08:00',
        targetValue: undefined,
        targetUnit: undefined,
      }),
    ]);
  });

  it('round-trips binary completion for the displayed logical date into recomposed Today counts', async () => {
    setLoadedUser();
    await seedHabit(habitRow({ id: 'displayed-date-habit' }));
    await seedTarget(
      habitTargetRow({
        id: 'displayed-date-target',
        habitId: 'displayed-date-habit',
      })
    );

    const beforeCompletion = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T07:00:00.000Z',
      preferences: preferences(),
    });
    expect(beforeCompletion.completedHabitCount).toBe(0);

    await expect(
      completeTodayHabit(
        'displayed-date-habit',
        '2026-05-07',
        '2026-05-07T08:00:00.000Z'
      )
    ).resolves.toEqual({
      ok: true,
      log: expect.objectContaining({
        habitId: 'displayed-date-habit',
        date: '2026-05-07',
        completed: true,
      }),
    });

    const afterCompletion = await getTodayViewModel({
      selectedDate: '2026-05-07',
      currentDate: '2026-05-07T09:00:00.000Z',
      preferences: preferences(),
    });

    expect(afterCompletion.completedHabitCount).toBe(1);
    expect(afterCompletion.totalVisibleHabitCount).toBe(1);
    expect(afterCompletion.habitItems).toEqual([
      expect.objectContaining({
        habitId: 'displayed-date-habit',
        status: 'completed',
      }),
    ]);
  });
});
