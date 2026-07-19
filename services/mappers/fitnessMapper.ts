import {
  CardioType,
  LoadType,
  SetDescriptor,
  SetType,
  WorkoutScheduleFrequency,
} from '../../constants/enums';
import type {
  CardioSchedule,
  CardioSession,
  ExerciseConfig,
  ExerciseLog,
  SetLog,
  WorkoutSchedule,
  WorkoutSession,
} from '../../types/schema';
import {
  readBooleanInt,
  readNullableNumber,
  readNullableString,
  readNullableStringEnum,
  readNumber,
  readNumberArrayJson,
  readRowObject,
  readString,
  readStringEnum,
} from './mapperUtils';

const WORKOUT_SCHEDULE_FREQUENCIES = [
  WorkoutScheduleFrequency.SPECIFIC_DAYS_OF_WEEK,
  WorkoutScheduleFrequency.EVERY_N_DAYS,
  WorkoutScheduleFrequency.EVERY_N_WEEKS,
] as const;

const CARDIO_TYPES = [
  CardioType.RUNNING,
  CardioType.CYCLING,
  CardioType.ROWING,
  CardioType.SWIMMING,
  CardioType.ELLIPTICAL,
  CardioType.STAIR_CLIMBER,
  CardioType.HIKING,
  CardioType.WALKING,
  CardioType.JUMP_ROPE,
  CardioType.HIIT,
  CardioType.SPORT,
  CardioType.OTHER,
] as const;

const SESSION_STATUSES = ['planned', 'live', 'completed', 'skipped'] as const;
const SET_TYPES = [
  SetType.NORMAL,
  SetType.WARMUP,
  SetType.DROP,
  SetType.FAILURE,
] as const;
const SET_DESCRIPTORS = [
  SetDescriptor.SLOW_NEGATIVE,
  SetDescriptor.PARTIAL,
  SetDescriptor.PAUSE,
] as const;
const LOAD_TYPES = [
  LoadType.WEIGHTED,
  LoadType.BODYWEIGHT,
  LoadType.ASSISTED,
] as const;
const SET_MODES = ['reps', 'duration'] as const;
const GROUP_TYPES = ['superset', 'circuit'] as const;
const PROGRESSION_INTENTS = ['up', 'equal', 'down'] as const;

const WORKOUT_SCHEDULE_TABLE = 'WorkoutSchedule';
const CARDIO_SCHEDULE_TABLE = 'CardioSchedule';
const WORKOUT_SESSION_TABLE = 'WorkoutSession';
const CARDIO_SESSION_TABLE = 'CardioSession';
const WORKOUT_TEMPLATE_TABLE = 'WorkoutTemplate';
const EXERCISE_LOG_TABLE = 'ExerciseLog';
const SET_LOG_TABLE = 'SetLog';
const EXERCISE_TABLE = 'Exercise';
const USER_TABLE = 'User';

type JsonObject = Record<string, unknown>;

export interface ScheduleGenerationUserContextRow {
  timezone: string;
  dayEndTime: string | null;
}

export interface ScheduleGenerationUserContext {
  timezone: string;
  dayEndTime: string;
}

export interface WorkoutScheduleGenerationRow {
  id: string;
  userId: string;
  templateId: string;
  name: string | null;
  frequencyType: string;
  daysOfWeek: string | null;
  intervalDays: number | null;
  intervalWeeks: number | null;
  scheduledTime: string | null;
  startDate: string;
  endDate: string | null;
  isActive: number;
  createdAt: string;
  deletedAt: string | null;
  templateName: string | null;
}

export interface CardioScheduleGenerationRow extends WorkoutScheduleGenerationRow {
  templateType: string;
  templateSubtype: string | null;
}

export type WorkoutScheduleForGeneration = WorkoutSchedule & {
  templateName?: string;
};

export type CardioScheduleForGeneration = CardioSchedule & {
  templateName?: string;
  templateType: CardioType;
  templateSubtype?: string;
};

export interface WorkoutSessionRow {
  id: string;
  userId: string;
  templateId: string | null;
  scheduleId: string | null;
  generatedForDate: string | null;
  name: string | null;
  templateNameSnapshot: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: string | null;
  completedAt: string | null;
  loggedAt: string;
  isRetroactive: number;
  workoutDate: string | null;
  durationMinutes: number | null;
  durationOverridden: number;
  rpe: number | null;
  note: string | null;
  liveState: string | null;
}

