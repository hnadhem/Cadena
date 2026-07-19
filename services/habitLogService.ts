import type * as SQLite from 'expo-sqlite';
import { getDb } from './db';
import {
  HABIT_LOG_ROW_COLUMNS,
  habitLogToRow,
  rowToHabitLog,
  type HabitLogRow,
} from './mappers/habitLogMapper';
import { rowToHabit, type HabitRow } from './mappers/habitMapper';
import {
  HABIT_TARGET_ROW_COLUMNS,
  rowToHabitTarget,
  type HabitTargetRow,
} from './mappers/habitTargetMapper';
import type { Habit, HabitLog, HabitTarget } from '../types/schema';
import { addDaysToIsoDate, resolveLogicalDate } from '../utils/dateUtils';

interface HabitLogWriteOptions {
  note?: string;
  effortRating?: number;
}

interface HabitWriteContext {
  habit: Habit;
  target: HabitTarget;
  currentLogicalDate: string;
  instantIso: string;
}

interface HabitContextRow extends HabitRow {
  timezone: string;
  dayEndTime: string | null;
}

type TransactionDb = Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

const HABIT_CONTEXT_ROW_COLUMNS = `
  h.id AS id,
  h.userId AS userId,
  h.parentHabitId AS parentHabitId,
  h.name AS name,
  h.description AS description,
  h.category AS category,
  h.color AS color,
  h.icon AS icon,
  h.isHidden AS isHidden,
  h.trackEffort AS trackEffort,
  h.startDate AS startDate,
  h.allowMultiplePerDay AS allowMultiplePerDay,
  h.displayOrder AS displayOrder,
  h.isPinned AS isPinned,
  h.archivedAt AS archivedAt,
  h.linkedTallyItemId AS linkedTallyItemId,
  h.createdAt AS createdAt,
  u.timezone AS timezone,
  p.dayEndTime AS dayEndTime
`;

export async function completeBinary(
  habitId: string,
  date: string,
  instant: Date,
  opts: HabitLogWriteOptions = {}
): Promise<HabitLog> {
  const db = getDb();
  let savedLog: HabitLog | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const context = await getWriteContext(txn, habitId, date, instant);

    if (context.target.habitType !== 'binary') {
      throw new Error(`Habit "${habitId}" is measurable on ${date}; use addMeasurableCompletion or setMeasurableValue.`);
    }

    validateEffortRating(context.habit, opts.effortRating);

    const existingLog = await getHabitLog(txn, habitId, date);

    if (existingLog?.completed) {
      savedLog = existingLog;
      return;
    }

    const log: HabitLog = {
      id: existingLog?.id ?? generateId(),
      habitId,
      userId: context.habit.userId,
      date,
      ...gradeHabitLog(context.target, undefined, true),
      effortRating: opts.effortRating,
      note: opts.note,
      completedAt: getActionCompletedAt(date, context),
    };

    await upsertHabitLog(txn, log);
    await appendHabitCompletionEvent(txn, context, date, null);
    savedLog = log;
  });

  return requireSavedLog(savedLog);
}

export async function addMeasurableCompletion(
  habitId: string,
  date: string,
  instant: Date,
  value: number,
  opts: HabitLogWriteOptions = {}
): Promise<HabitLog> {
  validateMeasurableValue(value);

  const db = getDb();
  let savedLog: HabitLog | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const context = await getWriteContext(txn, habitId, date, instant);

    if (context.target.habitType !== 'measurable') {
      throw new Error(`Habit "${habitId}" is binary on ${date}; use completeBinary.`);
    }

    validateEffortRating(context.habit, opts.effortRating);

    savedLog = await addMeasurableCompletionInTransaction(
      txn,
      context,
      date,
      value,
      opts
    );
  });

  return requireSavedLog(savedLog);
}

export async function setMeasurableValue(
  habitId: string,
  date: string,
  instant: Date,
  value: number,
  opts: HabitLogWriteOptions = {}
): Promise<HabitLog> {
  validateMeasurableValue(value);

  const db = getDb();
  let savedLog: HabitLog | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const context = await getWriteContext(txn, habitId, date, instant);

    if (context.target.habitType !== 'measurable') {
      throw new Error(`Habit "${habitId}" is binary on ${date}; use completeBinary.`);
    }

    validateEffortRating(context.habit, opts.effortRating);

    savedLog = await setMeasurableValueInTransaction(txn, context, date, value, opts);
  });

  return requireSavedLog(savedLog);
}

