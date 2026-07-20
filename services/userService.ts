import type * as SQLite from 'expo-sqlite';
import { AppMode, EnabledModule, GoalType } from '../constants/enums';
import type { User, UserPreferences } from '../types/schema';
import { getDeviceTimezone } from '../utils/dateUtils';
import { getDb } from './db';
import {
  readBooleanInt,
  readNullableNumber,
  readNullableString,
  readNullableStringEnum,
  readNumber,
  readRowObject,
  readString,
  readStringArrayJson,
  readStringEnum,
} from './mappers/mapperUtils';

type ReadDb = Pick<SQLite.SQLiteDatabase, 'getFirstAsync'>;
type WriteDb = Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

export interface UserBootstrapResult {
  user: User;
  preferences: UserPreferences;
}

interface UserRow {
  id: string;
  email: string | null;
  displayName: string | null;
  timezone: string;
  createdAt: string;
  lastActiveAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingVersion: string | null;
}

interface UserPreferencesRow {
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

const USER_TABLE = 'User';
const USER_PREFERENCES_TABLE = 'UserPreferences';

const USER_ROW_COLUMNS =
  'id, email, displayName, timezone, createdAt, lastActiveAt, onboardingCompletedAt, onboardingVersion';
const USER_PREFERENCES_ROW_COLUMNS =
  'userId, appMode, weightUnit, distanceUnit, weekStartDay, defaultRestSeconds, defaultReps, defaultSets, theme, colorScheme, requireBiometricForHiddenHabits, dayEndTime, seenProgressionIntentTooltip, modulesEnabled, heightCm, dateOfBirth, biologicalSex, tdeeCalories, goals';

const APP_MODE_VALUES: readonly AppMode[] = [
  AppMode.FITNESS_ONLY,
  AppMode.HABITS_ONLY,
  AppMode.COMBINED,
];
const WEIGHT_UNIT_VALUES: readonly ['lbs', 'kg'] = ['lbs', 'kg'];
const DISTANCE_UNIT_VALUES: readonly ['mi', 'km'] = ['mi', 'km'];
const THEME_VALUES: readonly ['light', 'dark', 'system'] = [
  'light',
  'dark',
  'system',
];
const COLOR_SCHEME_VALUES: readonly ['classic', 'muted'] = ['classic', 'muted'];
const BIOLOGICAL_SEX_VALUES: readonly [
  'male',
  'female',
  'prefer_not_to_say',
] = ['male', 'female', 'prefer_not_to_say'];
const ENABLED_MODULE_VALUES: readonly EnabledModule[] = [
  EnabledModule.NUTRITION,
  EnabledModule.MEDICATIONS,
  EnabledModule.BODY_METRICS,
  EnabledModule.TALLY,
  EnabledModule.JOURNAL,
];
const GOAL_TYPE_VALUES: readonly GoalType[] = [
  GoalType.LOSE_WEIGHT,
  GoalType.BUILD_MUSCLE,
  GoalType.IMPROVE_ENDURANCE,
  GoalType.GENERAL_FITNESS,
  GoalType.BUILD_HABIT,
  GoalType.MENTAL_WELLNESS,
  GoalType.SPORT_PERFORMANCE,
];

export async function getOrCreateUser(): Promise<UserBootstrapResult> {
  const db = getDb();
  const existingUser = await getUser(db);

  if (existingUser) {
    return {
      user: existingUser,
      preferences: await requirePreferences(db, existingUser.id),
    };
  }

  let result: UserBootstrapResult | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const userInTransaction = await getUser(txn);

    if (userInTransaction) {
      result = {
        user: userInTransaction,
        preferences: await requirePreferences(txn, userInTransaction.id),
      };
      return;
    }

    const user: User = {
      id: generateId(),
      timezone: getDeviceTimezone(),
      createdAt: new Date().toISOString(),
    };

    await insertUser(txn, user);
    await txn.runAsync('INSERT INTO UserPreferences (userId) VALUES (?)', user.id);
    await txn.runAsync('INSERT INTO NotificationSettings (userId) VALUES (?)', user.id);

    result = {
      user,
      preferences: await requirePreferences(txn, user.id),
    };
  });

  if (!result) {
    throw new Error('User bootstrap did not produce a user.');
  }

  return result;
}

export async function getUser(db: ReadDb = getDb()): Promise<User | null> {
  const row = await db.getFirstAsync<UserRow>(
    `SELECT ${USER_ROW_COLUMNS}
    FROM User
    ORDER BY createdAt ASC, id ASC
    LIMIT 1`
  );

  return row ? rowToUser(row) : null;
}

export async function getPreferences(
  userId: string,
  db: ReadDb = getDb()
): Promise<UserPreferences | null> {
  const row = await db.getFirstAsync<UserPreferencesRow>(
    `SELECT ${USER_PREFERENCES_ROW_COLUMNS}
    FROM UserPreferences
    WHERE userId = ?
    LIMIT 1`,
    userId
  );

  return row ? rowToUserPreferences(row) : null;
}