export interface CardioSessionRow {
  id: string;
  userId: string;
  templateId: string | null;
  scheduleId: string | null;
  generatedForDate: string | null;
  templateNameSnapshot: string | null;
  type: string;
  subtype: string | null;
  sportName: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: string | null;
  completedAt: string | null;
  loggedAt: string;
  isRetroactive: number;
  cardioDate: string | null;
  durationMinutes: number | null;
  durationOverridden: number;
  distanceMiles: number | null;
  caloriesBurned: number | null;
  elevationGainFt: number | null;
  rpe: number | null;
  heartRateAvg: number | null;
  heartRateMax: number | null;
  cadence: number | null;
  resistance: number | null;
  powerWatts: number | null;
  route: string | null;
  note: string | null;
}

export interface ExerciseLogRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  exerciseSetModeSnapshot: string;
  exerciseLoadTypeSnapshot: string;
  exerciseAttributesSnapshot: string | null;
  order: number;
  groupId: string | null;
  groupType: string | null;
  note: string | null;
  progressionIntent: string | null;
}

export interface SetLogRow {
  id: string;
  exerciseLogId: string;
  setNumber: number;
  setType: string;
  setDescriptor: string | null;
  setNote: string | null;
  setMode: string;
  reps: number | null;
  weightLbs: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  completedAt: string | null;
  attributeValues: string | null;
}

export interface ExerciseSnapshotRow {
  id: string;
  name: string;
  setMode: string;
  loadType: string;
  attributes: string;
}

export interface WorkoutTemplateExerciseConfigsRow {
  id: string;
  exerciseConfigs: string;
}

export interface ExerciseLogSnapshot {
  exerciseId: string;
  exerciseNameSnapshot: string;
  exerciseSetModeSnapshot: 'reps' | 'duration';
  exerciseLoadTypeSnapshot: LoadType;
  exerciseAttributesSnapshot?: JsonObject;
}

const BASE_SCHEDULE_GENERATION_ROW_COLUMNS = [
  's.id AS id',
  's.userId AS userId',
  's.templateId AS templateId',
  's.name AS name',
  's.frequencyType AS frequencyType',
  's.daysOfWeek AS daysOfWeek',
  's.intervalDays AS intervalDays',
  's.intervalWeeks AS intervalWeeks',
  's.scheduledTime AS scheduledTime',
  's.startDate AS startDate',
  's.endDate AS endDate',
  's.isActive AS isActive',
  's.createdAt AS createdAt',
  's.deletedAt AS deletedAt',
  't.name AS templateName',
] as const;

export const WORKOUT_SCHEDULE_GENERATION_ROW_COLUMNS =
  BASE_SCHEDULE_GENERATION_ROW_COLUMNS.join(', ');

export const CARDIO_SCHEDULE_GENERATION_ROW_COLUMNS = [
  ...BASE_SCHEDULE_GENERATION_ROW_COLUMNS,
  't.type AS templateType',
  't.subtype AS templateSubtype',
].join(', ');

export const WORKOUT_SESSION_ROW_COLUMNS = [
  'id',
  'userId',
  'templateId',
  'scheduleId',
  'generatedForDate',
  'name',
  'templateNameSnapshot',
  'status',
  'scheduledDate',
  'scheduledTime',
  'startedAt',
  'completedAt',
  'loggedAt',
  'isRetroactive',
  'workoutDate',
  'durationMinutes',
  'durationOverridden',
  'rpe',
  'note',
  'liveState',
].join(', ');

export const CARDIO_SESSION_ROW_COLUMNS = [
  'id',
  'userId',
  'templateId',
  'scheduleId',
  'generatedForDate',
  'templateNameSnapshot',
  'type',
  'subtype',
  'sportName',
  'status',
  'scheduledDate',
  'scheduledTime',
  'startedAt',
  'completedAt',
  'loggedAt',
  'isRetroactive',
  'cardioDate',
  'durationMinutes',
  'durationOverridden',
  'distanceMiles',
  'caloriesBurned',
  'elevationGainFt',
  'rpe',
  'heartRateAvg',
  'heartRateMax',
  'cadence',
  'resistance',
  'powerWatts',
  'route',
  'note',
].join(', ');

