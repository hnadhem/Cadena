import type {
  AppMode,
  SetType,
  SetDescriptor,
  LoadType,
  CardioType,
  PRType,
  FrequencyType,
  WorkoutScheduleFrequency,
  GoalType,
  BodyMetricType,
  DailyTag,
  MuscleGroup,
  EquipmentType,
  EnabledModule,
} from '../constants/enums';

// ─── 1. User & Preferences ───────────────────────────────────────────────────

export interface User {
  id: string;
  email?: string;
  displayName?: string;
  timezone: string;
  createdAt: string;
  lastActiveAt?: string;
  onboardingCompletedAt?: string;
  onboardingVersion?: string;
}

export interface UserPreferences {
  userId: string;
  appMode: AppMode;
  weightUnit: 'lbs' | 'kg';
  distanceUnit: 'mi' | 'km';
  weekStartDay: number;
  defaultRestSeconds?: number;
  defaultReps?: number;
  defaultSets?: number;
  theme: 'light' | 'dark' | 'system';
  colorScheme: 'classic' | 'muted';
  requireBiometricForHiddenHabits: boolean;
  dayEndTime: string;
  seenProgressionIntentTooltip: boolean;
  modulesEnabled: EnabledModule[];
  heightCm?: number;
  dateOfBirth?: string;
  biologicalSex?: 'male' | 'female' | 'prefer_not_to_say';
  tdeeCalories?: number;
  goals: GoalType[];
}

// ─── 2. Exercise Library ─────────────────────────────────────────────────────

export interface ExerciseAttribute {
  key: string;
  label: string;
  type: 'number' | 'select';
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
}

export interface Exercise {
  id: string;
  userId?: string;
  name: string;
  category: 'workout' | 'cardio' | 'mobility';
  setMode: 'reps' | 'duration';
  loadType: LoadType;
  muscleGroupsPrimary: MuscleGroup[];
  muscleGroupsSecondary: MuscleGroup[];
  equipment?: EquipmentType;
  attributes: ExerciseAttribute[];
  deletedAt?: string;
}

// ─── 3. Workout Templates ────────────────────────────────────────────────────

export interface ExerciseConfig {
  exerciseId: string;
  order: number;
  groupId?: string;
  groupType?: 'superset' | 'circuit';
  defaultSets: number;
  defaultReps?: number;
  defaultDurationSeconds?: number;
  defaultWeightLbs?: number;
  defaultRestSeconds?: number;
  progressionType: 'consistent' | 'progressive_overload';
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name?: string;
  description?: string;
  color?: string;
  exerciseConfigs: ExerciseConfig[];
  createdAt: string;
  lastUsedAt?: string;
  deletedAt?: string;
}

export interface WorkoutSchedule {
  id: string;
  userId: string;
  templateId: string;
  name?: string;
  frequencyType: WorkoutScheduleFrequency;
  daysOfWeek?: number[];
  intervalDays?: number;
  intervalWeeks?: number;
  scheduledTime?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  deletedAt?: string;
}

// ─── 4. Workout Sessions ─────────────────────────────────────────────────────

export interface SetLog {
  id: string;
  exerciseLogId: string;
  setNumber: number;
  setType: SetType;
  setDescriptor?: SetDescriptor;
  setNote?: string;
  setMode: 'reps' | 'duration';
  reps?: number;
  weightLbs?: number;
  durationSeconds?: number;
  restSeconds?: number;
  completedAt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributeValues?: Record<string, any>;
}

export interface ExerciseLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  exerciseSetModeSnapshot: 'reps' | 'duration';
  exerciseLoadTypeSnapshot: LoadType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exerciseAttributesSnapshot?: Record<string, any>;
  order: number;
  groupId?: string;
  groupType?: 'superset' | 'circuit';
  note?: string;
  progressionIntent?: 'up' | 'equal' | 'down';
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  templateId?: string;
  scheduleId?: string;
  generatedForDate?: string;
  name?: string;
  templateNameSnapshot?: string;
  status: 'planned' | 'live' | 'completed' | 'skipped';
  scheduledDate?: string;
  scheduledTime?: string;
  startedAt?: string;
  completedAt?: string;
  loggedAt: string;
  isRetroactive: boolean;
  workoutDate?: string;
  durationMinutes?: number;
  durationOverridden: boolean;
  rpe?: number;
  note?: string;
  liveState?: string;
  exerciseLogs: ExerciseLog[];
}

// ─── 5 & 6. Cardio Templates & Sessions ─────────────────────────────────────

