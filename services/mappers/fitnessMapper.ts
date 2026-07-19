import {
  CardioType,
  WorkoutScheduleFrequency,
} from '../../constants/enums';
import type {
  CardioSchedule,
  CardioSession,
  WorkoutSchedule,
  WorkoutSession,
} from '../../types/schema';
import {
  readBooleanInt,
  readNullableNumber,
  readNullableString,
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

const WORKOUT_SCHEDULE_TABLE = 'WorkoutSchedule';
const CARDIO_SCHEDULE_TABLE = 'CardioSchedule';
const WORKOUT_SESSION_TABLE = 'WorkoutSession';
const CARDIO_SESSION_TABLE = 'CardioSession';
const USER_TABLE = 'User';

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
