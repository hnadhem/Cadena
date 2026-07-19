import type * as SQLite from 'expo-sqlite';
import { LoadType, SetDescriptor, SetType } from '../constants/enums';
import type { ExerciseConfig, ExerciseLog, SetLog, WorkoutSession } from '../types/schema';
import { resolveLogicalDate } from '../utils/dateUtils';
import { getDb } from './db';
import {
  EXERCISE_LOG_ROW_COLUMNS,
  EXERCISE_SNAPSHOT_ROW_COLUMNS,
  SET_LOG_ROW_COLUMNS,
  WORKOUT_SESSION_ROW_COLUMNS,
  rowToExerciseLog,
  rowToExerciseLogSnapshot,
  rowToSetLog,
  rowToWorkoutSession,
  rowToWorkoutTemplateExerciseConfigs,
  type ExerciseLogRow,
  type ExerciseLogSnapshot,
  type ExerciseSnapshotRow,
  type SetLogRow,
  type WorkoutSessionRow,
  type WorkoutTemplateExerciseConfigsRow,
} from './mappers/fitnessMapper';

export const MAX_WORKOUT_EXERCISES = 20;

export interface WorkoutLiveState {
  currentExerciseIndex: number;
  completedExerciseIds: string[];
  updatedAt: string;
}

export type WorkoutLiveStateStatus = 'valid' | 'fallback_missing' | 'fallback_malformed';

export interface LiveWorkoutSession {
  session: WorkoutSession;
  liveState: WorkoutLiveState;
  liveStateStatus: WorkoutLiveStateStatus;
}

export interface WorkoutExerciseOption {
  id: string;
  name: string;
}

export interface WorkoutSetData {
  id?: string;
  exerciseLogId?: string;
  setNumber?: number;
  setType?: SetType;
  setDescriptor?: SetDescriptor;
  setNote?: string;
  setMode?: 'reps' | 'duration';
  reps?: number;
  weightLbs?: number;
  durationSeconds?: number;
  restSeconds?: number;
  completedAt?: string;
  attributeValues?: Record<string, unknown>;
}

export type WorkoutSessionServiceErrorCode =
  | 'not_found'
  | 'invalid_status'
  | 'live_session_exists'
  | 'exercise_limit_exceeded'
  | 'exercise_not_found'
  | 'invalid_live_state'
  | 'invalid_set_data';

export class WorkoutSessionServiceError extends Error {
  code: WorkoutSessionServiceErrorCode;

  constructor(code: WorkoutSessionServiceErrorCode, message: string) {
    super(message);
    this.name = 'WorkoutSessionServiceError';
    this.code = code;
  }
}

type TransactionDb = Pick<
  SQLite.SQLiteDatabase,
  'getFirstAsync' | 'getAllAsync' | 'runAsync'
>;

interface UserDateContextRow {
  timezone: string;
  dayEndTime: string | null;
}

interface SessionWithState {
  session: WorkoutSession;
  liveState: WorkoutLiveState;
  liveStateStatus: WorkoutLiveStateStatus;
}

export async function startSession(
  sessionId: string,
  instant: Date | string = new Date()
): Promise<LiveWorkoutSession> {
  const instantIso = toInstantIso(instant);
  const db = getDb();
  let result: LiveWorkoutSession | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const session = await loadWorkoutSession(txn, sessionId);

    if (!session) {
      throw serviceError('not_found', `Workout session "${sessionId}" was not found.`);
    }

    if (session.status !== 'planned') {
      throw serviceError(
        'invalid_status',
        `Workout session "${sessionId}" must be planned before it can start.`
      );
    }

    const liveConflict = await txn.getFirstAsync<{ id: string }>(
      `SELECT id
      FROM WorkoutSession
      WHERE status = 'live'
        AND id != ?
      LIMIT 1`,
      sessionId
    );

    if (liveConflict) {
      throw serviceError(
        'live_session_exists',
        'Another workout session is already live. Resume or finish it first.'
      );
    }

    let exerciseLogs = session.exerciseLogs;

    if (exerciseLogs.length === 0 && session.templateId) {
      exerciseLogs = await materializeTemplateExerciseLogs(
        txn,
        session.id,
        session.templateId
      );
    }

    validateExerciseCount(exerciseLogs.length);

    const liveState = createLiveState(0, [], instantIso);
    const startedAt = session.startedAt ?? instantIso;

    await txn.runAsync(
      `UPDATE WorkoutSession
      SET status = ?,
        startedAt = ?,
        completedAt = ?,
        workoutDate = ?,
        liveState = ?
      WHERE id = ?`,
      'live',
      startedAt,
      null,
      null,
      serializeLiveState(liveState),
      sessionId
    );

    result = {
      session: {
        ...session,
        status: 'live',
        startedAt,
        completedAt: undefined,
        workoutDate: undefined,
        liveState: serializeLiveState(liveState),
        exerciseLogs,
      },
      liveState,
      liveStateStatus: 'valid',
    };
  });

  return requireResult(result);
}