export const EXERCISE_LOG_ROW_COLUMNS = [
  'id',
  'sessionId',
  'exerciseId',
  'exerciseNameSnapshot',
  'exerciseSetModeSnapshot',
  'exerciseLoadTypeSnapshot',
  'exerciseAttributesSnapshot',
  '"order" AS "order"',
  'groupId',
  'groupType',
  'note',
  'progressionIntent',
].join(', ');

export const SET_LOG_ROW_COLUMNS = [
  'id',
  'exerciseLogId',
  'setNumber',
  'setType',
  'setDescriptor',
  'setNote',
  'setMode',
  'reps',
  'weightLbs',
  'durationSeconds',
  'restSeconds',
  'completedAt',
  'attributeValues',
].join(', ');

export const EXERCISE_SNAPSHOT_ROW_COLUMNS = [
  'id',
  'name',
  'setMode',
  'loadType',
  'attributes',
].join(', ');

export function rowToScheduleGenerationUserContext(
  row: unknown
): ScheduleGenerationUserContext {
  const record = readRowObject(row, USER_TABLE);

  return {
    timezone: readString(record, USER_TABLE, 'timezone'),
    dayEndTime: readNullableString(record, USER_TABLE, 'dayEndTime') ?? '00:00',
  };
}

export function rowToWorkoutScheduleForGeneration(
  row: unknown
): WorkoutScheduleForGeneration {
  const record = readRowObject(row, WORKOUT_SCHEDULE_TABLE);

  return {
    id: readString(record, WORKOUT_SCHEDULE_TABLE, 'id'),
    userId: readString(record, WORKOUT_SCHEDULE_TABLE, 'userId'),
    templateId: readString(record, WORKOUT_SCHEDULE_TABLE, 'templateId'),
    name: readNullableString(record, WORKOUT_SCHEDULE_TABLE, 'name'),
    frequencyType: readStringEnum(
      record,
      WORKOUT_SCHEDULE_TABLE,
      'frequencyType',
      WORKOUT_SCHEDULE_FREQUENCIES
    ),
    daysOfWeek: readNumberArrayJson(record, WORKOUT_SCHEDULE_TABLE, 'daysOfWeek'),
    intervalDays: readNullableNumber(record, WORKOUT_SCHEDULE_TABLE, 'intervalDays'),
    intervalWeeks: readNullableNumber(record, WORKOUT_SCHEDULE_TABLE, 'intervalWeeks'),
    scheduledTime: readNullableString(record, WORKOUT_SCHEDULE_TABLE, 'scheduledTime'),
    startDate: readString(record, WORKOUT_SCHEDULE_TABLE, 'startDate'),
    endDate: readNullableString(record, WORKOUT_SCHEDULE_TABLE, 'endDate'),
    isActive: readBooleanInt(record, WORKOUT_SCHEDULE_TABLE, 'isActive'),
    createdAt: readString(record, WORKOUT_SCHEDULE_TABLE, 'createdAt'),
    deletedAt: readNullableString(record, WORKOUT_SCHEDULE_TABLE, 'deletedAt'),
    templateName: readNullableString(record, WORKOUT_SCHEDULE_TABLE, 'templateName'),
  };
}

export function rowToCardioScheduleForGeneration(
  row: unknown
): CardioScheduleForGeneration {
  const record = readRowObject(row, CARDIO_SCHEDULE_TABLE);
  const schedule = rowToWorkoutScheduleForGeneration(row);

  return {
    ...schedule,
    frequencyType: schedule.frequencyType,
    templateType: readStringEnum(
      record,
      CARDIO_SCHEDULE_TABLE,
      'templateType',
      CARDIO_TYPES
    ),
    templateSubtype: readNullableString(record, CARDIO_SCHEDULE_TABLE, 'templateSubtype'),
  };
}

