import { getDb } from './db';
import {
  CARDIO_SCHEDULE_GENERATION_ROW_COLUMNS,
  WORKOUT_SCHEDULE_GENERATION_ROW_COLUMNS,
  rowToCardioScheduleForGeneration,
  rowToScheduleGenerationUserContext,
  rowToWorkoutScheduleForGeneration,
  type CardioScheduleForGeneration,
  type CardioScheduleGenerationRow,
  type ScheduleGenerationUserContextRow,
  type WorkoutScheduleForGeneration,
  type WorkoutScheduleGenerationRow,
} from './mappers/fitnessMapper';
import { WorkoutScheduleFrequency } from '../constants/enums';
import {
  addDaysToIsoDate,
  diffIsoDatesInDays,
  getIsoDateDayOfWeek,
  resolveLogicalDate,
} from '../utils/dateUtils';

export interface GenerateSessionsResult {
  workoutInsertAttempts: number;
  cardioInsertAttempts: number;
}

// v13 only says the window is configurable and gives no persisted preference field yet.
export const DEFAULT_SCHEDULE_GENERATION_LOOK_AHEAD_DAYS = 7;

export async function generateSessions(
  userId: string,
  instant: Date | string
): Promise<GenerateSessionsResult> {
  const db = getDb();
  const userContextRow = await db.getFirstAsync<ScheduleGenerationUserContextRow>(
    `SELECT u.timezone AS timezone, p.dayEndTime AS dayEndTime
    FROM User u
    LEFT JOIN UserPreferences p ON p.userId = u.id
    WHERE u.id = ?
    LIMIT 1`,
    userId
  );

  if (!userContextRow) {
    return { workoutInsertAttempts: 0, cardioInsertAttempts: 0 };
  }

  const userContext = rowToScheduleGenerationUserContext(userContextRow);
  const windowStart = resolveLogicalDate(
    instant,
    userContext.timezone,
    userContext.dayEndTime
  );
  const windowEnd = addDaysToIsoDate(
    windowStart,
    DEFAULT_SCHEDULE_GENERATION_LOOK_AHEAD_DAYS - 1
  );
  const loggedAt = toIsoInstant(instant);

  const [workoutSchedules, cardioSchedules] = await Promise.all([
    loadWorkoutSchedules(userId, windowStart, windowEnd),
    loadCardioSchedules(userId, windowStart, windowEnd),
  ]);

  let workoutInsertAttempts = 0;
  let cardioInsertAttempts = 0;

  for (const schedule of workoutSchedules) {
    for (const slotDate of getScheduleSlots(schedule, windowStart)) {
      workoutInsertAttempts += 1;
      await insertGeneratedWorkoutSession(schedule, slotDate, loggedAt);
    }
  }

  for (const schedule of cardioSchedules) {
    for (const slotDate of getScheduleSlots(schedule, windowStart)) {
      cardioInsertAttempts += 1;
      await insertGeneratedCardioSession(schedule, slotDate, loggedAt);
    }
  }

  return { workoutInsertAttempts, cardioInsertAttempts };
}

async function loadWorkoutSchedules(
  userId: string,
  windowStart: string,
  windowEnd: string
): Promise<WorkoutScheduleForGeneration[]> {
  const rows = await getDb().getAllAsync<WorkoutScheduleGenerationRow>(
    `SELECT ${WORKOUT_SCHEDULE_GENERATION_ROW_COLUMNS}
    FROM WorkoutSchedule s
    JOIN WorkoutTemplate t ON t.id = s.templateId
    WHERE s.userId = ?
      AND s.isActive = 1
      AND s.deletedAt IS NULL
      AND s.startDate <= ?
      AND (s.endDate IS NULL OR s.endDate >= ?)
    ORDER BY s.id ASC`,
    userId,
    windowEnd,
    windowStart
  );

  return rows.map(rowToWorkoutScheduleForGeneration);
}

async function loadCardioSchedules(
  userId: string,
  windowStart: string,
  windowEnd: string
): Promise<CardioScheduleForGeneration[]> {
  const rows = await getDb().getAllAsync<CardioScheduleGenerationRow>(
    `SELECT ${CARDIO_SCHEDULE_GENERATION_ROW_COLUMNS}
    FROM CardioSchedule s
    JOIN CardioTemplate t ON t.id = s.templateId
    WHERE s.userId = ?
      AND s.isActive = 1
      AND s.deletedAt IS NULL
      AND s.startDate <= ?
      AND (s.endDate IS NULL OR s.endDate >= ?)
    ORDER BY s.id ASC`,
    userId,
    windowEnd,
    windowStart
  );

  return rows.map(rowToCardioScheduleForGeneration);
}