export async function getLiveSession(userId: string): Promise<LiveWorkoutSession | null> {
  const row = await getDb().getFirstAsync<WorkoutSessionRow>(
    `SELECT ${WORKOUT_SESSION_ROW_COLUMNS}
    FROM WorkoutSession
    WHERE userId = ?
      AND status = 'live'
    ORDER BY startedAt DESC, loggedAt DESC
    LIMIT 1`,
    userId
  );

  if (!row) {
    return null;
  }

  const session = await loadWorkoutSessionByRow(getDb(), row);
  const parsed = parseStoredLiveState(session);

  return {
    session,
    liveState: parsed.liveState,
    liveStateStatus: parsed.liveStateStatus,
  };
}

export async function getWorkoutSession(
  sessionId: string
): Promise<WorkoutSession | null> {
  return loadWorkoutSession(getDb(), sessionId);
}

export async function listWorkoutExerciseOptions(
  userId: string
): Promise<WorkoutExerciseOption[]> {
  const rows = await getDb().getAllAsync<{ id: string; name: string }>(
    `SELECT id, name
    FROM Exercise
    WHERE category IN ('workout', 'mobility')
      AND deletedAt IS NULL
      AND (userId IS NULL OR userId = ?)
    ORDER BY name COLLATE NOCASE ASC`,
    userId
  );

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function advanceExercise(
  sessionId: string,
  instant: Date | string = new Date()
): Promise<LiveWorkoutSession> {
  return updateLiveState(sessionId, instant, ({ session, liveState }) => {
    const currentExercise = session.exerciseLogs[liveState.currentExerciseIndex];
    const completedExerciseIds = currentExercise
      ? addUnique(liveState.completedExerciseIds, currentExercise.exerciseId)
      : liveState.completedExerciseIds;
    const nextIndex =
      session.exerciseLogs.length === 0
        ? 0
        : Math.min(liveState.currentExerciseIndex + 1, session.exerciseLogs.length - 1);

    return {
      ...liveState,
      currentExerciseIndex: nextIndex,
      completedExerciseIds,
    };
  });
}

export async function markExerciseComplete(
  sessionId: string,
  exerciseIdOrIndex: string | number,
  instant: Date | string = new Date()
): Promise<LiveWorkoutSession> {
  return updateLiveState(sessionId, instant, ({ session, liveState }) => {
    const exerciseLog = resolveExerciseTarget(session.exerciseLogs, exerciseIdOrIndex);

    return {
      ...liveState,
      completedExerciseIds: addUnique(
        liveState.completedExerciseIds,
        exerciseLog.exerciseId
      ),
    };
  });
}

export async function unmarkExerciseComplete(
  sessionId: string,
  exerciseIdOrIndex: string | number,
  instant: Date | string = new Date()
): Promise<LiveWorkoutSession> {
  return updateLiveState(sessionId, instant, ({ session, liveState }) => {
    const exerciseLog = resolveExerciseTarget(session.exerciseLogs, exerciseIdOrIndex);

    return {
      ...liveState,
      completedExerciseIds: liveState.completedExerciseIds.filter(
        (exerciseId) => exerciseId !== exerciseLog.exerciseId
      ),
    };
  });
}

export async function addExerciseInSession(
  sessionId: string,
  exerciseId: string,
  instant: Date | string = new Date()
): Promise<LiveWorkoutSession> {
  const instantIso = toInstantIso(instant);
  const db = getDb();
  let result: LiveWorkoutSession | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await loadLiveSessionForUpdate(txn, sessionId);
    const exerciseCount = current.session.exerciseLogs.length;

    if (exerciseCount >= MAX_WORKOUT_EXERCISES) {
      throw serviceError(
        'exercise_limit_exceeded',
        `Workout sessions cannot contain more than ${MAX_WORKOUT_EXERCISES} exercises.`
      );
    }

    const snapshot = await loadExerciseSnapshot(txn, exerciseId, current.session.userId);
    const nextOrder =
      current.session.exerciseLogs.length === 0
        ? 0
        : Math.max(...current.session.exerciseLogs.map((exercise) => exercise.order)) + 1;
    const exerciseLog = createExerciseLog(
      current.session.id,
      snapshot,
      nextOrder
    );

    await insertExerciseLog(txn, exerciseLog);

    const exerciseLogs = [...current.session.exerciseLogs, exerciseLog].sort(
      compareExerciseLogs
    );
    const liveState = createLiveState(
      current.liveState.currentExerciseIndex,
      current.liveState.completedExerciseIds,
      instantIso
    );

    await writeLiveState(txn, sessionId, liveState);

    result = {
      session: {
        ...current.session,
        exerciseLogs,
        liveState: serializeLiveState(liveState),
      },
      liveState,
      liveStateStatus: 'valid',
    };
  });

  return requireResult(result);
}