export interface CardioSegmentConfig {
  order: number;
  type: 'warmup' | 'work' | 'recovery' | 'cooldown' | 'custom';
  label?: string;
  durationMinutes?: number;
  distanceMiles?: number;
  targetRpe?: number;
  targetHeartRate?: number;
  targetCadence?: number;
}

export interface CardioTemplate {
  id: string;
  userId: string;
  name?: string;
  type: CardioType;
  subtype?: string;
  color?: string;
  defaultDurationMinutes?: number;
  defaultDistanceMiles?: number;
  segments: CardioSegmentConfig[];
  createdAt: string;
  lastUsedAt?: string;
  deletedAt?: string;
}

export interface CardioSchedule {
  id: string;
  userId: string;
  templateId: string;
  name?: string;
  frequencyType: WorkoutScheduleFrequency;
  daysOfWeek?: number[];
  intervalDays?: number;
  intervalWeeks?: number;
  scheduledTime?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  deletedAt?: string;
}

export interface CardioSegment {
  id: string;
  sessionId: string;
  order: number;
  type: 'warmup' | 'work' | 'recovery' | 'cooldown' | 'custom';
  label?: string;
  durationMinutes?: number;
  distanceMiles?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  cadence?: number;
  resistance?: number;
  powerWatts?: number;
  rpe?: number;
}

export interface CardioSession {
  id: string;
  userId: string;
  templateId?: string;
  scheduleId?: string;
  generatedForDate?: string;
  templateNameSnapshot?: string;
  type: CardioType;
  subtype?: string;
  sportName?: string;
  status: 'planned' | 'live' | 'completed' | 'skipped';
  scheduledDate?: string;
  scheduledTime?: string;
  startedAt?: string;
  completedAt?: string;
  loggedAt: string;
  isRetroactive: boolean;
  cardioDate?: string;
  durationMinutes?: number;
  durationOverridden: boolean;
  distanceMiles?: number;
  caloriesBurned?: number;
  elevationGainFt?: number;
  rpe?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  cadence?: number;
  resistance?: number;
  powerWatts?: number;
  route?: string;
  note?: string;
  segments: CardioSegment[];
}

// ─── 7. Personal Records ─────────────────────────────────────────────────────

export interface PersonalRecord {
  id: string;
  userId: string;
  exerciseId?: string;
  cardioType?: CardioType;
  type: PRType;
  value: number;
  distance?: number;
  secondaryValue?: number;
  unit: string;
  source: 'auto_detected' | 'user_entered';
  celebrated: boolean;
  achievedAt?: string;
  workoutSessionId?: string;
  cardioSessionId?: string;
}

// ─── 8. Goals ────────────────────────────────────────────────────────────────

export interface ExerciseGoal {
  id: string;
  userId: string;
  exerciseId: string;
  type: PRType;
  targetValue: number;
  unit: string;
  deadline?: string;
  status: 'active' | 'achieved';
  achievedAt?: string;
  celebrated: boolean;
  createdAt: string;
  deletedAt?: string;
}

export interface CardioGoal {
  id: string;
  userId: string;
  type: CardioType;
  goalType: 'best_pace_at_distance' | 'longest_distance' | 'max_duration';
  targetValue: number;
  targetDistance?: number;
  deadline?: string;
  status: 'active' | 'achieved';
  achievedAt?: string;
  celebrated: boolean;
  createdAt: string;
  deletedAt?: string;
}

// ─── 9. Daily Log ────────────────────────────────────────────────────────────

export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  energyLevel?: number;
  bodyweightLbs?: number;
  note?: string;
  tags?: DailyTag[];
  createdAt: string;
  updatedAt: string;
}

// ─── 10. Journal ─────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  userId: string;
  date: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 11. Habits ──────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  userId: string;
  parentHabitId?: string;
  name: string;
  description?: string;
  category?: string;
  color?: string;
  icon?: string;
  isHidden: boolean;
  trackEffort: boolean;
  startDate: string;
  allowMultiplePerDay: boolean;
  displayOrder: number;
  isPinned: boolean;
  archivedAt?: string;
  linkedTallyItemId?: string;
  createdAt: string;
}

