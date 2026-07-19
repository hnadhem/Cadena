import type * as SQLite from 'expo-sqlite';
import { getDb } from './db';
import {
  habitToRow,
  rowToHabit,
  type HabitRow,
} from './mappers/habitMapper';
import {
  HABIT_TARGET_ROW_COLUMNS,
  habitTargetToRow,
  rowToHabitTarget,
  type HabitTargetRow,
} from './mappers/habitTargetMapper';
import type { Habit, HabitTarget } from '../types/schema';
import { addDaysToIsoDate } from '../utils/dateUtils';

type TransactionDb = Pick<
  SQLite.SQLiteDatabase,
  'getFirstAsync' | 'getAllAsync' | 'runAsync'
>;

export type CreateHabitTargetInput = Omit<
  HabitTarget,
  'id' | 'habitId' | 'effectiveFrom' | 'createdAt'
> & {
  id?: string;
  createdAt?: string;
};

export interface CreateHabitInput
  extends Omit<Habit, 'id' | 'createdAt' | 'archivedAt' | 'parentHabitId'> {
  id?: string;
  createdAt?: string;
  parentHabitId?: string;
  target: CreateHabitTargetInput;
}

export type UpdateHabitPatch = Partial<
  Pick<
    Habit,
    | 'name'
    | 'description'
    | 'category'
    | 'color'
    | 'icon'
    | 'isHidden'
    | 'trackEffort'
    | 'allowMultiplePerDay'
    | 'displayOrder'
    | 'isPinned'
    | 'linkedTallyItemId'
  >
> & {
  parentHabitId?: string;
};

export type CreateTargetPhaseInput = Omit<
  HabitTarget,
  'id' | 'habitId' | 'effectiveFrom' | 'createdAt'
> & {
  id?: string;
  createdAt?: string;
};

const HABIT_ROW_COLUMNS =
  'id, userId, parentHabitId, name, description, category, color, icon, isHidden, trackEffort, startDate, allowMultiplePerDay, displayOrder, isPinned, archivedAt, linkedTallyItemId, createdAt';

export async function createHabit(input: CreateHabitInput): Promise<{
  habit: Habit;
  target: HabitTarget;
}> {
  rejectParentHabitId(input.parentHabitId);

  const db = getDb();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const habit: Habit = {
    id: input.id ?? generateId(),
    userId: input.userId,
    name: input.name,
    description: input.description,
    category: input.category,
    color: input.color,
    icon: input.icon,
    isHidden: input.isHidden,
    trackEffort: input.trackEffort,
    startDate: validateIsoDate(input.startDate, 'startDate'),
    allowMultiplePerDay: input.allowMultiplePerDay,
    displayOrder: input.displayOrder,
    isPinned: input.isPinned,
    linkedTallyItemId: input.linkedTallyItemId,
    createdAt,
  };
  const target: HabitTarget = {
    ...input.target,
    id: input.target.id ?? generateId(),
    habitId: habit.id,
    effectiveFrom: habit.startDate,
    createdAt: input.target.createdAt ?? createdAt,
  };

  await db.withExclusiveTransactionAsync(async (txn) => {
    await insertHabit(txn, habit);
    await insertHabitTarget(txn, target);
  });

  return { habit, target };
}

export async function updateHabit(
  habitId: string,
  patch: UpdateHabitPatch
): Promise<Habit> {
  rejectParentHabitId(patch.parentHabitId);

  const existingHabit = await getHabitById(habitId);

  if (!existingHabit) {
    throw new Error(`Habit "${habitId}" was not found.`);
  }

  const updatedHabit: Habit = {
    ...existingHabit,
    ...omitUndefined({
      name: patch.name,
      description: patch.description,
      category: patch.category,
      color: patch.color,
      icon: patch.icon,
      isHidden: patch.isHidden,
      trackEffort: patch.trackEffort,
      allowMultiplePerDay: patch.allowMultiplePerDay,
      displayOrder: patch.displayOrder,
      isPinned: patch.isPinned,
      linkedTallyItemId: patch.linkedTallyItemId,
    }),
  };

  await updateHabitRow(getDb(), updatedHabit);

  return requireHabit(await getHabitById(habitId), habitId);
}

export async function archiveHabit(
  habitId: string,
  archivedAt = new Date().toISOString()
): Promise<Habit> {
  const habit = await getHabitById(habitId);

  if (!habit) {
    throw new Error(`Habit "${habitId}" was not found.`);
  }

  await getDb().runAsync('UPDATE Habit SET archivedAt = ? WHERE id = ?', archivedAt, habitId);

  return requireHabit(await getHabitById(habitId), habitId);
}

export async function unarchiveHabit(habitId: string): Promise<Habit> {
  const habit = await getHabitById(habitId);

  if (!habit) {
    throw new Error(`Habit "${habitId}" was not found.`);
  }

  await getDb().runAsync('UPDATE Habit SET archivedAt = NULL WHERE id = ?', habitId);

  return requireHabit(await getHabitById(habitId), habitId);
}