export function rowToWorkoutSession(row: unknown): WorkoutSession {
  const record = readRowObject(row, WORKOUT_SESSION_TABLE);

  return {
    id: readString(record, WORKOUT_SESSION_TABLE, 'id'),
    userId: readString(record, WORKOUT_SESSION_TABLE, 'userId'),
    templateId: readNullableString(record, WORKOUT_SESSION_TABLE, 'templateId'),
    scheduleId: readNullableString(record, WORKOUT_SESSION_TABLE, 'scheduleId'),
    generatedForDate: readNullableString(
      record,
      WORKOUT_SESSION_TABLE,
      'generatedForDate'
    ),
    name: readNullableString(record, WORKOUT_SESSION_TABLE, 'name'),
    templateNameSnapshot: readNullableString(
      record,
      WORKOUT_SESSION_TABLE,
      'templateNameSnapshot'
    ),
    status: readStringEnum(record, WORKOUT_SESSION_TABLE, 'status', SESSION_STATUSES),
    scheduledDate: readNullableString(record, WORKOUT_SESSION_TABLE, 'scheduledDate'),
    scheduledTime: readNullableString(record, WORKOUT_SESSION_TABLE, 'scheduledTime'),
    startedAt: readNullableString(record, WORKOUT_SESSION_TABLE, 'startedAt'),
    completedAt: readNullableString(record, WORKOUT_SESSION_TABLE, 'completedAt'),
    loggedAt: readString(record, WORKOUT_SESSION_TABLE, 'loggedAt'),
    isRetroactive: readBooleanInt(record, WORKOUT_SESSION_TABLE, 'isRetroactive'),
    workoutDate: readNullableString(record, WORKOUT_SESSION_TABLE, 'workoutDate'),
    durationMinutes: readNullableNumber(
      record,
      WORKOUT_SESSION_TABLE,
      'durationMinutes'
    ),
    durationOverridden: readBooleanInt(
      record,
      WORKOUT_SESSION_TABLE,
      'durationOverridden'
    ),
    rpe: readNullableNumber(record, WORKOUT_SESSION_TABLE, 'rpe'),
    note: readNullableString(record, WORKOUT_SESSION_TABLE, 'note'),
    liveState: readNullableString(record, WORKOUT_SESSION_TABLE, 'liveState'),
    exerciseLogs: [],
  };
}

export function rowToCardioSession(row: unknown): CardioSession {
  const record = readRowObject(row, CARDIO_SESSION_TABLE);

  return {
    id: readString(record, CARDIO_SESSION_TABLE, 'id'),
    userId: readString(record, CARDIO_SESSION_TABLE, 'userId'),
    templateId: readNullableString(record, CARDIO_SESSION_TABLE, 'templateId'),
    scheduleId: readNullableString(record, CARDIO_SESSION_TABLE, 'scheduleId'),
    generatedForDate: readNullableString(
      record,
      CARDIO_SESSION_TABLE,
      'generatedForDate'
    ),
    templateNameSnapshot: readNullableString(
      record,
      CARDIO_SESSION_TABLE,
      'templateNameSnapshot'
    ),
    type: readStringEnum(record, CARDIO_SESSION_TABLE, 'type', CARDIO_TYPES),
    subtype: readNullableString(record, CARDIO_SESSION_TABLE, 'subtype'),
    sportName: readNullableString(record, CARDIO_SESSION_TABLE, 'sportName'),
    status: readStringEnum(record, CARDIO_SESSION_TABLE, 'status', SESSION_STATUSES),
    scheduledDate: readNullableString(record, CARDIO_SESSION_TABLE, 'scheduledDate'),
    scheduledTime: readNullableString(record, CARDIO_SESSION_TABLE, 'scheduledTime'),
    startedAt: readNullableString(record, CARDIO_SESSION_TABLE, 'startedAt'),
    completedAt: readNullableString(record, CARDIO_SESSION_TABLE, 'completedAt'),
    loggedAt: readString(record, CARDIO_SESSION_TABLE, 'loggedAt'),
    isRetroactive: readBooleanInt(record, CARDIO_SESSION_TABLE, 'isRetroactive'),
    cardioDate: readNullableString(record, CARDIO_SESSION_TABLE, 'cardioDate'),
    durationMinutes: readNullableNumber(
      record,
      CARDIO_SESSION_TABLE,
      'durationMinutes'
    ),
    durationOverridden: readBooleanInt(
      record,
      CARDIO_SESSION_TABLE,
      'durationOverridden'
    ),
    distanceMiles: readNullableNumber(record, CARDIO_SESSION_TABLE, 'distanceMiles'),
    caloriesBurned: readNullableNumber(record, CARDIO_SESSION_TABLE, 'caloriesBurned'),
    elevationGainFt: readNullableNumber(record, CARDIO_SESSION_TABLE, 'elevationGainFt'),
    rpe: readNullableNumber(record, CARDIO_SESSION_TABLE, 'rpe'),
    heartRateAvg: readNullableNumber(record, CARDIO_SESSION_TABLE, 'heartRateAvg'),
    heartRateMax: readNullableNumber(record, CARDIO_SESSION_TABLE, 'heartRateMax'),
    cadence: readNullableNumber(record, CARDIO_SESSION_TABLE, 'cadence'),
    resistance: readNullableNumber(record, CARDIO_SESSION_TABLE, 'resistance'),
    powerWatts: readNullableNumber(record, CARDIO_SESSION_TABLE, 'powerWatts'),
    route: readNullableString(record, CARDIO_SESSION_TABLE, 'route'),
    note: readNullableString(record, CARDIO_SESSION_TABLE, 'note'),
    segments: [],
  };
}

