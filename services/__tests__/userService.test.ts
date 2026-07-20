import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppMode } from '../../constants/enums';
import { useUserStore } from '../../store/userStore';
import { getDb, runMigrations } from '../db';
import { getOrCreateUser } from '../userService';

interface MockUserRow {
  id: string;
  email: string | null;
  displayName: string | null;
  timezone: string;
  createdAt: string;
  lastActiveAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingVersion: string | null;
}

interface MockPreferenceRow {
  userId: string;
  appMode: string;
  weightUnit: string;
  distanceUnit: string;
  weekStartDay: number;
  defaultRestSeconds: number | null;
  defaultReps: number | null;
  defaultSets: number | null;
  theme: string;
  colorScheme: string;
  requireBiometricForHiddenHabits: number;
  dayEndTime: string;
  seenProgressionIntentTooltip: number;
  modulesEnabled: string;
  heightCm: number | null;
  dateOfBirth: string | null;
  biologicalSex: string | null;
  tdeeCalories: number | null;
  goals: string;
}

interface MockNotificationSettingsRow {
  userId: string;
}

interface MockSnapshot {
  users: MockUserRow[];
  preferences: MockPreferenceRow[];
  notificationSettings: MockNotificationSettingsRow[];
}

interface MockSqliteControls {
  __getSnapshot: (databaseName?: string) => MockSnapshot;
  __resetDatabase: (databaseName: string) => void;
}

jest.mock('expo-sqlite', () => {
  type MockBindValue = string | number | null | boolean | Uint8Array;

  interface MockUserRow {
    id: string;
    email: string | null;
    displayName: string | null;
    timezone: string;
    createdAt: string;
    lastActiveAt: string | null;
    onboardingCompletedAt: string | null;
    onboardingVersion: string | null;
  }

  interface MockPreferenceRow {
    userId: string;
    appMode: string;
    weightUnit: string;
    distanceUnit: string;
    weekStartDay: number;
    defaultRestSeconds: number | null;
    defaultReps: number | null;
    defaultSets: number | null;
    theme: string;
    colorScheme: string;
    requireBiometricForHiddenHabits: number;
    dayEndTime: string;
    seenProgressionIntentTooltip: number;
    modulesEnabled: string;
    heightCm: number | null;
    dateOfBirth: string | null;
    biologicalSex: string | null;
    tdeeCalories: number | null;
    goals: string;
  }

  interface MockNotificationSettingsRow {
    userId: string;
  }

  interface MockSnapshot {
    users: MockUserRow[];
    preferences: MockPreferenceRow[];
    notificationSettings: MockNotificationSettingsRow[];
  }

  const databases = new Map<string, MockSQLiteDatabase>();

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private users: MockUserRow[] = [];
    private preferences: MockPreferenceRow[] = [];
    private notificationSettings: MockNotificationSettingsRow[] = [];

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

      if (source.includes('INSERT INTO UserPreferences')) {
        const userId = readStringParam(params, 0, 'userId');
        const appMode =
          params.length > 1 ? readStringParam(params, 1, 'appMode') : undefined;
        this.preferences.push(defaultPreferenceRow(userId, { appMode }));
        return { lastInsertRowId: this.preferences.length, changes: 1 };
      }

      if (source.includes('INSERT INTO NotificationSettings')) {
        this.notificationSettings.push({
          userId: readStringParam(params, 0, 'userId'),
        });
        return { lastInsertRowId: this.notificationSettings.length, changes: 1 };
      }

      if (source.includes('INSERT INTO User')) {
        this.users.push(readUserParams(params));
        return { lastInsertRowId: this.users.length, changes: 1 };
      }

      return { lastInsertRowId: 0, changes: 1 };
    }

    async getFirstAsync(
      source: string,
      ...params: MockBindValue[]
    ): Promise<unknown | null> {
      if (source.includes('SELECT version FROM schema_version')) {
        return this.schemaVersion === null ? null : { version: this.schemaVersion };
      }

      if (source.includes('FROM UserPreferences')) {
        const userId = readStringParam(params, 0, 'userId');
        const row = this.preferences.find((preference) => preference.userId === userId);
        return row ? clonePreferenceRow(row) : null;
      }

      if (source.includes('FROM User')) {
        return this.users
          .slice()
          .sort(compareUserRows)
          .map(cloneUserRow)[0] ?? null;
      }

      return null;
    }

    snapshot(): MockSnapshot {
      return {
        users: this.users.map(cloneUserRow),
        preferences: this.preferences.map(clonePreferenceRow),
        notificationSettings: this.notificationSettings.map((row) => ({ ...row })),
      };
    }

    private restore(snapshot: MockSnapshot): void {
      this.users = snapshot.users.map(cloneUserRow);
      this.preferences = snapshot.preferences.map(clonePreferenceRow);
      this.notificationSettings = snapshot.notificationSettings.map((row) => ({
        ...row,
      }));
    }
  }

  return {
    openDatabaseAsync: async (databaseName = 'habit.db') =>
      getDatabase(databaseName),
    __getSnapshot: (databaseName = 'habit.db') =>
      getDatabase(databaseName).snapshot(),
    __resetDatabase: (databaseName: string) => {
      databases.set(databaseName, new MockSQLiteDatabase());
    },
  };

  function getDatabase(databaseName: string): MockSQLiteDatabase {
    let database = databases.get(databaseName);

    if (!database) {
      database = new MockSQLiteDatabase();
      databases.set(databaseName, database);
    }

    return database;
  }

  function readUserParams(params: MockBindValue[]): MockUserRow {
    if (params.length >= 8) {
      return {
        id: readStringParam(params, 0, 'id'),
        email: readNullableStringParam(params, 1, 'email'),
        displayName: readNullableStringParam(params, 2, 'displayName'),
        timezone: readStringParam(params, 3, 'timezone'),
        createdAt: readStringParam(params, 4, 'createdAt'),
        lastActiveAt: readNullableStringParam(params, 5, 'lastActiveAt'),
        onboardingCompletedAt: readNullableStringParam(
          params,
          6,
          'onboardingCompletedAt'
        ),
        onboardingVersion: readNullableStringParam(params, 7, 'onboardingVersion'),
      };
    }

    return {
      id: readStringParam(params, 0, 'id'),
      email: null,
      displayName: null,
      timezone: readStringParam(params, 1, 'timezone'),
      createdAt: readStringParam(params, 2, 'createdAt'),
      lastActiveAt: null,
      onboardingCompletedAt: null,
      onboardingVersion: null,
    };
  }

  function defaultPreferenceRow(
    userId: string,
    overrides: Partial<MockPreferenceRow> = {}
  ): MockPreferenceRow {
    return {
      userId,
      appMode: overrides.appMode ?? 'combined',
      weightUnit: overrides.weightUnit ?? 'lbs',
      distanceUnit: overrides.distanceUnit ?? 'mi',
      weekStartDay: overrides.weekStartDay ?? 0,
      defaultRestSeconds: overrides.defaultRestSeconds ?? null,
      defaultReps: overrides.defaultReps ?? null,
      defaultSets: overrides.defaultSets ?? null,
      theme: overrides.theme ?? 'system',
      colorScheme: overrides.colorScheme ?? 'muted',
      requireBiometricForHiddenHabits:
        overrides.requireBiometricForHiddenHabits ?? 0,
      dayEndTime: overrides.dayEndTime ?? '00:00',
      seenProgressionIntentTooltip:
        overrides.seenProgressionIntentTooltip ?? 0,
      modulesEnabled: overrides.modulesEnabled ?? '[]',
      heightCm: overrides.heightCm ?? null,
      dateOfBirth: overrides.dateOfBirth ?? null,
      biologicalSex: overrides.biologicalSex ?? null,
      tdeeCalories: overrides.tdeeCalories ?? null,
      goals: overrides.goals ?? '[]',
    };
  }

  function compareUserRows(a: MockUserRow, b: MockUserRow): number {
    const createdCompare = a.createdAt.localeCompare(b.createdAt);
    if (createdCompare !== 0) return createdCompare;

    return a.id.localeCompare(b.id);
  }

  function cloneUserRow(row: MockUserRow): MockUserRow {
    return { ...row };
  }

  function clonePreferenceRow(row: MockPreferenceRow): MockPreferenceRow {
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
});