export async function removeExerciseInSession(
  sessionId: string,
  exerciseIdOrIndex: string | number,
  instant: Date | string = new Date()
): Promise<LiveWorkoutSession> {
  const instantIso = toInstantIso(instant);
  const db = getDb();
  let result: LiveWorkoutSession | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await loadLiveSessionForUpdate(txn, sessionId);
    const removeIndex = resolveExerciseIndex(
      current.session.exerciseLogs,
      exerciseIdOrIndex
    );
    const removed = current.session.exerciseLogs[removeIndex];

    if (!removed) {
      throw serviceError('exercise_not_found', 'Exercise was not found in this session.');
    }

    await txn.runAsync(
      `DELETE FROM SetLog
      WHERE exerciseLogId = ?`,
      removed.id
    );
    await txn.runAsync(
      `DELETE FROM ExerciseLog
      WHERE id = ?`,
      removed.id
    );

    const remaining = current.session.exerciseLogs
      .filter((exercise) => exercise.id !== removed.id)
      .map((exercise, index) => ({ ...exercise, order: index }));

    for (const exercise of remaining) {
      await txn.runAsync(
        `UPDATE ExerciseLog
        SET "order" = ?
        WHERE id = ?`,
        exercise.order,
        exercise.id
      );
    }

    const remainingExerciseIds = new Set(
      remaining.map((exercise) => exercise.exerciseId)
    );
    const completedExerciseIds = current.liveState.completedExerciseIds.filter(
      (exerciseId) => remainingExerciseIds.has(exerciseId)
    );
    const currentExerciseIndex = adjustIndexAfterRemoval(
      current.liveState.currentExerciseIndex,
      removeIndex,
      remaining.length
    );
    const liveState = createLiveState(
      currentExerciseIndex,
      completedExerciseIds,
      instantIso
    );

    await writeLiveState(txn, sessionId, liveState);

    result = {
      session: {
        ...current.session,
        exerciseLogs: remaining,
        liveState: serializeLiveState(liveState),
      },
      liveState,
      liveStateStatus: 'valid',
    };
  });

  return requireResult(result);
}

export async function logSet(
  sessionId: string,
  exerciseId: string,
  setData: WorkoutSetData,
  instant: Date | string = new Date()
): Promise<SetLog> {
  const instantIso = toInstantIso(instant);
  const db = getDb();
  let result: SetLog | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const session = await loadWorkoutSession(txn, sessionId);

    if (!session) {
      throw serviceError('not_found', `Workout session "${sessionId}" was not found.`);
    }

    if (session.status !== 'live') {
      throw serviceError(
        'invalid_status',
        'Sets can only be logged against a live workout session.'
      );
    }

    const exerciseLog = resolveSetExerciseLog(session.exerciseLogs, exerciseId, setData);
    const setLog: SetLog = {
      id: setData.id ?? generateId(),
      exerciseLogId: exerciseLog.id,
      setNumber: setData.setNumber ?? exerciseLog.sets.length + 1,
      setType: setData.setType ?? SetType.NORMAL,
      setDescriptor: setData.setDescriptor,
      setNote: setData.setNote,
      setMode: setData.setMode ?? exerciseLog.exerciseSetModeSnapshot,
      reps: setData.reps,
      weightLbs: setData.weightLbs,
      durationSeconds: setData.durationSeconds,
      restSeconds: setData.restSeconds,
      completedAt: setData.completedAt ?? instantIso,
      attributeValues: setData.attributeValues,
    };

    validateSetLog(setLog);
    await insertSetLog(txn, setLog);
    result = setLog;
  });

  if (!result) {
    throw serviceError('invalid_set_data', 'Set could not be logged.');
  }

  return result;
}