export function rowToExerciseLog(row: unknown): ExerciseLog {
  const record = readRowObject(row, EXERCISE_LOG_TABLE);

  return {
    id: readString(record, EXERCISE_LOG_TABLE, 'id'),
    sessionId: readString(record, EXERCISE_LOG_TABLE, 'sessionId'),
    exerciseId: readString(record, EXERCISE_LOG_TABLE, 'exerciseId'),
    exerciseNameSnapshot: readString(
      record,
      EXERCISE_LOG_TABLE,
      'exerciseNameSnapshot'
    ),
    exerciseSetModeSnapshot: readStringEnum(
      record,
      EXERCISE_LOG_TABLE,
      'exerciseSetModeSnapshot',
      SET_MODES
    ),
    exerciseLoadTypeSnapshot: readStringEnum(
      record,
      EXERCISE_LOG_TABLE,
      'exerciseLoadTypeSnapshot',
      LOAD_TYPES
    ),
    exerciseAttributesSnapshot: readNullableJsonObject(
      record,
      EXERCISE_LOG_TABLE,
      'exerciseAttributesSnapshot'
    ),
    order: readNumber(record, EXERCISE_LOG_TABLE, 'order'),
    groupId: readNullableString(record, EXERCISE_LOG_TABLE, 'groupId'),
    groupType: readNullableStringEnum(
      record,
      EXERCISE_LOG_TABLE,
      'groupType',
      GROUP_TYPES
    ),
    note: readNullableString(record, EXERCISE_LOG_TABLE, 'note'),
    progressionIntent: readNullableStringEnum(
      record,
      EXERCISE_LOG_TABLE,
      'progressionIntent',
      PROGRESSION_INTENTS
    ),
    sets: [],
  };
}

export function rowToSetLog(row: unknown): SetLog {
  const record = readRowObject(row, SET_LOG_TABLE);

  return {
    id: readString(record, SET_LOG_TABLE, 'id'),
    exerciseLogId: readString(record, SET_LOG_TABLE, 'exerciseLogId'),
    setNumber: readNumber(record, SET_LOG_TABLE, 'setNumber'),
    setType: readStringEnum(record, SET_LOG_TABLE, 'setType', SET_TYPES),
    setDescriptor: readNullableStringEnum(
      record,
      SET_LOG_TABLE,
      'setDescriptor',
      SET_DESCRIPTORS
    ),
    setNote: readNullableString(record, SET_LOG_TABLE, 'setNote'),
    setMode: readStringEnum(record, SET_LOG_TABLE, 'setMode', SET_MODES),
    reps: readNullableNumber(record, SET_LOG_TABLE, 'reps'),
    weightLbs: readNullableNumber(record, SET_LOG_TABLE, 'weightLbs'),
    durationSeconds: readNullableNumber(record, SET_LOG_TABLE, 'durationSeconds'),
    restSeconds: readNullableNumber(record, SET_LOG_TABLE, 'restSeconds'),
    completedAt: readNullableString(record, SET_LOG_TABLE, 'completedAt'),
    attributeValues: readNullableJsonObject(record, SET_LOG_TABLE, 'attributeValues'),
  };
}

export function rowToExerciseLogSnapshot(row: unknown): ExerciseLogSnapshot {
  const record = readRowObject(row, EXERCISE_TABLE);
  const attributes = readJsonArray(record, EXERCISE_TABLE, 'attributes');

  return {
    exerciseId: readString(record, EXERCISE_TABLE, 'id'),
    exerciseNameSnapshot: readString(record, EXERCISE_TABLE, 'name'),
    exerciseSetModeSnapshot: readStringEnum(
      record,
      EXERCISE_TABLE,
      'setMode',
      SET_MODES
    ),
    exerciseLoadTypeSnapshot: readStringEnum(
      record,
      EXERCISE_TABLE,
      'loadType',
      LOAD_TYPES
    ),
    exerciseAttributesSnapshot: attributes.length > 0 ? { attributes } : undefined,
  };
}

