import dayjs from 'dayjs';
import { getDb } from './db';
import { clearLog, completeBinary, setMeasurableValue } from './habitLogService';
import { getHabitById, listHabits } from './habitService';
import { resolveTargets } from './habitTargetService';
import {
  HABIT_LOG_ROW_COLUMNS,
  rowToHabitLog,
  type HabitLogRow,
} from './mappers/habitLogMapper';
import { useUserStore } from '../store/userStore';
import {
  formatTodayDateLabels,
  getTodayHabitCompletionSummary,
  getVisibleTodayQuickActions,
  sortTodayHabitItems,
} from '../utils/todaySelectors';
import {
  addDaysToIsoDate,
  currentLogicalDate as getCurrentLogicalDate,
  resolveLogicalDate,
} from '../utils/dateUtils';
import type { Habit, HabitLog, HabitTarget, UserPreferences } from '../types/schema';
import type {
  TodayFitnessItem,
  TodayFitnessKind,
  TodayFitnessStatus,
  TodayHabitItem,
  TodayHabitStatus,
  TodayHabitType,
  TodayViewModel,
} from '../types/today';

interface GetTodayViewModelParams {
  selectedDate?: dayjs.ConfigType;
  currentDate?: Date | string;
  userId?: string | null;
  preferences?: UserPreferences | null;
}

export type TodayFitnessSessionActionFailureReason =
  | 'not_found'
  | 'invalid_status'
  | 'destination_conflict';

export type TodayFitnessSessionActionResult =
  | {
      ok: true;
      kind: TodayFitnessKind;
      sessionId: string;
      destinationDate?: string;
    }
  | {
      ok: false;
      kind: TodayFitnessKind;
      sessionId: string;
      reason: TodayFitnessSessionActionFailureReason;
      message: string;
      destinationDate?: string;
    };

export type TodayHabitActionFailureReason =
  | 'not_found'
  | 'invalid_value';

export type TodayHabitLogActionResult =
  | {
      ok: true;
      log: HabitLog;
    }
  | {
      ok: false;
      reason: TodayHabitActionFailureReason;
      message: string;
    };

export type TodayHabitUndoActionResult =
  | { ok: true; logId: string }
  | {
      ok: false;
      reason: TodayHabitActionFailureReason;
      message: string;
    };