function getScheduleSlots(
  schedule: WorkoutScheduleForGeneration | CardioScheduleForGeneration,
  windowStart: string
): string[] {
  const slots: string[] = [];

  for (let offset = 0; offset < DEFAULT_SCHEDULE_GENERATION_LOOK_AHEAD_DAYS; offset += 1) {
    const slotDate = addDaysToIsoDate(windowStart, offset);

    if (slotDate < schedule.startDate) {
      continue;
    }

    if (schedule.endDate && slotDate > schedule.endDate) {
      continue;
    }

    if (isScheduledOnDate(schedule, slotDate)) {
      slots.push(slotDate);
    }
  }

  return slots;
}

function isScheduledOnDate(
  schedule: WorkoutScheduleForGeneration | CardioScheduleForGeneration,
  date: string
): boolean {
  switch (schedule.frequencyType) {
    case WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK:
      return isScheduledDayOfWeek(schedule.daysOfWeek, date);

    case WorkoutScheduleFrequency.EVERY_N_DAYS:
      return matchesEveryNDays(schedule, date);

    case WorkoutScheduleFrequency.EVERY_N_WEEKS:
      return matchesEveryNWeeks(schedule, date);
  }
}

function isScheduledDayOfWeek(
  daysOfWeek: readonly number[] | undefined,
  date: string
): boolean {
  return Boolean(daysOfWeek?.includes(getIsoDateDayOfWeek(date)));
}

function matchesEveryNDays(
  schedule: WorkoutScheduleForGeneration | CardioScheduleForGeneration,
  date: string
): boolean {
  if (!isPositiveInteger(schedule.intervalDays)) {
    return false;
  }

  return diffIsoDatesInDays(schedule.startDate, date) % schedule.intervalDays === 0;
}

function matchesEveryNWeeks(
  schedule: WorkoutScheduleForGeneration | CardioScheduleForGeneration,
  date: string
): boolean {
  if (!isPositiveInteger(schedule.intervalWeeks)) {
    return false;
  }

  const scheduledDays =
    schedule.daysOfWeek && schedule.daysOfWeek.length > 0
      ? schedule.daysOfWeek
      : [getIsoDateDayOfWeek(schedule.startDate)];

  if (!scheduledDays.includes(getIsoDateDayOfWeek(date))) {
    return false;
  }

  const elapsedWeeks = Math.floor(diffIsoDatesInDays(schedule.startDate, date) / 7);
  return elapsedWeeks % schedule.intervalWeeks === 0;
}

async function insertGeneratedWorkoutSession(
  schedule: WorkoutScheduleForGeneration,
  slotDate: string,
  loggedAt: string
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR IGNORE INTO WorkoutSession (
      id, userId, templateId, scheduleId, generatedForDate, name,
      templateNameSnapshot, status, scheduledDate, scheduledTime, loggedAt,
      isRetroactive, durationOverridden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    generateId(),
    schedule.userId,
    schedule.templateId,
    schedule.id,
    slotDate,
    schedule.name ?? null,
    schedule.templateName ?? null,
    'planned',
    slotDate,
    schedule.scheduledTime ?? null,
    loggedAt,
    0,
    0
  );
}

async function insertGeneratedCardioSession(
  schedule: CardioScheduleForGeneration,
  slotDate: string,
  loggedAt: string
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR IGNORE INTO CardioSession (
      id, userId, templateId, scheduleId, generatedForDate,
      templateNameSnapshot, type, subtype, sportName, status, scheduledDate,
      scheduledTime, loggedAt, isRetroactive, durationOverridden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    generateId(),
    schedule.userId,
    schedule.templateId,
    schedule.id,
    slotDate,
    schedule.templateName ?? null,
    schedule.templateType,
    schedule.templateSubtype ?? null,
    null,
    'planned',
    slotDate,
    schedule.scheduledTime ?? null,
    loggedAt,
    0,
    0
  );
}

function isPositiveInteger(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function toIsoInstant(instant: Date | string): string {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);

  if (Number.isNaN(date.getTime())) {
    throw new Error('instant must be a valid Date or ISO string.');
  }

  return date.toISOString();
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
