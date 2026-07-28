import type * as SQLite from 'expo-sqlite';
import type { DailyLog } from '../types/schema';
import {
  normalizeTodayCheckInEntry,
  validateTodayCheckInDraft,
  type TodayCheckInDraft,
  type TodayCheckInEntry,
} from '../utils/todayCheckIn';
import { addDaysToIsoDate } from '../utils/dateUtils';
import { getDb } from './db';
import {
  DAILY_LOG_ROW_COLUMNS,
  dailyLogToRow,
  rowToDailyLog,
  type DailyLogRow,
} from './mappers/dailyLogMapper';

type DailyLogDb = Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

export type SaveTodayCheckInResult =
  | { ok: true; entry: TodayCheckInEntry }
  | { ok: false; error: string };

export async function getDailyLog(
  userId: string,
  date: string
): Promise<DailyLog | null> {
  return getDailyLogFromDb(getDb(), userId, validateDailyLogDate(date));
}

export async function getTodayCheckIn(
  userId: string,
  date: string
): Promise<TodayCheckInEntry | null> {
  const log = await getDailyLog(userId, date);
  return log ? dailyLogToTodayCheckInEntry(log) : null;
}

export async function saveTodayCheckIn(
  userId: string,
  date: string,
  draft: TodayCheckInDraft,
  instant: Date | string = new Date()
): Promise<SaveTodayCheckInResult> {
  const validation = validateTodayCheckInDraft(draft);

  if (!validation.ok) {
    return validation;
  }

  const entry = normalizeTodayCheckInEntry(validateDailyLogDate(date), draft);
  const instantIso = toIsoInstant(instant);
  const savedLog = await upsertCheckIn(userId, entry, instantIso);

  return {
    ok: true,
    entry: dailyLogToTodayCheckInEntry(savedLog),
  };
}

async function getDailyLogFromDb(
  db: DailyLogDb,
  userId: string,
  date: string
): Promise<DailyLog | null> {
  const row = await db.getFirstAsync<DailyLogRow>(
    `SELECT ${DAILY_LOG_ROW_COLUMNS}
    FROM DailyLog
    WHERE userId = ?
      AND date = ?
    LIMIT 1`,
    userId,
    date
  );

  return row ? rowToDailyLog(row) : null;
}

async function upsertCheckIn(
  userId: string,
  entry: TodayCheckInEntry,
  instantIso: string
): Promise<DailyLog> {
  const db = getDb();
  let savedLog: DailyLog | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const existingLog = await getDailyLogFromDb(txn, userId, entry.date);

    if (existingLog) {
      savedLog = {
        ...existingLog,
        mood: entry.mood,
        note: entry.note,
        tags: entry.tags,
        updatedAt: instantIso,
      };
      await updateDailyLogCheckIn(txn, savedLog);
      return;
    }

    savedLog = {
      id: generateId(),
      userId,
      date: entry.date,
      mood: entry.mood,
      note: entry.note,
      tags: entry.tags,
      createdAt: instantIso,
      updatedAt: instantIso,
    };
    await insertDailyLog(txn, savedLog);
  });

  return requireSavedLog(savedLog);
}

async function insertDailyLog(db: DailyLogDb, log: DailyLog): Promise<void> {
  const row = dailyLogToRow(log);

  await db.runAsync(
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

async function updateDailyLogCheckIn(
  db: DailyLogDb,
  log: DailyLog
): Promise<void> {
  const row = dailyLogToRow(log);

  await db.runAsync(
    `UPDATE DailyLog
    SET mood = ?,
      note = ?,
      tags = ?,
      updatedAt = ?
    WHERE id = ?`,
    row.mood,
    row.note,
    row.tags,
    row.updatedAt,
    row.id
  );
}

function dailyLogToTodayCheckInEntry(log: DailyLog): TodayCheckInEntry {
  return {
    date: log.date,
    ...(log.mood !== undefined ? { mood: log.mood } : {}),
    ...(log.note !== undefined ? { note: log.note } : {}),
    ...(log.tags !== undefined ? { tags: log.tags } : {}),
  };
}

function validateDailyLogDate(date: string): string {
  try {
    const canonicalDate = addDaysToIsoDate(date, 0);

    if (canonicalDate === date) {
      return canonicalDate;
    }
  } catch {
    // Use one service-level message for all invalid date inputs.
  }

  throw new Error('DailyLog date must be a valid YYYY-MM-DD date.');
}

function toIsoInstant(instant: Date | string): string {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);

  if (Number.isNaN(date.getTime())) {
    throw new Error('instant must be a valid Date or ISO string.');
  }

  return date.toISOString();
}

function requireSavedLog(log: DailyLog | null): DailyLog {
  if (!log) {
    throw new Error('DailyLog check-in write did not produce a saved row.');
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