export async function submitMeasurableValue(
  habitId: string,
  date: string,
  instant: Date,
  value: number,
  opts: HabitLogWriteOptions = {}
): Promise<HabitLog> {
  validateMeasurableValue(value);

  const db = getDb();
  let savedLog: HabitLog | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const context = await getWriteContext(txn, habitId, date, instant);

    if (context.target.habitType !== 'measurable') {
      throw new Error(`Habit "${habitId}" is binary on ${date}; use completeBinary.`);
    }

    validateEffortRating(context.habit, opts.effortRating);

    const existingLog = await getHabitLog(txn, habitId, date);

    if (existingLog) {
      savedLog = await setMeasurableValueInTransaction(
        txn,
        context,
        date,
        value,
        opts,
        existingLog
      );
      return;
    }

    savedLog = await addMeasurableCompletionInTransaction(
      txn,
      context,
      date,
      value,
      opts,
      existingLog
    );
  });

  return requireSavedLog(savedLog);
}

export async function clearLog(
  habitId: string,
  date: string,
  instant: Date
): Promise<void> {
  const db = getDb();

  await db.withExclusiveTransactionAsync(async (txn) => {
    await getWriteContext(txn, habitId, date, instant);
    await txn.runAsync('DELETE FROM HabitLog WHERE habitId = ? AND date = ?', habitId, date);
    await txn.runAsync(
      'DELETE FROM HabitCompletionEvent WHERE habitId = ? AND date = ?',
      habitId,
      date
    );
  });
}

async function getWriteContext(
  db: TransactionDb,
  habitId: string,
  date: string,
  instant: Date
): Promise<HabitWriteContext> {
  const instantIso = validateInstant(instant);
  const canonicalDate = validateIsoDate(date);

  if (canonicalDate !== date) {
    throw new Error(`Habit log date "${date}" must use canonical YYYY-MM-DD format.`);
  }

  const habitContextRow = await db.getFirstAsync<HabitContextRow>(
    `SELECT ${HABIT_CONTEXT_ROW_COLUMNS}
    FROM Habit h
    INNER JOIN User u ON u.id = h.userId
    LEFT JOIN UserPreferences p ON p.userId = h.userId
    WHERE h.id = ?
    LIMIT 1`,
    habitId
  );

  if (!habitContextRow) {
    throw new Error(`Habit "${habitId}" was not found.`);
  }

  const habit = rowToHabit(habitContextRow);
  const dayEndTime = habitContextRow.dayEndTime ?? '00:00';
  const currentLogicalDate = resolveLogicalDate(instant, habitContextRow.timezone, dayEndTime);
  const windowStart = addDaysToIsoDate(currentLogicalDate, -3);

  if (date < windowStart || date > currentLogicalDate) {
    throw new Error(
      `Habit log date ${date} is outside the 3-calendar-day retroactive window (${windowStart} through ${currentLogicalDate}).`
    );
  }

  const target = await resolveTargetInTransaction(db, habitId, date);

  if (!target) {
    throw new Error(`Habit "${habitId}" has no target in force on ${date}.`);
  }

  return { habit, target, currentLogicalDate, instantIso };
}

async function resolveTargetInTransaction(
  db: TransactionDb,
  habitId: string,
  date: string
): Promise<HabitTarget | null> {
  const row = await db.getFirstAsync<HabitTargetRow>(
    `SELECT ${HABIT_TARGET_ROW_COLUMNS}
    FROM HabitTarget
    WHERE habitId = ?
      AND effectiveFrom <= ?
    ORDER BY effectiveFrom DESC, createdAt DESC, id DESC
    LIMIT 1`,
    habitId,
    date
  );

  return row ? rowToHabitTarget(row) : null;
}