const sqlite = jest.requireMock('expo-sqlite') as MockSqliteControls;

describe('userService bootstrap', () => {
  beforeEach(async () => {
    sqlite.__resetDatabase(':memory:');
    useUserStore.setState({
      userId: null,
      timezone: 'UTC',
      appMode: AppMode.COMBINED,
      preferences: null,
    });
    await runMigrations(':memory:');
  });

  it('creates exactly one foundational row per table on a fresh database', async () => {
    const first = await getOrCreateUser();
    const afterFirst = sqlite.__getSnapshot(':memory:');

    expect(first.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(first.user.timezone).not.toHaveLength(0);
    expect(first.user.onboardingCompletedAt).toBeUndefined();
    expect(first.preferences).toMatchObject({
      userId: first.user.id,
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
    });
    expect(afterFirst.users).toHaveLength(1);
    expect(afterFirst.preferences).toHaveLength(1);
    expect(afterFirst.notificationSettings).toHaveLength(1);

    const second = await getOrCreateUser();
    const afterSecond = sqlite.__getSnapshot(':memory:');

    expect(second.user.id).toBe(first.user.id);
    expect(afterSecond.users).toHaveLength(1);
    expect(afterSecond.preferences).toHaveLength(1);
    expect(afterSecond.notificationSettings).toHaveLength(1);
  });

  it('loads an existing user and preferences without creating new rows', async () => {
    await getDb().runAsync(
      `INSERT INTO User (id, timezone, createdAt)
      VALUES (?, ?, ?)`,
      'existing-user',
      'America/New_York',
      '2026-07-20T10:00:00.000Z'
    );
    await getDb().runAsync(
      `INSERT INTO UserPreferences (userId, appMode)
      VALUES (?, ?)`,
      'existing-user',
      AppMode.FITNESS_ONLY
    );

    const result = await getOrCreateUser();
    const snapshot = sqlite.__getSnapshot(':memory:');

    expect(result.user).toMatchObject({
      id: 'existing-user',
      timezone: 'America/New_York',
      createdAt: '2026-07-20T10:00:00.000Z',
    });
    expect(result.preferences.appMode).toBe(AppMode.FITNESS_ONLY);
    expect(snapshot.users).toHaveLength(1);
    expect(snapshot.preferences).toHaveLength(1);
    expect(snapshot.notificationSettings).toHaveLength(0);
  });

  it('loads bootstrap results into userStore', async () => {
    await useUserStore.getState().bootstrap();

    const state = useUserStore.getState();
    const snapshot = sqlite.__getSnapshot(':memory:');

    expect(state.userId).toBe(snapshot.users[0].id);
    expect(state.timezone).toBe(snapshot.users[0].timezone);
    expect(state.appMode).toBe(AppMode.COMBINED);
    expect(state.preferences?.userId).toBe(snapshot.users[0].id);
  });
});