export function rowToWorkoutTemplateExerciseConfigs(
  row: unknown
): ExerciseConfig[] {
  const record = readRowObject(row, WORKOUT_TEMPLATE_TABLE);
  const raw = readString(record, WORKOUT_TEMPLATE_TABLE, 'exerciseConfigs');
  const parsed = parseJson(raw, WORKOUT_TEMPLATE_TABLE, 'exerciseConfigs');

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid WorkoutTemplate.exerciseConfigs: expected JSON array.');
  }

  return parsed.map((config, index) => readExerciseConfig(config, index));
}

function readExerciseConfig(value: unknown, index: number): ExerciseConfig {
  if (!isJsonObject(value)) {
    throw new Error(`Invalid WorkoutTemplate.exerciseConfigs[${index}]: expected object.`);
  }

  return {
    exerciseId: readObjectString(value, 'exerciseId', index),
    order: readObjectNumber(value, 'order', index),
    groupId: readOptionalObjectString(value, 'groupId', index),
    groupType: readOptionalGroupType(value, index),
    defaultSets: readObjectNumber(value, 'defaultSets', index),
    defaultReps: readOptionalObjectNumber(value, 'defaultReps', index),
    defaultDurationSeconds: readOptionalObjectNumber(
      value,
      'defaultDurationSeconds',
      index
    ),
    defaultWeightLbs: readOptionalObjectNumber(value, 'defaultWeightLbs', index),
    defaultRestSeconds: readOptionalObjectNumber(value, 'defaultRestSeconds', index),
    progressionType: readProgressionType(value, index),
  };
}

function readNullableJsonObject(
  row: Record<string, unknown>,
  table: string,
  column: string
): JsonObject | undefined {
  const raw = readNullableString(row, table, column);

  if (raw === undefined) {
    return undefined;
  }

  const parsed = parseJson(raw, table, column);

  if (!isJsonObject(parsed)) {
    throw new Error(`Invalid ${table}.${column}: expected JSON object.`);
  }

  return parsed;
}

function readJsonArray(
  row: Record<string, unknown>,
  table: string,
  column: string
): unknown[] {
  const raw = readString(row, table, column);
  const parsed = parseJson(raw, table, column);

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid ${table}.${column}: expected JSON array.`);
  }

  return parsed;
}

function parseJson(raw: string, table: string, column: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid ${table}.${column}: expected valid JSON.`);
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readObjectString(
  config: JsonObject,
  key: string,
  index: number
): string {
  const value = config[key];

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid WorkoutTemplate.exerciseConfigs[${index}].${key}: expected string.`
    );
  }

  return value;
}

function readOptionalObjectString(
  config: JsonObject,
  key: string,
  index: number
): string | undefined {
  const value = config[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid WorkoutTemplate.exerciseConfigs[${index}].${key}: expected string.`
    );
  }

  return value;
}

function readObjectNumber(
  config: JsonObject,
  key: string,
  index: number
): number {
  const value = config[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Invalid WorkoutTemplate.exerciseConfigs[${index}].${key}: expected number.`
    );
  }

  return value;
}

function readOptionalObjectNumber(
  config: JsonObject,
  key: string,
  index: number
): number | undefined {
  const value = config[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Invalid WorkoutTemplate.exerciseConfigs[${index}].${key}: expected number.`
    );
  }

  return value;
}

function readOptionalGroupType(
  config: JsonObject,
  index: number
): 'superset' | 'circuit' | undefined {
  const value = readOptionalObjectString(config, 'groupType', index);

  if (value === undefined || value === 'superset' || value === 'circuit') {
    return value;
  }

  throw new Error(
    `Invalid WorkoutTemplate.exerciseConfigs[${index}].groupType: expected superset or circuit.`
  );
}

function readProgressionType(
  config: JsonObject,
  index: number
): 'consistent' | 'progressive_overload' {
  const value = readObjectString(config, 'progressionType', index);

  if (value === 'consistent' || value === 'progressive_overload') {
    return value;
  }

  throw new Error(
    `Invalid WorkoutTemplate.exerciseConfigs[${index}].progressionType: expected consistent or progressive_overload.`
  );
}