async function getHabitLog(
  db: TransactionDb,
  habitId: string,
  date: string
): Promise<HabitLog | null> {
  const row = await db.getFirstAsync<HabitLogRow>(
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

async function addMeasurableCompletionInTransaction(
  db: TransactionDb,
  context: HabitWriteContext,
  date: string,
  value: number,
  opts: HabitLogWriteOptions,
  existingLog?: HabitLog | null
): Promise<HabitLog> {
  const currentLog = existingLog === undefined
    ? await getHabitLog(db, context.habit.id, date)
    : existingLog;
  const aggregateValue = (currentLog?.value ?? 0) + value;
  const grade = gradeHabitLog(context.target, aggregateValue);
  const log: HabitLog = {
    id: currentLog?.id ?? generateId(),
    habitId: context.habit.id,
    userId: context.habit.userId,
    date,
    completed: grade.completed,
    streakValid: grade.streakValid,
    value: aggregateValue,
    effortRating: opts.effortRating,
    note: opts.note,
    completedAt: getActionCompletedAt(date, context),
  };

  await upsertHabitLog(db, log);
  await appendHabitCompletionEvent(db, context, date, value);

  return log;
}

async function setMeasurableValueInTransaction(
  db: TransactionDb,
  context: HabitWriteContext,
  date: string,
  value: number,
  opts: HabitLogWriteOptions,
  existingLog?: HabitLog | null
): Promise<HabitLog> {
  const currentLog = existingLog === undefined
    ? await getHabitLog(db, context.habit.id, date)
    : existingLog;
  const grade = gradeHabitLog(context.target, value);
  const log: HabitLog = {
    id: currentLog?.id ?? generateId(),
    habitId: context.habit.id,
    userId: context.habit.userId,
    date,
    completed: grade.completed,
    streakValid: grade.streakValid,
    value,
    effortRating: opts.effortRating,
    note: opts.note,
    completedAt: currentLog?.completedAt,
  };

  await upsertHabitLogPreservingCompletedAt(db, log);

  return log;
}

async function upsertHabitLog(db: TransactionDb, log: HabitLog): Promise<void> {
  const row = habitLogToRow(log);

  await db.runAsync(
    `INSERT INTO HabitLog (
      id, habitId, userId, date, completed, streakValid, value, effortRating, note, completedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(habitId, date) DO UPDATE SET
      completed = excluded.completed,
      streakValid = excluded.streakValid,
      value = excluded.value,
      effortRating = excluded.effortRating,
      note = excluded.note,
      completedAt = excluded.completedAt`,
    row.id,
    row.habitId,
    row.userId,
    row.date,
    row.completed,
    row.streakValid,
    row.value,
    row.effortRating,
    row.note,
    row.completedAt
  );
}

async function upsertHabitLogPreservingCompletedAt(
  db: TransactionDb,
  log: HabitLog
): Promise<void> {
  const row = habitLogToRow(log);

  await db.runAsync(
    `INSERT INTO HabitLog (
      id, habitId, userId, date, completed, streakValid, value, effortRating, note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(habitId, date) DO UPDATE SET
      completed = excluded.completed,
      streakValid = excluded.streakValid,
      value = excluded.value,
      effortRating = excluded.effortRating,
      note = excluded.note`,
    row.id,
    row.habitId,
    row.userId,
    row.date,
    row.completed,
    row.streakValid,
    row.value,
    row.effortRating,
    row.note
  );
}

async function appendHabitCompletionEvent(
  db: TransactionDb,
  context: HabitWriteContext,
  date: string,
  value: number | null
): Promise<void> {
  await db.runAsync(
    `INSERT INTO HabitCompletionEvent (
      id, userId, habitId, date, occurredAt, value, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    generateId(),
    context.habit.userId,
    context.habit.id,
    date,
    context.instantIso,
    value,
    context.instantIso
  );
}

function validateInstant(instant: Date): string {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new Error('instant must be a valid Date.');
  }

  return instant.toISOString();
}

function validateIsoDate(date: string): string {
  try {
    return addDaysToIsoDate(date, 0);
  } catch {
    throw new Error('Habit log date must be a valid YYYY-MM-DD date.');
  }
}

function validateMeasurableValue(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Habit log value must be a non-negative finite number.');
  }
}

function validateEffortRating(habit: Habit, effortRating: number | undefined): void {
  if (effortRating === undefined) {
    return;
  }

  if (!habit.trackEffort) {
    throw new Error(`Habit "${habit.id}" does not track effort ratings.`);
  }

  if (!Number.isInteger(effortRating) || effortRating < 1 || effortRating > 5) {
    throw new Error('effortRating must be an integer from 1 to 5.');
  }
}

interface HabitLogGrade {
  completed: boolean;
  streakValid: boolean;
}

function gradeHabitLog(
  target: HabitTarget,
  value: number | undefined,
  binaryCompleted = false
): HabitLogGrade {
  if (target.habitType !== 'measurable') {
    return {
      completed: binaryCompleted,
      streakValid: binaryCompleted,
    };
  }

  const completed = isValueCompleteForTarget(
    value,
    target.targetValue,
    target.directionality
  );
  const streakTargetValue = target.streakCompletionThreshold ?? target.targetValue;
  const streakValid = isValueCompleteForTarget(
    value,
    streakTargetValue,
    target.directionality
  );

  return { completed, streakValid };
}

function isValueCompleteForTarget(
  value: number | undefined,
  targetValue: number | undefined,
  directionality: HabitTarget['directionality']
): boolean {
  const loggedValue = value ?? 0;

  if (targetValue === undefined) {
    return loggedValue > 0;
  }

  if (directionality === 'at_most') {
    return loggedValue <= targetValue;
  }

  return loggedValue >= targetValue;
}

function getActionCompletedAt(date: string, context: HabitWriteContext): string | undefined {
  return date === context.currentLogicalDate ? context.instantIso : undefined;
}

function requireSavedLog(log: HabitLog | null): HabitLog {
  if (!log) {
    throw new Error('Habit log write did not produce a saved row.');
  }

  return log;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholder) => {
    const random = (Math.random() * 16) | 0;
    const value = placeholder === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
