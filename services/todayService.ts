import dayjs from 'dayjs';
import { getDb } from './db';
import { useHabitStore } from '../store/habitStore';
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
  const habitItems = getStoreBackedHabitItems(selectedDate, selectedCurrentLogicalDate);
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

export function completeTodayHabit(
  habitId: string,
  selectedDate: dayjs.ConfigType,
  completedAt = new Date().toISOString()
): TodayHabitLogActionResult {
  const state = useHabitStore.getState();
  const habit = state.habits.find((candidate) => candidate.id === habitId);

  if (!habit || habit.isHidden || habit.archivedAt) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Habit was not found.',
    };
  }

  const date = dayjs(selectedDate).startOf('day').format('YYYY-MM-DD');
  const existingLog = findHabitLogForDate(state.todayLogs, habitId, date);
  const log: HabitLog = {
    id: existingLog?.id ?? generateId(),
    habitId,
    userId: habit.userId,
    date,
    completed: true,
    value: existingLog?.value,
    effortRating: existingLog?.effortRating,
    note: existingLog?.note,
    completedAt,
  };

  state.upsertLog(log);

  return { ok: true, log };
}

export function saveTodayHabitValue(
  habitId: string,
  selectedDate: dayjs.ConfigType,
  value: number,
  completedAt = new Date().toISOString()
): TodayHabitLogActionResult {
  if (!Number.isFinite(value) || value < 0) {
    return {
      ok: false,
      reason: 'invalid_value',
      message: 'Enter a valid value.',
    };
  }

  const state = useHabitStore.getState();
  const habit = state.habits.find((candidate) => candidate.id === habitId);

  if (!habit || habit.isHidden || habit.archivedAt) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Habit was not found.',
    };
  }

  const date = dayjs(selectedDate).startOf('day').format('YYYY-MM-DD');
  const target = getEffectiveHabitTarget(state.habitTargets, habitId, date);
  const existingLog = findHabitLogForDate(state.todayLogs, habitId, date);
  const completed = isHabitValueComplete(value, target);
  const log: HabitLog = {
    id: existingLog?.id ?? generateId(),
    habitId,
    userId: habit.userId,
    date,
    completed,
    value,
    effortRating: existingLog?.effortRating,
    note: existingLog?.note,
    completedAt: completed ? existingLog?.completedAt ?? completedAt : undefined,
  };

  state.upsertLog(log);

  return { ok: true, log };
}

export function undoTodayHabitCompletion(logId: string): TodayHabitUndoActionResult {
  const state = useHabitStore.getState();
  const log = state.todayLogs.find((candidate) => candidate.id === logId);

  if (!log) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Habit log was not found.',
    };
  }

  state.removeLog(logId);

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

function getStoreBackedHabitItems(
  selectedDate: string,
  currentLogicalDate: string
): TodayHabitItem[] {
  const { habits, todayLogs, habitTargets } = useHabitStore.getState();
  const logsByHabitId = new Map(
    todayLogs
      .filter((log) => log.date === selectedDate)
      .map((log) => [log.habitId, log])
  );
  const effectiveTargetsByHabitId = getEffectiveHabitTargetsByHabitId(
    habitTargets,
    selectedDate
  );
  const logsByHabitDate = getHabitLogsByHabitDate(todayLogs);

  // TODO: Replace this store-backed read with persisted Habit + HabitTarget
  // queries once the habit service layer exists.
  return habits
    .filter((habit) => !habit.isHidden && !habit.archivedAt)
    .map((habit) =>
      mapHabitToTodayItem(
        habit,
        logsByHabitId.get(habit.id),
        effectiveTargetsByHabitId.get(habit.id),
        logsByHabitDate,
        selectedDate,
        currentLogicalDate
      )
    );
}

function mapHabitToTodayItem(
  habit: Habit,
  log: HabitLog | undefined,
  target: HabitTarget | undefined,
  logsByHabitDate: Map<string, HabitLog>,
  selectedDate: string,
  currentLogicalDate: string
): TodayHabitItem {
  const habitType: TodayHabitType = target?.habitType ?? 'binary';

  return {
    id: log?.id ?? habit.id,
    habitId: habit.id,
    title: habit.name,
    subtitle: habit.description,
    status: getHabitStatus(log, selectedDate, currentLogicalDate),
    habitType,
    displayOrder: habit.displayOrder,
    scheduledTime: target?.scheduledTime,
    completedAt: log?.completedAt,
    value: log?.value,
    targetValue: target?.targetValue,
    targetUnit: target?.targetUnit,
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

function findHabitLogForDate(
  logs: readonly HabitLog[],
  habitId: string,
  date: string
): HabitLog | undefined {
  return logs.find((log) => log.habitId === habitId && log.date === date);
}

function getEffectiveHabitTargetsByHabitId(
  targets: readonly HabitTarget[],
  selectedDate: string
): Map<string, HabitTarget> {
  return targets.reduce<Map<string, HabitTarget>>((targetsByHabitId, target) => {
    const current = targetsByHabitId.get(target.habitId);

    if (dayjs(target.effectiveFrom).isAfter(selectedDate, 'day')) {
      return targetsByHabitId;
    }

    if (!current || compareHabitTargetRecency(target, current) > 0) {
      targetsByHabitId.set(target.habitId, target);
    }

    return targetsByHabitId;
  }, new Map());
}

function getEffectiveHabitTarget(
  targets: readonly HabitTarget[],
  habitId: string,
  selectedDate: string
): HabitTarget | undefined {
  return getEffectiveHabitTargetsByHabitId(
    targets.filter((target) => target.habitId === habitId),
    selectedDate
  ).get(habitId);
}

function compareHabitTargetRecency(a: HabitTarget, b: HabitTarget): number {
  const effectiveCompare = a.effectiveFrom.localeCompare(b.effectiveFrom);
  if (effectiveCompare !== 0) return effectiveCompare;
  return a.createdAt.localeCompare(b.createdAt);
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

function isHabitValueComplete(value: number, target: HabitTarget | undefined): boolean {
  if (target?.targetValue === undefined) {
    return value > 0;
  }

  if (target.directionality === 'at_most') {
    return value <= target.targetValue;
  }

  return value >= target.targetValue;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (placeholder) => {
    const random = (Math.random() * 16) | 0;
    const value = placeholder === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