interface WorkoutSessionRow {
  id: string;
  templateId: string | null;
  scheduleId: string | null;
  name: string | null;
  templateNameSnapshot: string | null;
  status: TodayFitnessStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface CardioSessionRow {
  id: string;
  templateId: string | null;
  scheduleId: string | null;
  templateNameSnapshot: string | null;
  type: string;
  subtype: string | null;
  sportName: string | null;
  status: TodayFitnessStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cardioDate: string | null;
}

interface ActionSessionRow {
  id: string;
  status: TodayFitnessStatus;
  templateId: string | null;
  name?: string | null;
}

interface FitnessTableConfig {
  tableName: 'WorkoutSession' | 'CardioSession';
  nameColumn?: 'name';
}

const FITNESS_TABLE_BY_KIND: Record<TodayFitnessKind, FitnessTableConfig> = {
  workout: { tableName: 'WorkoutSession', nameColumn: 'name' },
  cardio: { tableName: 'CardioSession' },
};

const ACTIONABLE_SESSION_STATUSES: readonly TodayFitnessStatus[] = ['planned', 'skipped'];

export async function getTodayViewModel(
  params: GetTodayViewModelParams = {}
): Promise<TodayViewModel> {
  const userState = useUserStore.getState();
  const preferences = params.preferences ?? userState.preferences;
  const dayEndTime = preferences?.dayEndTime ?? '00:00';
  const timezone = userState.timezone;
  const selectedDate = resolveSelectedLogicalDate(
    params.selectedDate,
    params.currentDate,
    timezone,
    dayEndTime
  );
  const selectedCurrentLogicalDate = resolveCurrentLogicalDate(
    params.currentDate,
    timezone,
    dayEndTime
  );
  const userId = params.userId ?? userState.userId;
  const habitItems = userId
    ? await loadPersistedHabitItems(userId, selectedDate, selectedCurrentLogicalDate)
    : [];
  const sortedHabitItems = sortTodayHabitItems(habitItems);
  const habitSummary = getTodayHabitCompletionSummary(sortedHabitItems);
  const fitnessItems = userId ? await loadPersistedFitnessItems(userId, selectedDate) : [];
  const labels = formatTodayDateLabels(selectedDate, {
    currentDate: params.currentDate,
    dayEndTime,
    timezone,
  });

  return {
    selectedDate,
    title: labels.title,
    subtitle: labels.subtitle,
    fitnessItems,
    habitItems: sortedHabitItems,
    completedHabitCount: habitSummary.completedHabitCount,
    totalVisibleHabitCount: habitSummary.totalVisibleHabitCount,
    quickActions: getVisibleTodayQuickActions(preferences?.modulesEnabled),
  };
}

export async function skipTodayFitnessSession(
  kind: TodayFitnessKind,
  sessionId: string
): Promise<TodayFitnessSessionActionResult> {
  const config = FITNESS_TABLE_BY_KIND[kind];
  const session = await getActionSession(config, sessionId);

  if (!session) {
    return actionFailure(kind, sessionId, 'not_found', 'Fitness session was not found.');
  }

  if (!isActionableSessionStatus(session.status)) {
    return actionFailure(
      kind,
      sessionId,
      'invalid_status',
      'Only planned or skipped sessions can be skipped.'
    );
  }

  await getDb().runAsync(
    `UPDATE ${config.tableName} SET status = 'skipped' WHERE id = ?`,
    sessionId
  );

  return { ok: true, kind, sessionId };
}

export async function moveTodayFitnessSessionToTomorrow(
  kind: TodayFitnessKind,
  sessionId: string,
  selectedDate: dayjs.ConfigType
): Promise<TodayFitnessSessionActionResult> {
  const config = FITNESS_TABLE_BY_KIND[kind];
  const session = await getActionSession(config, sessionId);
  const selectedLogicalDate = normalizeSelectedDate(selectedDate);
  const destinationDate = addDaysToIsoDate(selectedLogicalDate, 1);

  if (!session) {
    return actionFailure(
      kind,
      sessionId,
      'not_found',
      'Fitness session was not found.',
      destinationDate
    );
  }

  if (!isActionableSessionStatus(session.status)) {
    return actionFailure(
      kind,
      sessionId,
      'invalid_status',
      'Only planned or skipped sessions can be moved.',
      destinationDate
    );
  }

  if (await hasDestinationRoutineConflict(config, session, destinationDate)) {
    return actionFailure(
      kind,
      sessionId,
      'destination_conflict',
      'Destination date already has this routine.',
      destinationDate
    );
  }

  await getDb().runAsync(
    `UPDATE ${config.tableName} SET scheduledDate = ? WHERE id = ?`,
    destinationDate,
    sessionId
  );

  return { ok: true, kind, sessionId, destinationDate };
}

export async function completeTodayHabit(
  habitId: string,
  selectedDate: dayjs.ConfigType,
  instant: Date | string = new Date()
): Promise<TodayHabitLogActionResult> {
  const habit = await getHabitById(habitId);

  if (!habit || habit.isHidden || habit.archivedAt) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Habit was not found.',
    };
  }

  const date = dayjs(selectedDate).startOf('day').format('YYYY-MM-DD');

  try {
    const log = await completeBinary(habitId, date, toActionInstant(instant));
    return { ok: true, log };
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid_value',
      message: getErrorMessage(error, 'Habit could not be completed.'),
    };
  }
}

export async function saveTodayHabitValue(
  habitId: string,
  selectedDate: dayjs.ConfigType,
  value: number,
  instant: Date | string = new Date()
): Promise<TodayHabitLogActionResult> {
  if (!Number.isFinite(value) || value < 0) {
    return {
      ok: false,
      reason: 'invalid_value',
      message: 'Enter a valid value.',
    };
  }

  const habit = await getHabitById(habitId);

  if (!habit || habit.isHidden || habit.archivedAt) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Habit was not found.',
    };
  }

  const date = dayjs(selectedDate).startOf('day').format('YYYY-MM-DD');

  try {
    const log = await setMeasurableValue(habitId, date, toActionInstant(instant), value);
    return { ok: true, log };
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid_value',
      message: getErrorMessage(error, 'Habit value could not be saved.'),
    };
  }
}