export interface HabitTarget {
  id: string;
  habitId: string;
  frequencyType: FrequencyType;
  timesPerDay?: number;
  intervalDays?: number;
  daysOfWeek?: number[];
  timesPerWeek?: number;
  intervalWeeks?: number;
  timesPerMonth?: number;
  daysOfMonth?: number[];
  timesPerYear?: number;
  scheduledTime?: string;
  weekStartDay: number;
  habitType: 'binary' | 'measurable';
  targetValue?: number;
  targetUnit?: string;
  directionality?: 'at_least' | 'at_most';
  streakCompletionThreshold?: number;
  autoCompleteThreshold?: number;
  effectiveFrom: string;
  createdAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  completed: boolean;
  value?: number;
  effortRating?: number;
  note?: string;
  completedAt?: string;
}

export interface HabitStreakPause {
  id: string;
  userId: string;
  habitId?: string;
  startDate: string;
  endDate?: string;
  reasons?: string[];
  reasonNote?: string;
  createdAt: string;
}

export interface HabitPeriodTarget {
  id: string;
  habitId: string;
  userId: string;
  period: 'week' | 'month' | 'year';
  targetType: 'completion_count' | 'aggregate_value';
  targetValue: number;
  effectiveFrom: string;
  createdAt: string;
}

// ─── 12. Nutrition & Meds ────────────────────────────────────────────────────

export interface NutritionMetric {
  id: string;
  userId?: string;
  name: string;
  unit: string;
  isSeeded: boolean;
  displayOrder: number;
  deletedAt?: string;
}

export interface NutritionTarget {
  id: string;
  userId: string;
  metricId: string;
  targetValue: number;
  effectiveFrom: string;
  createdAt: string;
}

export interface NutritionLog {
  id: string;
  userId: string;
  date: string;
  note?: string;
  loggedAt: string;
  updatedAt: string;
}

export interface NutritionLogEntry {
  id: string;
  nutritionLogId: string;
  metricId: string;
  value: number;
}

export interface SavedFoodMetric {
  savedFoodId: string;
  metricId: string;
  value: number;
}

export interface SavedFood {
  id: string;
  userId: string;
  name: string;
  metricValues: SavedFoodMetric[];
  displayOrder: number;
  servingSize: number;
  servingUnit: string;
  defaultQuantity: number;
  brand?: string;
  lastUsedAt?: string;
  deletedAt?: string;
}

export interface NutritionFoodLogEntry {
  id: string;
  nutritionLogId: string;
  savedFoodId: string;
  quantity: number;
  savedFoodNameSnapshot: string;
  savedFoodMetricsSnapshot: Record<string, number>;
  loggedAt: string;
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dose?: number;
  doseUnit?: string;
  notes?: string;
  color?: string;
  icon?: string;
  displayOrder: number;
  archivedAt?: string;
  totalDosesPerDay: number;
  doseTimes?: string[];
}

export interface MedicationLog {
  id: string;
  userId: string;
  medicationId: string;
  date: string;
  doseNumber: number;
  taken: boolean;
  takenAt?: string;
  note?: string;
}

// ─── 13. Tally ───────────────────────────────────────────────────────────────

export interface TallyItem {
  id: string;
  userId: string;
  name: string;
  unit?: string;
  directionality?: 'increase' | 'decrease';
  resetFrequency: 'daily' | 'weekly' | 'never';
  color?: string;
  icon?: string;
  displayOrder: number;
  archivedAt?: string;
}

export interface TallyLog {
  id: string;
  userId: string;
  tallyItemId: string;
  periodStartDate: string;
  periodEndDate: string;
  count: number;
  updatedAt: string;
}

// ─── 14. Notifications ───────────────────────────────────────────────────────

export interface NotificationSettings {
  userId: string;
  pushToken?: string;
  permissionStatus: 'granted' | 'denied' | 'not_determined';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  scheduledNotificationIds?: Record<string, string>;
  lastWeeklyDigestSentAt?: string;
  masterEnabled: boolean;
  habitDailyReminder: boolean;
  habitReminderTime?: string;
  habitStreakAtRisk: boolean;
  habitStreakBroken: boolean;
  workoutReminder: boolean;
  workoutReminderType: 'fixed_time' | 'relative';
  workoutReminderTime?: string;
  workoutReminderMinutesBefore?: number;
  medicationReminder: boolean;
  medicationMissed: boolean;
  weeklyDigest: boolean;
}

// ─── 16. Body Metrics ────────────────────────────────────────────────────────

export interface BodyMetric {
  id: string;
  userId: string;
  date: string;
  type: BodyMetricType;
  value: number;
  note?: string;
  loggedAt: string;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  date: string;
  uri: string;
  angle?: 'front' | 'back' | 'side_left' | 'side_right' | 'other';
  note?: string;
  loggedAt: string;
}