async function insertUser(db: WriteDb, user: User): Promise<void> {
  await db.runAsync(
    `INSERT INTO User (
      id, email, displayName, timezone, createdAt, lastActiveAt,
      onboardingCompletedAt, onboardingVersion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    null,
    null,
    user.timezone,
    user.createdAt,
    null,
    null,
    null
  );
}

async function requirePreferences(
  db: ReadDb,
  userId: string
): Promise<UserPreferences> {
  const preferences = await getPreferences(userId, db);

  if (!preferences) {
    throw new Error(`UserPreferences for user "${userId}" were not found.`);
  }

  return preferences;
}

function rowToUser(row: unknown): User {
  const record = readRowObject(row, USER_TABLE);

  return {
    id: readString(record, USER_TABLE, 'id'),
    email: readNullableString(record, USER_TABLE, 'email'),
    displayName: readNullableString(record, USER_TABLE, 'displayName'),
    timezone: readString(record, USER_TABLE, 'timezone'),
    createdAt: readString(record, USER_TABLE, 'createdAt'),
    lastActiveAt: readNullableString(record, USER_TABLE, 'lastActiveAt'),
    onboardingCompletedAt: readNullableString(
      record,
      USER_TABLE,
      'onboardingCompletedAt'
    ),
    onboardingVersion: readNullableString(record, USER_TABLE, 'onboardingVersion'),
  };
}

function rowToUserPreferences(row: unknown): UserPreferences {
  const record = readRowObject(row, USER_PREFERENCES_TABLE);

  return {
    userId: readString(record, USER_PREFERENCES_TABLE, 'userId'),
    appMode: readStringEnum(
      record,
      USER_PREFERENCES_TABLE,
      'appMode',
      APP_MODE_VALUES
    ),
    weightUnit: readStringEnum(
      record,
      USER_PREFERENCES_TABLE,
      'weightUnit',
      WEIGHT_UNIT_VALUES
    ),
    distanceUnit: readStringEnum(
      record,
      USER_PREFERENCES_TABLE,
      'distanceUnit',
      DISTANCE_UNIT_VALUES
    ),
    weekStartDay: readNumber(record, USER_PREFERENCES_TABLE, 'weekStartDay'),
    defaultRestSeconds: readNullableNumber(
      record,
      USER_PREFERENCES_TABLE,
      'defaultRestSeconds'
    ),
    defaultReps: readNullableNumber(record, USER_PREFERENCES_TABLE, 'defaultReps'),
    defaultSets: readNullableNumber(record, USER_PREFERENCES_TABLE, 'defaultSets'),
    theme: readStringEnum(record, USER_PREFERENCES_TABLE, 'theme', THEME_VALUES),
    colorScheme: readStringEnum(
      record,
      USER_PREFERENCES_TABLE,
      'colorScheme',
      COLOR_SCHEME_VALUES
    ),
    requireBiometricForHiddenHabits: readBooleanInt(
      record,
      USER_PREFERENCES_TABLE,
      'requireBiometricForHiddenHabits'
    ),
    dayEndTime: readString(record, USER_PREFERENCES_TABLE, 'dayEndTime'),
    seenProgressionIntentTooltip: readBooleanInt(
      record,
      USER_PREFERENCES_TABLE,
      'seenProgressionIntentTooltip'
    ),
    modulesEnabled: readRequiredEnumArrayJson(
      record,
      USER_PREFERENCES_TABLE,
      'modulesEnabled',
      ENABLED_MODULE_VALUES
    ),
    heightCm: readNullableNumber(record, USER_PREFERENCES_TABLE, 'heightCm'),
    dateOfBirth: readNullableString(record, USER_PREFERENCES_TABLE, 'dateOfBirth'),
    biologicalSex: readNullableStringEnum(
      record,
      USER_PREFERENCES_TABLE,
      'biologicalSex',
      BIOLOGICAL_SEX_VALUES
    ),
    tdeeCalories: readNullableNumber(record, USER_PREFERENCES_TABLE, 'tdeeCalories'),
    goals: readRequiredEnumArrayJson(
      record,
      USER_PREFERENCES_TABLE,
      'goals',
      GOAL_TYPE_VALUES
    ),
  };
}

function readRequiredEnumArrayJson<T extends string>(
  record: ReturnType<typeof readRowObject>,
  table: string,
  column: string,
  allowedValues: readonly T[]
): T[] {
  const values = readStringArrayJson(record, table, column);

  if (!values) {
    throw new Error(`Invalid ${table}.${column}: expected JSON array string.`);
  }

  return values.map((value) => {
    if (allowedValues.includes(value as T)) {
      return value as T;
    }

    throw new Error(
      `Invalid ${table}.${column}: expected one of ${allowedValues.join(', ')}.`
    );
  });
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholder) => {
    const random = (Math.random() * 16) | 0;
    const value = placeholder === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
