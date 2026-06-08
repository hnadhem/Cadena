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
import { getEffectiveDate } from '../utils/dateUtils';
import type { Habit, HabitLog, UserPreferences } from '../types/schema';
import type {
  TodayFitnessItem,
  TodayFitnessKind,
  TodayFitnessStatus,
  TodayHabitItem,
  TodayHabitStatus,
  TodayViewModel,
} from '../types/today';

interface GetTodayViewModelParams {
  selectedDate?: dayjs.ConfigType;
  currentDate?: dayjs.ConfigType;
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
  const selectedDate = resolveSelectedLogicalDate(
    params.selectedDate,
    params.currentDate,
    dayEndTime
  );
  const currentLogicalDate = getEffectiveDate(params.currentDate ?? new Date(), dayEndTime).format(
    'YYYY-MM-DD'
  );
  const userId = params.userId ?? userState.userId;
  const habitItems = getStoreBackedHabitItems(selectedDate, currentLogicalDate);
  const sortedHabitItems = sortTodayHabitItems(habitItems);
  const habitSummary = getTodayHabitCompletionSummary(sortedHabitItems);
  const fitnessItems = userId ? await loadPersistedFitnessItems(userId, selectedDate) : [];
  const labels = formatTodayDateLabels(selectedDate, {
    currentDate: params.currentDate,
    dayEndTime,
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
  const destinationDate = dayjs(selectedDate).startOf('day').add(1, 'day').format('YYYY-MM-DD');

  if (!session) {
    return actionFailure(kind, sessionId, 'not_found', 'Fitness session was not found.', destinationDate);
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

function resolveSelectedLogicalDate(
  selectedDate: dayjs.ConfigType | undefined,
  currentDate: dayjs.ConfigType | undefined,
  dayEndTime: string
): string {
  if (selectedDate !== undefined) {
    return dayjs(selectedDate).startOf('day').format('YYYY-MM-DD');
  }

  // TODO: Apply User.timezone once user records are loaded into app state.
  return getEffectiveDate(currentDate ?? new Date(), dayEndTime).format('YYYY-MM-DD');
}

function getStoreBackedHabitItems(
  selectedDate: string,
  currentLogicalDate: string
): TodayHabitItem[] {
  const { habits, todayLogs } = useHabitStore.getState();
  const logsByHabitId = new Map(
    todayLogs
      .filter((log) => log.date === selectedDate)
      .map((log) => [log.habitId, log])
  );

  // TODO: Replace this with persisted Habit + HabitTarget queries once the habit
  // service layer exists, so scheduledTime and measurable targets are available.
  return habits
    .filter((habit) => !habit.isHidden && !habit.archivedAt)
    .map((habit) =>
      mapHabitToTodayItem(habit, logsByHabitId.get(habit.id), selectedDate, currentLogicalDate)
    );
}

function mapHabitToTodayItem(
  habit: Habit,
  log: HabitLog | undefined,
  selectedDate: string,
  currentLogicalDate: string
): TodayHabitItem {
  return {
    id: log?.id ?? habit.id,
    habitId: habit.id,
    title: habit.name,
    subtitle: habit.description,
    status: getHabitStatus(log, selectedDate, currentLogicalDate),
    displayOrder: habit.displayOrder,
    completedAt: log?.completedAt,
    value: log?.value,
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