export async function completeSession(
  sessionId: string,
  instant: Date | string = new Date()
): Promise<WorkoutSession> {
  const instantIso = toInstantIso(instant);
  const db = getDb();
  let result: WorkoutSession | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const session = await loadWorkoutSession(txn, sessionId);

    if (!session) {
      throw serviceError('not_found', `Workout session "${sessionId}" was not found.`);
    }

    if (session.status !== 'live') {
      throw serviceError(
        'invalid_status',
        'Only live workout sessions can be completed.'
      );
    }

    result = await upsertCompletedWorkoutSession(txn, session, instantIso, false);
  });

  return requireCompletedSession(result);
}

export async function completeSessionFromSnapshot(
  session: WorkoutSession,
  instant: Date | string = new Date()
): Promise<WorkoutSession> {
  const instantIso = toInstantIso(instant);
  const db = getDb();
  let result: WorkoutSession | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    result = await upsertCompletedWorkoutSession(txn, session, instantIso, true);
  });

  return requireCompletedSession(result);
}

export async function discardSession(sessionId: string): Promise<WorkoutSession> {
  const db = getDb();
  let result: WorkoutSession | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const session = await loadWorkoutSession(txn, sessionId);

    if (!session) {
      throw serviceError('not_found', `Workout session "${sessionId}" was not found.`);
    }

    if (session.status !== 'live') {
      throw serviceError(
        'invalid_status',
        'Only live workout sessions can be discarded.'
      );
    }

    for (const exercise of session.exerciseLogs) {
      await txn.runAsync(
        `DELETE FROM SetLog
        WHERE exerciseLogId = ?`,
        exercise.id
      );
    }

    await txn.runAsync(
      `DELETE FROM ExerciseLog
      WHERE sessionId = ?`,
      sessionId
    );
    await txn.runAsync(
      `UPDATE WorkoutSession
      SET status = ?,
        startedAt = ?,
        completedAt = ?,
        workoutDate = ?,
        liveState = ?
      WHERE id = ?`,
      'planned',
      null,
      null,
      null,
      null,
      sessionId
    );

    result = {
      ...session,
      status: 'planned',
      startedAt: undefined,
      completedAt: undefined,
      workoutDate: undefined,
      liveState: undefined,
      exerciseLogs: [],
    };
  });

  return requireCompletedSession(result);
}

export function validateTemplateExerciseConfigs(
  configs: readonly ExerciseConfig[]
): void {
  validateExerciseCount(configs.length);
}

async function updateLiveState(
  sessionId: string,
  instant: Date | string,
  updater: (current: SessionWithState) => WorkoutLiveState
): Promise<LiveWorkoutSession> {
  const instantIso = toInstantIso(instant);
  const db = getDb();
  let result: LiveWorkoutSession | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const current = await loadLiveSessionForUpdate(txn, sessionId);
    const nextLiveState = normalizeLiveState({
      ...updater(current),
      updatedAt: instantIso,
    }, current.session.exerciseLogs);

    await writeLiveState(txn, sessionId, nextLiveState);

    result = {
      session: {
        ...current.session,
        liveState: serializeLiveState(nextLiveState),
      },
      liveState: nextLiveState,
      liveStateStatus: 'valid',
    };
  });

  return requireResult(result);
}

async function loadLiveSessionForUpdate(
  db: TransactionDb,
  sessionId: string
): Promise<SessionWithState> {
  const session = await loadWorkoutSession(db, sessionId);

  if (!session) {
    throw serviceError('not_found', `Workout session "${sessionId}" was not found.`);
  }

  if (session.status !== 'live') {
    throw serviceError(
      'invalid_status',
      'Workout session must be live for this action.'
    );
  }

  const parsed = parseStoredLiveState(session);

  return {
    session,
    liveState: parsed.liveState,
    liveStateStatus: parsed.liveStateStatus,
  };
}

async function loadWorkoutSession(
  db: TransactionDb,
  sessionId: string
): Promise<WorkoutSession | null> {
  const row = await db.getFirstAsync<WorkoutSessionRow>(
    `SELECT ${WORKOUT_SESSION_ROW_COLUMNS}
    FROM WorkoutSession
    WHERE id = ?
    LIMIT 1`,
    sessionId
  );

  return row ? loadWorkoutSessionByRow(db, row) : null;
}