export async function createTargetPhase(
  habitId: string,
  targetInput: CreateTargetPhaseInput,
  effectiveFrom: string
): Promise<HabitTarget> {
  const canonicalEffectiveFrom = validateIsoDate(effectiveFrom, 'effectiveFrom');
  const db = getDb();
  let savedTarget: HabitTarget | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const habit = await getHabitByIdInTransaction(txn, habitId);

    if (!habit) {
      throw new Error(`Habit "${habitId}" was not found.`);
    }

    const latestTarget = await getLatestHabitTarget(txn, habitId);

    if (
      latestTarget &&
      canonicalEffectiveFrom < latestTarget.effectiveFrom
    ) {
      throw new Error(
        `HabitTarget effectiveFrom ${canonicalEffectiveFrom} cannot be earlier than latest phase ${latestTarget.effectiveFrom}.`
      );
    }

    const createdAt = targetInput.createdAt ?? new Date().toISOString();
    const target: HabitTarget = {
      ...targetInput,
      id: targetInput.id ?? generateId(),
      habitId,
      effectiveFrom: canonicalEffectiveFrom,
      createdAt,
    };

    await insertHabitTarget(txn, target);
    savedTarget = target;
  });

  if (!savedTarget) {
    throw new Error('HabitTarget phase write did not produce a saved row.');
  }

  return savedTarget;
}

export async function getHabitById(habitId: string): Promise<Habit | null> {
  return getHabitByIdInTransaction(getDb(), habitId);
}

export async function listHabits(userId: string): Promise<Habit[]> {
  const rows = await getDb().getAllAsync<HabitRow>(
    `SELECT ${HABIT_ROW_COLUMNS}
    FROM Habit
    WHERE userId = ?
    ORDER BY displayOrder ASC, name ASC, id ASC`,
    userId
  );

  return rows.map(rowToHabit);
}

async function getHabitByIdInTransaction(
  db: TransactionDb,
  habitId: string
): Promise<Habit | null> {
  const row = await db.getFirstAsync<HabitRow>(
    `SELECT ${HABIT_ROW_COLUMNS}
    FROM Habit
    WHERE id = ?
    LIMIT 1`,
    habitId
  );

  return row ? rowToHabit(row) : null;
}

async function getLatestHabitTarget(
  db: TransactionDb,
  habitId: string
): Promise<HabitTarget | null> {
  const row = await db.getFirstAsync<HabitTargetRow>(
    `SELECT ${HABIT_TARGET_ROW_COLUMNS}
    FROM HabitTarget
    WHERE habitId = ?
    ORDER BY effectiveFrom DESC, createdAt DESC, id DESC
    LIMIT 1`,
    habitId
  );

  return row ? rowToHabitTarget(row) : null;
}

async function insertHabit(db: TransactionDb, habit: Habit): Promise<void> {
  const row = habitToRow(habit);

  await db.runAsync(
    `INSERT INTO Habit (
      id, userId, parentHabitId, name, description, category, color, icon,
      isHidden, trackEffort, startDate, allowMultiplePerDay, displayOrder,
      isPinned, archivedAt, linkedTallyItemId, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    row.createdAt
  );
}

async function insertHabitTarget(
  db: TransactionDb,
  target: HabitTarget
): Promise<void> {
  const row = habitTargetToRow(target);

  await db.runAsync(
    `INSERT INTO HabitTarget (
      id, habitId, frequencyType, timesPerDay, intervalDays, daysOfWeek,
      timesPerWeek, intervalWeeks, timesPerMonth, daysOfMonth, timesPerYear,
      scheduledTime, weekStartDay, habitType, targetValue, targetUnit, directionality,
      streakCompletionThreshold, autoCompleteThreshold, effectiveFrom, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    row.createdAt
  );
}

async function updateHabitRow(
  db: TransactionDb,
  habit: Habit
): Promise<void> {
  const row = habitToRow(habit);

  await db.runAsync(
    `UPDATE Habit SET
      name = ?,
      description = ?,
      category = ?,
      color = ?,
      icon = ?,
      isHidden = ?,
      trackEffort = ?,
      allowMultiplePerDay = ?,
      displayOrder = ?,
      isPinned = ?,
      linkedTallyItemId = ?
    WHERE id = ?`,
    row.name,
    row.description,
    row.category,
    row.color,
    row.icon,
    row.isHidden,
    row.trackEffort,
    row.allowMultiplePerDay,
    row.displayOrder,
    row.isPinned,
    row.linkedTallyItemId,
    row.id
  );
}

function rejectParentHabitId(parentHabitId: string | undefined): void {
  if (parentHabitId !== undefined) {
    throw new Error('Sub-habits are out of scope; parentHabitId is not supported.');
  }
}

function requireHabit(habit: Habit | null, habitId: string): Habit {
  if (!habit) {
    throw new Error(`Habit "${habitId}" was not found after write.`);
  }

  return habit;
}

function validateIsoDate(date: string, label: string): string {
  try {
    const canonicalDate = addDaysToIsoDate(date, 0);

    if (canonicalDate !== date) {
      throw new Error('non-canonical');
    }

    return canonicalDate;
  } catch {
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  }
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(value) as Array<keyof T>) {
    if (value[key] !== undefined) {
      result[key] = value[key];
    }
  }

  return result;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholder) => {
    const random = (Math.random() * 16) | 0;
    const value = placeholder === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
