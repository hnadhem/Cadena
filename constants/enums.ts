export const AppMode = {
  FITNESS_ONLY: 'fitness_only',
  HABITS_ONLY: 'habits_only',
  COMBINED: 'combined',
} as const;
export type AppMode = (typeof AppMode)[keyof typeof AppMode];

export const SetType = {
  NORMAL: 'normal',
  WARMUP: 'warmup',
  DROP: 'drop',
  FAILURE: 'failure',
} as const;
export type SetType = (typeof SetType)[keyof typeof SetType];

export const SetDescriptor = {
  SLOW_NEGATIVE: 'slow_negative',
  PARTIAL: 'partial',
  PAUSE: 'pause',
} as const;
export type SetDescriptor = (typeof SetDescriptor)[keyof typeof SetDescriptor];

export const LoadType = {
  WEIGHTED: 'weighted',
  BODYWEIGHT: 'bodyweight',
  ASSISTED: 'assisted',
} as const;
export type LoadType = (typeof LoadType)[keyof typeof LoadType];

export const CardioType = {
  RUNNING: 'running',
  CYCLING: 'cycling',
  ROWING: 'rowing',
  SWIMMING: 'swimming',
  ELLIPTICAL: 'elliptical',
  STAIR_CLIMBER: 'stair_climber',
  HIKING: 'hiking',
  WALKING: 'walking',
  JUMP_ROPE: 'jump_rope',
  HIIT: 'hiit',
  SPORT: 'sport',
  OTHER: 'other',
} as const;
export type CardioType = (typeof CardioType)[keyof typeof CardioType];

export const PRType = {
  ONE_RM: '1rm',
  MAX_REPS: 'max_reps',
  MAX_REPS_AT_WEIGHT: 'max_reps_at_weight',
  BEST_PACE_AT_DISTANCE: 'best_pace_at_distance',
  LONGEST_DISTANCE: 'longest_distance',
  MAX_DURATION: 'max_duration',
} as const;
export type PRType = (typeof PRType)[keyof typeof PRType];

export const FrequencyType = {
  DAILY: 'daily',
  X_PER_DAY: 'x_per_day',
  EVERY_N_DAYS: 'every_n_days',
  SPECIFIC_DAYS_OF_WEEK: 'specific_days_of_week',
  X_PER_WEEK: 'x_per_week',
  EVERY_N_WEEKS: 'every_n_weeks',
  X_PER_MONTH: 'x_per_month',
  SPECIFIC_DAYS_OF_MONTH: 'specific_days_of_month',
  ANNUALLY: 'annually',
} as const;
export type FrequencyType = (typeof FrequencyType)[keyof typeof FrequencyType];

export const WorkoutScheduleFrequency = {
  SPECIFIC_DAYS_OF_WEEK: 'specific_days_of_week',
  EVERY_N_DAYS: 'every_n_days',
  EVERY_N_WEEKS: 'every_n_weeks',
} as const;
export type WorkoutScheduleFrequency = (typeof WorkoutScheduleFrequency)[keyof typeof WorkoutScheduleFrequency];

export const GoalType = {
  LOSE_WEIGHT: 'lose_weight',
  BUILD_MUSCLE: 'build_muscle',
  IMPROVE_ENDURANCE: 'improve_endurance',
  GENERAL_FITNESS: 'general_fitness',
  BUILD_HABIT: 'build_habit',
  MENTAL_WELLNESS: 'mental_wellness',
  SPORT_PERFORMANCE: 'sport_performance',
} as const;
export type GoalType = (typeof GoalType)[keyof typeof GoalType];

export const BodyMetricType = {
  BODY_FAT_PCT: 'body_fat_pct',
  CHEST_CM: 'chest_cm',
  WAIST_CM: 'waist_cm',
  HIPS_CM: 'hips_cm',
  BICEP_CM: 'bicep_cm',
  THIGH_CM: 'thigh_cm',
  NECK_CM: 'neck_cm',
  SHOULDER_CM: 'shoulder_cm',
  CALF_CM: 'calf_cm',
  RESTING_HEART_RATE: 'resting_heart_rate',
  BLOOD_PRESSURE_SYSTOLIC: 'blood_pressure_systolic',
  BLOOD_PRESSURE_DIASTOLIC: 'blood_pressure_diastolic',
  VO2_MAX: 'vo2_max',
} as const;
export type BodyMetricType = (typeof BodyMetricType)[keyof typeof BodyMetricType];

export const MuscleGroup = {
  CHEST: 'chest',
  BACK: 'back',
  SHOULDERS: 'shoulders',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  FOREARMS: 'forearms',
  CORE: 'core',
  GLUTES: 'glutes',
  QUADS: 'quads',
  HAMSTRINGS: 'hamstrings',
  CALVES: 'calves',
  FULL_BODY: 'full_body',
} as const;
export type MuscleGroup = (typeof MuscleGroup)[keyof typeof MuscleGroup];

export const EquipmentType = {
  BARBELL: 'barbell',
  DUMBBELL: 'dumbbell',
  CABLE: 'cable',
  MACHINE: 'machine',
  BODYWEIGHT: 'bodyweight',
  KETTLEBELL: 'kettlebell',
  BANDS: 'bands',
  OTHER: 'other',
} as const;
export type EquipmentType = (typeof EquipmentType)[keyof typeof EquipmentType];

export const EnabledModule = {
  NUTRITION: 'nutrition',
  MEDICATIONS: 'medications',
  BODY_METRICS: 'body_metrics',
  TALLY: 'tally',
  JOURNAL: 'journal',
} as const;
export type EnabledModule = (typeof EnabledModule)[keyof typeof EnabledModule];