async function loadWorkoutSessionByRow(
  db: TransactionDb,
  row: WorkoutSessionRow
): Promise<WorkoutSession> {
  const session = rowToWorkoutSession(row);
  const exerciseLogs = await loadExerciseLogs(db, session.id);

  return { ...session, exerciseLogs };
}

async function loadExerciseLogs(
  db: TransactionDb,
  sessionId: string
): Promise<ExerciseLog[]> {
  const exerciseRows = await db.getAllAsync<ExerciseLogRow>(
    `SELECT ${EXERCISE_LOG_ROW_COLUMNS}
    FROM ExerciseLog
    WHERE sessionId = ?
    ORDER BY "order" ASC, id ASC`,
    sessionId
  );
  const exerciseLogs = exerciseRows.map(rowToExerciseLog);

  if (exerciseLogs.length === 0) {
    return [];
  }

  const exerciseLogIds = exerciseLogs.map((exercise) => exercise.id);
  const placeholders = exerciseLogIds.map(() => '?').join(', ');
  const setRows = await db.getAllAsync<SetLogRow>(
    `SELECT ${SET_LOG_ROW_COLUMNS}
    FROM SetLog
    WHERE exerciseLogId IN (${placeholders})
    ORDER BY exerciseLogId ASC, setNumber ASC, id ASC`,
    ...exerciseLogIds
  );
  const setsByExerciseLogId = new Map<string, SetLog[]>();

  for (const row of setRows) {
    const setLog = rowToSetLog(row);
    const sets = setsByExerciseLogId.get(setLog.exerciseLogId) ?? [];
    sets.push(setLog);
    setsByExerciseLogId.set(setLog.exerciseLogId, sets);
  }

  return exerciseLogs.map((exercise) => ({
    ...exercise,
    sets: setsByExerciseLogId.get(exercise.id) ?? [],
  }));
}

async function materializeTemplateExerciseLogs(
  db: TransactionDb,
  sessionId: string,
  templateId: string
): Promise<ExerciseLog[]> {
  const templateRow = await db.getFirstAsync<WorkoutTemplateExerciseConfigsRow>(
    `SELECT id, exerciseConfigs
    FROM WorkoutTemplate
    WHERE id = ?
    LIMIT 1`,
    templateId
  );

  if (!templateRow) {
    return [];
  }

  const configs = rowToWorkoutTemplateExerciseConfigs(templateRow);
  validateTemplateExerciseConfigs(configs);

  if (configs.length === 0) {
    return [];
  }

  const sortedConfigs = [...configs].sort((a, b) => a.order - b.order);
  const snapshots = await loadExerciseSnapshotsForConfigs(db, sortedConfigs);
  const exerciseLogs: ExerciseLog[] = [];

  for (const [index, config] of sortedConfigs.entries()) {
    const snapshot = snapshots.get(config.exerciseId);

    if (!snapshot) {
      throw serviceError(
        'exercise_not_found',
        `Exercise "${config.exerciseId}" from template "${templateId}" was not found.`
      );
    }

    const exerciseLog = createExerciseLog(sessionId, snapshot, index, config);
    await insertExerciseLog(db, exerciseLog);
    exerciseLogs.push(exerciseLog);
  }

  return exerciseLogs;
}

async function loadExerciseSnapshotsForConfigs(
  db: TransactionDb,
  configs: readonly ExerciseConfig[]
): Promise<Map<string, ExerciseLogSnapshot>> {
  const exerciseIds = unique(configs.map((config) => config.exerciseId));
  const placeholders = exerciseIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<ExerciseSnapshotRow>(
    `SELECT ${EXERCISE_SNAPSHOT_ROW_COLUMNS}
    FROM Exercise
    WHERE id IN (${placeholders})`,
    ...exerciseIds
  );

  return new Map(
    rows.map((row) => {
      const snapshot = rowToExerciseLogSnapshot(row);
      return [snapshot.exerciseId, snapshot];
    })
  );
}

async function loadExerciseSnapshot(
  db: TransactionDb,
  exerciseId: string,
  userId: string
): Promise<ExerciseLogSnapshot> {
  const row = await db.getFirstAsync<ExerciseSnapshotRow>(
    `SELECT ${EXERCISE_SNAPSHOT_ROW_COLUMNS}
    FROM Exercise
    WHERE id = ?
      AND category IN ('workout', 'mobility')
      AND deletedAt IS NULL
      AND (userId IS NULL OR userId = ?)
    LIMIT 1`,
    exerciseId,
    userId
  );

  if (!row) {
    throw serviceError('exercise_not_found', `Exercise "${exerciseId}" was not found.`);
  }

  return rowToExerciseLogSnapshot(row);
}