export async function undoTodayHabitCompletion(
  logId: string,
  instant: Date | string = new Date()
): Promise<TodayHabitUndoActionResult> {
  const log = await getHabitLogById(logId);

  if (!log) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Habit log was not found.',
    };
  }

  const habit = await getHabitById(log.habitId);

  if (!habit || habit.isHidden || habit.archivedAt) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Habit was not found.',
    };
  }

  try {
    await clearLog(log.habitId, log.date, toActionInstant(instant));
  } catch (error) {
    return {
      ok: false,
      reason: 'not_found',
      message: getErrorMessage(error, 'Habit log could not be cleared.'),
    };
  }

  return { ok: true, logId };
}

function resolveSelectedLogicalDate(
  selectedDate: dayjs.ConfigType | undefined,
  currentDate: Date | string | undefined,
  timezone: string,
  dayEndTime: string
): string {
  if (selectedDate !== undefined && selectedDate !== null) {
    return normalizeSelectedDate(selectedDate);
  }

  return resolveCurrentLogicalDate(currentDate, timezone, dayEndTime);
}

function resolveCurrentLogicalDate(
  currentDate: Date | string | undefined,
  timezone: string,
  dayEndTime: string
): string {
  return currentDate === undefined
    ? getCurrentLogicalDate(timezone, dayEndTime)
    : resolveLogicalDate(currentDate, timezone, dayEndTime);
}

function normalizeSelectedDate(selectedDate: dayjs.ConfigType): string {
  return dayjs(selectedDate).startOf('day').format('YYYY-MM-DD');
}

async function loadPersistedHabitItems(
  userId: string,
  selectedDate: string,
  currentLogicalDate: string
): Promise<TodayHabitItem[]> {
  const visibleHabits = (await listHabits(userId)).filter(
    (habit) => !habit.isHidden && !habit.archivedAt
  );
  const habitIds = visibleHabits.map((habit) => habit.id);
  const [targetsByHabitId, logsByHabitId, completedLogs] = await Promise.all([
    resolveTargets(habitIds, selectedDate),
    loadSelectedHabitLogsByHabitId(habitIds, selectedDate),
    loadCompletedHabitLogsThroughDate(habitIds, selectedDate),
  ]);
  const logsByHabitDate = getHabitLogsByHabitDate(completedLogs);

  return visibleHabits.flatMap((habit) => {
    const target = targetsByHabitId.get(habit.id);

    if (!target) {
      return [];
    }

    return [
      mapHabitToTodayItem(
        habit,
        logsByHabitId.get(habit.id),
        target,
        logsByHabitDate,
        selectedDate,
        currentLogicalDate
      ),
    ];
  });
}

function mapHabitToTodayItem(
  habit: Habit,
  log: HabitLog | undefined,
  target: HabitTarget,
  logsByHabitDate: Map<string, HabitLog>,
  selectedDate: string,
  currentLogicalDate: string
): TodayHabitItem {
  const habitType: TodayHabitType = target.habitType;

  return {
    id: log?.id ?? habit.id,
    habitId: habit.id,
    title: habit.name,
    subtitle: habit.description,
    status: getHabitStatus(log, selectedDate, currentLogicalDate),
    habitType,
    displayOrder: habit.displayOrder,
    scheduledTime: target.scheduledTime,
    completedAt: log?.completedAt,
    value: log?.value,
    targetValue: target.targetValue,
    targetUnit: target.targetUnit,
    streakCount: getHabitStreakCount(habit.id, selectedDate, log, logsByHabitDate),
  };
}

function getHabitStatus(
  log: HabitLog | undefined,
  selectedDate: string,
  currentLogicalDate: string
): TodayHabitStatus {
  if (log?.completed) return 'completed';
  return dayjs(selectedDate).isBefore(dayjs(currentLogicalDate), 'day') ? 'missed' : 'pending';
}