function createExerciseLog(
  sessionId: string,
  snapshot: ExerciseLogSnapshot,
  order: number,
  config?: ExerciseConfig
): ExerciseLog {
  return {
    id: generateId(),
    sessionId,
    exerciseId: snapshot.exerciseId,
    exerciseNameSnapshot: snapshot.exerciseNameSnapshot,
    exerciseSetModeSnapshot: snapshot.exerciseSetModeSnapshot,
    exerciseLoadTypeSnapshot: snapshot.exerciseLoadTypeSnapshot,
    exerciseAttributesSnapshot: snapshot.exerciseAttributesSnapshot,
    order,
    groupId: config?.groupId,
    groupType: config?.groupType,
    sets: [],
  };
}

async function upsertCompletedWorkoutSession(
  db: TransactionDb,
  sourceSession: WorkoutSession,
  instantIso: string,
  writeExerciseLogs: boolean
): Promise<WorkoutSession> {
  const startedAt = sourceSession.startedAt ?? instantIso;
  const completedAt = instantIso;
  const workoutDate =
    sourceSession.workoutDate ??
    resolveLogicalDateForSession(db, sourceSession.userId, startedAt);
  const session: WorkoutSession = {
    ...sourceSession,
    status: 'completed',
    startedAt,
    completedAt,
    workoutDate: await workoutDate,
    liveState: undefined,
  };
  const existingSession = await loadWorkoutSession(db, session.id);

  if (existingSession) {
    await db.runAsync(
      `UPDATE WorkoutSession
      SET status = ?,
        scheduledDate = ?,
        scheduledTime = ?,
        startedAt = ?,
        completedAt = ?,
        isRetroactive = ?,
        workoutDate = ?,
        durationMinutes = ?,
        durationOverridden = ?,
        rpe = ?,
        note = ?,
        liveState = ?
      WHERE id = ?`,
      session.status,
      session.scheduledDate ?? null,
      session.scheduledTime ?? null,
      session.startedAt ?? null,
      session.completedAt ?? null,
      session.isRetroactive ? 1 : 0,
      session.workoutDate ?? null,
      session.durationMinutes ?? null,
      session.durationOverridden ? 1 : 0,
      session.rpe ?? null,
      session.note ?? null,
      null,
      session.id
    );
  } else {
    await db.runAsync(
      `INSERT INTO WorkoutSession (
        id, userId, templateId, scheduleId, generatedForDate, name,
        templateNameSnapshot, status, scheduledDate, scheduledTime,
        startedAt, completedAt, loggedAt, isRetroactive, workoutDate,
        durationMinutes, durationOverridden, rpe, note, liveState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      session.userId,
      session.templateId ?? null,
      session.scheduleId ?? null,
      session.generatedForDate ?? null,
      session.name ?? null,
      session.templateNameSnapshot ?? null,
      session.status,
      session.scheduledDate ?? null,
      session.scheduledTime ?? null,
      session.startedAt ?? null,
      session.completedAt ?? null,
      session.loggedAt,
      session.isRetroactive ? 1 : 0,
      session.workoutDate ?? null,
      session.durationMinutes ?? null,
      session.durationOverridden ? 1 : 0,
      session.rpe ?? null,
      session.note ?? null,
      null
    );
  }

  if (writeExerciseLogs) {
    for (const exercise of session.exerciseLogs) {
      await insertExerciseLog(db, exercise);

      for (const setLog of exercise.sets) {
        await insertSetLog(db, setLog);
      }
    }
  }

  return session;
}

async function resolveLogicalDateForSession(
  db: TransactionDb,
  userId: string,
  startedAt: string
): Promise<string> {
  const row = await db.getFirstAsync<UserDateContextRow>(
    `SELECT u.timezone AS timezone,
      p.dayEndTime AS dayEndTime
    FROM User u
    LEFT JOIN UserPreferences p ON p.userId = u.id
    WHERE u.id = ?
    LIMIT 1`,
    userId
  );

  if (!row) {
    throw serviceError('not_found', `User "${userId}" was not found.`);
  }

  return resolveLogicalDate(startedAt, row.timezone, row.dayEndTime ?? '00:00');
}

async function insertExerciseLog(
  db: TransactionDb,
  exercise: ExerciseLog
): Promise<void> {
  await db.runAsync(
    `INSERT INTO ExerciseLog (
      id, sessionId, exerciseId, exerciseNameSnapshot,
      exerciseSetModeSnapshot, exerciseLoadTypeSnapshot,
      exerciseAttributesSnapshot, "order", groupId, groupType,
      note, progressionIntent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    exercise.id,
    exercise.sessionId,
    exercise.exerciseId,
    exercise.exerciseNameSnapshot,
    exercise.exerciseSetModeSnapshot,
    exercise.exerciseLoadTypeSnapshot,
    exercise.exerciseAttributesSnapshot
      ? JSON.stringify(exercise.exerciseAttributesSnapshot)
      : null,
    exercise.order,
    exercise.groupId ?? null,
    exercise.groupType ?? null,
    exercise.note ?? null,
    exercise.progressionIntent ?? null
  );
}

async function insertSetLog(db: TransactionDb, setLog: SetLog): Promise<void> {
  await db.runAsync(
    `INSERT INTO SetLog (
      id, exerciseLogId, setNumber, setType, setDescriptor,
      setNote, setMode, reps, weightLbs, durationSeconds,
      restSeconds, completedAt, attributeValues
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    setLog.id,
    setLog.exerciseLogId,
    setLog.setNumber,
    setLog.setType,
    setLog.setDescriptor ?? null,
    setLog.setNote ?? null,
    setLog.setMode,
    setLog.reps ?? null,
    setLog.weightLbs ?? null,
    setLog.durationSeconds ?? null,
    setLog.restSeconds ?? null,
    setLog.completedAt ?? null,
    setLog.attributeValues ? JSON.stringify(setLog.attributeValues) : null
  );
}

async function writeLiveState(
  db: TransactionDb,
  sessionId: string,
  liveState: WorkoutLiveState
): Promise<void> {
  await db.runAsync(
    `UPDATE WorkoutSession
    SET liveState = ?
    WHERE id = ?`,
    serializeLiveState(liveState),
    sessionId
  );
}

function parseStoredLiveState(session: WorkoutSession): {
  liveState: WorkoutLiveState;
  liveStateStatus: WorkoutLiveStateStatus;
} {
  if (!session.liveState) {
    return {
      liveState: createFallbackLiveState(session),
      liveStateStatus: 'fallback_missing',
    };
  }

  try {
    const parsed = JSON.parse(session.liveState) as unknown;
    return {
      liveState: normalizeLiveState(readStoredLiveState(parsed), session.exerciseLogs),
      liveStateStatus: 'valid',
    };
  } catch {
    return {
      liveState: createFallbackLiveState(session),
      liveStateStatus: 'fallback_malformed',
    };
  }
}

function readStoredLiveState(value: unknown): WorkoutLiveState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw serviceError('invalid_live_state', 'Stored liveState must be an object.');
  }

  const record = value as Record<string, unknown>;
  const currentExerciseIndex = record.currentExerciseIndex;
  const completedExerciseIds = record.completedExerciseIds;
  const updatedAt = record.updatedAt;

  if (
    typeof currentExerciseIndex !== 'number' ||
    !Number.isInteger(currentExerciseIndex) ||
    currentExerciseIndex < 0
  ) {
    throw serviceError(
      'invalid_live_state',
      'Stored liveState.currentExerciseIndex is invalid.'
    );
  }

  if (
    !Array.isArray(completedExerciseIds) ||
    !completedExerciseIds.every((exerciseId) => typeof exerciseId === 'string')
  ) {
    throw serviceError(
      'invalid_live_state',
      'Stored liveState.completedExerciseIds is invalid.'
    );
  }

  if (typeof updatedAt !== 'string') {
    throw serviceError('invalid_live_state', 'Stored liveState.updatedAt is invalid.');
  }

  return {
    currentExerciseIndex,
    completedExerciseIds,
    updatedAt,
  };
}

function normalizeLiveState(
  liveState: WorkoutLiveState,
  exerciseLogs: readonly ExerciseLog[]
): WorkoutLiveState {
  const currentExerciseIndex =
    exerciseLogs.length === 0
      ? 0
      : Math.min(liveState.currentExerciseIndex, exerciseLogs.length - 1);
  const validExerciseIds = new Set(exerciseLogs.map((exercise) => exercise.exerciseId));
  const completedExerciseIds = unique(
    liveState.completedExerciseIds.filter((exerciseId) =>
      validExerciseIds.has(exerciseId)
    )
  );

  return {
    currentExerciseIndex,
    completedExerciseIds,
    updatedAt: liveState.updatedAt,
  };
}

function createLiveState(
  currentExerciseIndex: number,
  completedExerciseIds: readonly string[],
  updatedAt: string
): WorkoutLiveState {
  return {
    currentExerciseIndex,
    completedExerciseIds: unique(completedExerciseIds),
    updatedAt,
  };
}

function createFallbackLiveState(session: WorkoutSession): WorkoutLiveState {
  return createLiveState(0, [], session.startedAt ?? session.loggedAt);
}

function serializeLiveState(liveState: WorkoutLiveState): string {
  return JSON.stringify(liveState);
}

function resolveExerciseTarget(
  exerciseLogs: readonly ExerciseLog[],
  exerciseIdOrIndex: string | number
): ExerciseLog {
  const index = resolveExerciseIndex(exerciseLogs, exerciseIdOrIndex);
  const exercise = exerciseLogs[index];

  if (!exercise) {
    throw serviceError('exercise_not_found', 'Exercise was not found in this session.');
  }

  return exercise;
}

function resolveExerciseIndex(
  exerciseLogs: readonly ExerciseLog[],
  exerciseIdOrIndex: string | number
): number {
  if (typeof exerciseIdOrIndex === 'number') {
    if (
      !Number.isInteger(exerciseIdOrIndex) ||
      exerciseIdOrIndex < 0 ||
      exerciseIdOrIndex >= exerciseLogs.length
    ) {
      throw serviceError('exercise_not_found', 'Exercise index is out of range.');
    }

    return exerciseIdOrIndex;
  }

  const index = exerciseLogs.findIndex(
    (exercise) => exercise.exerciseId === exerciseIdOrIndex
  );

  if (index < 0) {
    throw serviceError('exercise_not_found', 'Exercise was not found in this session.');
  }

  return index;
}

function resolveSetExerciseLog(
  exerciseLogs: readonly ExerciseLog[],
  exerciseId: string,
  setData: WorkoutSetData
): ExerciseLog {
  const exerciseLog = setData.exerciseLogId
    ? exerciseLogs.find((exercise) => exercise.id === setData.exerciseLogId)
    : exerciseLogs.find((exercise) => exercise.exerciseId === exerciseId);

  if (!exerciseLog || exerciseLog.exerciseId !== exerciseId) {
    throw serviceError('exercise_not_found', 'Exercise was not found in this session.');
  }

  return exerciseLog;
}

function adjustIndexAfterRemoval(
  currentExerciseIndex: number,
  removedIndex: number,
  remainingCount: number
): number {
  if (remainingCount === 0) {
    return 0;
  }

  if (removedIndex < currentExerciseIndex) {
    return Math.max(0, currentExerciseIndex - 1);
  }

  return Math.min(currentExerciseIndex, remainingCount - 1);
}

function validateExerciseCount(count: number): void {
  if (count > MAX_WORKOUT_EXERCISES) {
    throw serviceError(
      'exercise_limit_exceeded',
      `Workout sessions and templates cannot contain more than ${MAX_WORKOUT_EXERCISES} exercises.`
    );
  }
}

function validateSetLog(setLog: SetLog): void {
  if (!Number.isInteger(setLog.setNumber) || setLog.setNumber < 1) {
    throw serviceError('invalid_set_data', 'Set number must be a positive integer.');
  }

  if (setLog.setMode === 'reps' && setLog.durationSeconds !== undefined) {
    throw serviceError(
      'invalid_set_data',
      'Duration seconds can only be logged for duration sets.'
    );
  }

  if (setLog.setMode === 'duration' && setLog.reps !== undefined) {
    throw serviceError('invalid_set_data', 'Reps can only be logged for rep sets.');
  }
}

function compareExerciseLogs(a: ExerciseLog, b: ExerciseLog): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

function addUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function serviceError(
  code: WorkoutSessionServiceErrorCode,
  message: string
): WorkoutSessionServiceError {
  return new WorkoutSessionServiceError(code, message);
}

function requireResult(result: LiveWorkoutSession | null): LiveWorkoutSession {
  if (!result) {
    throw serviceError('invalid_live_state', 'Live workout state was not saved.');
  }

  return result;
}

function requireCompletedSession(result: WorkoutSession | null): WorkoutSession {
  if (!result) {
    throw serviceError('not_found', 'Workout session was not saved.');
  }

  return result;
}

function toInstantIso(instant: Date | string): string {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);

  if (Number.isNaN(date.getTime())) {
    throw new Error('instant must be a valid Date or ISO string.');
  }

  return date.toISOString();
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