async function loadPersistedFitnessItems(
  userId: string,
  selectedDate: string
): Promise<TodayFitnessItem[]> {
  // TODO: Run workout/cardio schedule generation before this query once that app-open
  // service exists. This only reads already-persisted sessions.
  const [workoutItems, cardioItems] = await Promise.all([
    loadWorkoutFitnessItems(userId, selectedDate),
    loadCardioFitnessItems(userId, selectedDate),
  ]);

  return [...workoutItems, ...cardioItems].sort(compareFitnessItems);
}

async function loadSelectedHabitLogsByHabitId(
  habitIds: string[],
  selectedDate: string
): Promise<Map<string, HabitLog>> {
  if (habitIds.length === 0) {
    return new Map();
  }

  const placeholders = habitIds.map(() => '?').join(', ');
  const rows = await getDb().getAllAsync<HabitLogRow>(
    `SELECT ${HABIT_LOG_ROW_COLUMNS}
    FROM HabitLog
    WHERE habitId IN (${placeholders})
      AND date = ?`,
    ...habitIds,
    selectedDate
  );

  return new Map(rows.map((row) => {
    const log = rowToHabitLog(row);
    return [log.habitId, log];
  }));
}

async function loadCompletedHabitLogsThroughDate(
  habitIds: string[],
  selectedDate: string
): Promise<HabitLog[]> {
  if (habitIds.length === 0) {
    return [];
  }

  const placeholders = habitIds.map(() => '?').join(', ');
  const rows = await getDb().getAllAsync<HabitLogRow>(
    `SELECT ${HABIT_LOG_ROW_COLUMNS}
    FROM HabitLog
    WHERE habitId IN (${placeholders})
      AND date <= ?
      AND completed = 1
    ORDER BY habitId ASC, date DESC`,
    ...habitIds,
    selectedDate
  );

  return rows.map(rowToHabitLog);
}

async function getHabitLogById(logId: string): Promise<HabitLog | null> {
  const row = await getDb().getFirstAsync<HabitLogRow>(
    `SELECT ${HABIT_LOG_ROW_COLUMNS}
    FROM HabitLog
    WHERE id = ?
    LIMIT 1`,
    logId
  );

  return row ? rowToHabitLog(row) : null;
}

async function loadWorkoutFitnessItems(
  userId: string,
  selectedDate: string
): Promise<TodayFitnessItem[]> {
  const rows = await getDb().getAllAsync<WorkoutSessionRow>(
    `SELECT
      id, templateId, scheduleId, name, templateNameSnapshot, status,
      scheduledDate, scheduledTime, startedAt, completedAt
    FROM WorkoutSession
    WHERE userId = ?
      AND status IN ('planned', 'live', 'completed', 'skipped')
      AND (
        scheduledDate = ?
        OR workoutDate = ?
        OR date(startedAt) = ?
        OR date(completedAt) = ?
      )
    ORDER BY scheduledTime IS NULL, scheduledTime, loggedAt`,
    userId,
    selectedDate,
    selectedDate,
    selectedDate,
    selectedDate
  );

  return rows.map((row) => ({
    id: row.id,
    kind: 'workout',
    status: row.status,
    title: row.name ?? row.templateNameSnapshot ?? 'Workout',
    scheduledDate: row.scheduledDate ?? undefined,
    scheduledTime: row.scheduledTime ?? undefined,
    templateId: row.templateId ?? undefined,
    scheduleId: row.scheduleId ?? undefined,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
  }));
}

async function loadCardioFitnessItems(
  userId: string,
  selectedDate: string
): Promise<TodayFitnessItem[]> {
  const rows = await getDb().getAllAsync<CardioSessionRow>(
    `SELECT
      id, templateId, scheduleId, templateNameSnapshot, type, subtype,
      sportName, status, scheduledDate, scheduledTime, startedAt, completedAt,
      cardioDate
    FROM CardioSession
    WHERE userId = ?
      AND status IN ('planned', 'live', 'completed', 'skipped')
      AND (
        scheduledDate = ?
        OR cardioDate = ?
        OR date(startedAt) = ?
        OR date(completedAt) = ?
      )
    ORDER BY scheduledTime IS NULL, scheduledTime, loggedAt`,
    userId,
    selectedDate,
    selectedDate,
    selectedDate,
    selectedDate
  );

  return rows.map((row) => ({
    id: row.id,
    kind: 'cardio',
    status: row.status,
    title: row.templateNameSnapshot ?? row.sportName ?? formatCardioTitle(row.type, row.subtype),
    scheduledDate: row.scheduledDate ?? undefined,
    scheduledTime: row.scheduledTime ?? undefined,
    templateId: row.templateId ?? undefined,
    scheduleId: row.scheduleId ?? undefined,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
  }));
}

async function getActionSession(
  config: FitnessTableConfig,
  sessionId: string
): Promise<ActionSessionRow | null> {
  const columns = config.nameColumn
    ? 'id, status, templateId, name'
    : 'id, status, templateId';

  return getDb().getFirstAsync<ActionSessionRow>(
    `SELECT ${columns} FROM ${config.tableName} WHERE id = ?`,
    sessionId
  );
}

async function hasDestinationRoutineConflict(
  config: FitnessTableConfig,
  session: ActionSessionRow,
  destinationDate: string
): Promise<boolean> {
  if (session.templateId) {
    const conflict = await getDb().getFirstAsync<{ id: string }>(
      `SELECT id FROM ${config.tableName}
      WHERE id != ? AND scheduledDate = ? AND templateId = ?
      LIMIT 1`,
      session.id,
      destinationDate,
      session.templateId
    );
    return Boolean(conflict);
  }

  if (config.nameColumn && session.name) {
    const conflict = await getDb().getFirstAsync<{ id: string }>(
      `SELECT id FROM ${config.tableName}
      WHERE id != ? AND scheduledDate = ? AND templateId IS NULL AND name = ?
      LIMIT 1`,
      session.id,
      destinationDate,
      session.name
    );
    return Boolean(conflict);
  }

  return false;
}

function isActionableSessionStatus(status: TodayFitnessStatus): boolean {
  return ACTIONABLE_SESSION_STATUSES.includes(status);
}

function actionFailure(
  kind: TodayFitnessKind,
  sessionId: string,
  reason: TodayFitnessSessionActionFailureReason,
  message: string,
  destinationDate?: string
): TodayFitnessSessionActionResult {
  return { ok: false, kind, sessionId, reason, message, destinationDate };
}

function compareFitnessItems(a: TodayFitnessItem, b: TodayFitnessItem): number {
  const timeCompare = compareNullableStrings(a.scheduledTime, b.scheduledTime);
  if (timeCompare !== 0) return timeCompare;
  return a.title.localeCompare(b.title);
}

function compareNullableStrings(a?: string, b?: string): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a.localeCompare(b);
}

function formatCardioTitle(type: string, subtype: string | null): string {
  const primary = type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return subtype ? `${primary} · ${subtype}` : primary;
}

function getHabitLogsByHabitDate(logs: readonly HabitLog[]): Map<string, HabitLog> {
  return logs.reduce<Map<string, HabitLog>>((logsByHabitDate, log) => {
    logsByHabitDate.set(getHabitDateKey(log.habitId, log.date), log);
    return logsByHabitDate;
  }, new Map());
}

function getHabitStreakCount(
  habitId: string,
  selectedDate: string,
  selectedLog: HabitLog | undefined,
  logsByHabitDate: Map<string, HabitLog>
): number {
  let cursor = dayjs(selectedDate).startOf('day');

  if (!selectedLog?.completed) {
    cursor = cursor.subtract(1, 'day');
  }

  let streakCount = 0;

  while (streakCount < 3660) {
    const log = logsByHabitDate.get(getHabitDateKey(habitId, cursor.format('YYYY-MM-DD')));

    if (!log?.completed) break;

    streakCount += 1;
    cursor = cursor.subtract(1, 'day');
  }

  return streakCount;
}

function getHabitDateKey(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}

function toActionInstant(instant: Date | string): Date {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);

  if (Number.isNaN(date.getTime())) {
    throw new Error('instant must be a valid Date or ISO string.');
  }

  return date;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
