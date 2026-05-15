import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Database not initialized — call runMigrations() first');
  return _db;
}

interface Migration {
  version: number;
  up: (db: SQLite.SQLiteDatabase) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      // User & Preferences
      db.execSync(`
        CREATE TABLE IF NOT EXISTS User (
          id TEXT PRIMARY KEY NOT NULL,
          email TEXT UNIQUE,
          displayName TEXT,
          timezone TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          lastActiveAt TEXT,
          onboardingCompletedAt TEXT,
          onboardingVersion TEXT
        );

        CREATE TABLE IF NOT EXISTS UserPreferences (
          userId TEXT PRIMARY KEY NOT NULL REFERENCES User(id),
          appMode TEXT NOT NULL DEFAULT 'combined',
          weightUnit TEXT NOT NULL DEFAULT 'lbs',
          distanceUnit TEXT NOT NULL DEFAULT 'mi',
          weekStartDay INTEGER NOT NULL DEFAULT 0,
          defaultRestSeconds INTEGER,
          defaultReps INTEGER,
          defaultSets INTEGER,
          theme TEXT NOT NULL DEFAULT 'system',
          colorScheme TEXT NOT NULL DEFAULT 'muted',
          requireBiometricForHiddenHabits INTEGER NOT NULL DEFAULT 0,
          dayEndTime TEXT NOT NULL DEFAULT '00:00',
          seenProgressionIntentTooltip INTEGER NOT NULL DEFAULT 0,
          modulesEnabled TEXT NOT NULL DEFAULT '[]',
          heightCm REAL,
          dateOfBirth TEXT,
          biologicalSex TEXT,
          tdeeCalories INTEGER,
          goals TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS Exercise (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT REFERENCES User(id),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          setMode TEXT NOT NULL DEFAULT 'reps',
          loadType TEXT NOT NULL DEFAULT 'weighted',
          muscleGroupsPrimary TEXT NOT NULL DEFAULT '[]',
          muscleGroupsSecondary TEXT NOT NULL DEFAULT '[]',
          equipment TEXT,
          attributes TEXT NOT NULL DEFAULT '[]',
          deletedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_exercise_userId ON Exercise(userId);
        CREATE INDEX IF NOT EXISTS idx_exercise_category ON Exercise(category);

        CREATE TABLE IF NOT EXISTS WorkoutTemplate (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          name TEXT,
          description TEXT,
          color TEXT,
          exerciseConfigs TEXT NOT NULL DEFAULT '[]',
          createdAt TEXT NOT NULL,
          lastUsedAt TEXT,
          deletedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_workoutTemplate_userId ON WorkoutTemplate(userId);

        CREATE TABLE IF NOT EXISTS WorkoutSchedule (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          templateId TEXT NOT NULL REFERENCES WorkoutTemplate(id),
          name TEXT,
          frequencyType TEXT NOT NULL,
          daysOfWeek TEXT,
          intervalDays INTEGER,
          intervalWeeks INTEGER,
          scheduledTime TEXT,
          startDate TEXT NOT NULL,
          endDate TEXT,
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          deletedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_workoutSchedule_userId ON WorkoutSchedule(userId);

        CREATE TABLE IF NOT EXISTS WorkoutSession (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          templateId TEXT REFERENCES WorkoutTemplate(id),
          scheduleId TEXT REFERENCES WorkoutSchedule(id),
          name TEXT,
          templateNameSnapshot TEXT,
          status TEXT NOT NULL DEFAULT 'planned',
          scheduledDate TEXT,
          scheduledTime TEXT,
          startedAt TEXT,
          completedAt TEXT,
          loggedAt TEXT NOT NULL,
          isRetroactive INTEGER NOT NULL DEFAULT 0,
          workoutDate TEXT,
          durationMinutes REAL,
          durationOverridden INTEGER NOT NULL DEFAULT 0,
          rpe INTEGER,
          note TEXT,
          UNIQUE(scheduleId, scheduledDate)
        );

        CREATE INDEX IF NOT EXISTS idx_workoutSession_userId ON WorkoutSession(userId);
        CREATE INDEX IF NOT EXISTS idx_workoutSession_status ON WorkoutSession(status);
        CREATE INDEX IF NOT EXISTS idx_workoutSession_scheduledDate ON WorkoutSession(scheduledDate);

        CREATE TABLE IF NOT EXISTS ExerciseLog (
          id TEXT PRIMARY KEY NOT NULL,
          sessionId TEXT NOT NULL REFERENCES WorkoutSession(id),
          exerciseId TEXT NOT NULL REFERENCES Exercise(id),
          exerciseNameSnapshot TEXT NOT NULL,
          exerciseSetModeSnapshot TEXT NOT NULL,
          exerciseLoadTypeSnapshot TEXT NOT NULL,
          exerciseAttributesSnapshot TEXT,
          "order" INTEGER NOT NULL,
          groupId TEXT,
          groupType TEXT,
          note TEXT,
          progressionIntent TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_exerciseLog_sessionId ON ExerciseLog(sessionId);
        CREATE INDEX IF NOT EXISTS idx_exerciseLog_exerciseId ON ExerciseLog(exerciseId);

        CREATE TABLE IF NOT EXISTS SetLog (
          id TEXT PRIMARY KEY NOT NULL,
          exerciseLogId TEXT NOT NULL REFERENCES ExerciseLog(id),
          setNumber INTEGER NOT NULL,
          setType TEXT NOT NULL DEFAULT 'normal',
          setDescriptor TEXT,
          setNote TEXT,
          setMode TEXT NOT NULL DEFAULT 'reps',
          reps INTEGER,
          weightLbs REAL,
          durationSeconds INTEGER,
          restSeconds INTEGER,
          completedAt TEXT,
          attributeValues TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_setLog_exerciseLogId ON SetLog(exerciseLogId);

        CREATE TABLE IF NOT EXISTS CardioTemplate (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          name TEXT,
          type TEXT NOT NULL,
          subtype TEXT,
          color TEXT,
          defaultDurationMinutes REAL,
          defaultDistanceMiles REAL,
          segments TEXT NOT NULL DEFAULT '[]',
          createdAt TEXT NOT NULL,
          lastUsedAt TEXT,
          deletedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_cardioTemplate_userId ON CardioTemplate(userId);

        CREATE TABLE IF NOT EXISTS CardioSchedule (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          templateId TEXT NOT NULL REFERENCES CardioTemplate(id),
          name TEXT,
          frequencyType TEXT NOT NULL,
          daysOfWeek TEXT,
          intervalDays INTEGER,
          intervalWeeks INTEGER,
          scheduledTime TEXT,
          startDate TEXT NOT NULL,
          endDate TEXT,
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          deletedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_cardioSchedule_userId ON CardioSchedule(userId);

        CREATE TABLE IF NOT EXISTS CardioSession (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          templateId TEXT REFERENCES CardioTemplate(id),
          scheduleId TEXT REFERENCES CardioSchedule(id),
          templateNameSnapshot TEXT,
          type TEXT NOT NULL,
          subtype TEXT,
          sportName TEXT,
          status TEXT NOT NULL DEFAULT 'planned',
          scheduledDate TEXT,
          scheduledTime TEXT,
          startedAt TEXT,
          completedAt TEXT,
          loggedAt TEXT NOT NULL,
          isRetroactive INTEGER NOT NULL DEFAULT 0,
          durationMinutes REAL,
          durationOverridden INTEGER NOT NULL DEFAULT 0,
          distanceMiles REAL,
          caloriesBurned INTEGER,
          elevationGainFt REAL,
          rpe INTEGER,
          heartRateAvg INTEGER,
          heartRateMax INTEGER,
          cadence INTEGER,
          resistance INTEGER,
          powerWatts INTEGER,
          route TEXT,
          note TEXT,
          UNIQUE(scheduleId, scheduledDate)
        );

        CREATE INDEX IF NOT EXISTS idx_cardioSession_userId ON CardioSession(userId);
        CREATE INDEX IF NOT EXISTS idx_cardioSession_status ON CardioSession(status);

        CREATE TABLE IF NOT EXISTS CardioSegment (
          id TEXT PRIMARY KEY NOT NULL,
          sessionId TEXT NOT NULL REFERENCES CardioSession(id),
          "order" INTEGER NOT NULL,
          type TEXT NOT NULL,
          label TEXT,
          durationMinutes REAL,
          distanceMiles REAL,
          heartRateAvg INTEGER,
          heartRateMax INTEGER,
          cadence INTEGER,
          resistance INTEGER,
          powerWatts INTEGER,
          rpe INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_cardioSegment_sessionId ON CardioSegment(sessionId);

        CREATE TABLE IF NOT EXISTS PersonalRecord (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          exerciseId TEXT REFERENCES Exercise(id),
          cardioType TEXT,
          type TEXT NOT NULL,
          value REAL NOT NULL,
          distance REAL,
          secondaryValue REAL,
          unit TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'auto_detected',
          celebrated INTEGER NOT NULL DEFAULT 0,
          achievedAt TEXT,
          workoutSessionId TEXT REFERENCES WorkoutSession(id),
          cardioSessionId TEXT REFERENCES CardioSession(id)
        );

        CREATE INDEX IF NOT EXISTS idx_personalRecord_userId ON PersonalRecord(userId);
        CREATE INDEX IF NOT EXISTS idx_personalRecord_exerciseId ON PersonalRecord(exerciseId);

        CREATE TABLE IF NOT EXISTS ExerciseGoal (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          exerciseId TEXT NOT NULL REFERENCES Exercise(id),
          type TEXT NOT NULL,
          targetValue REAL NOT NULL,
          unit TEXT NOT NULL,
          deadline TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          achievedAt TEXT,
          celebrated INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          deletedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS CardioGoal (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          type TEXT NOT NULL,
          goalType TEXT NOT NULL,
          targetValue REAL NOT NULL,
          targetDistance REAL,
          deadline TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          achievedAt TEXT,
          celebrated INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          deletedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS DailyLog (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          date TEXT NOT NULL,
          mood TEXT,
          energyLevel INTEGER,
          bodyweightLbs REAL,
          note TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          UNIQUE(userId, date)
        );

        CREATE INDEX IF NOT EXISTS idx_dailyLog_userId ON DailyLog(userId);

        CREATE TABLE IF NOT EXISTS JournalEntry (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          date TEXT NOT NULL,
          note TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          UNIQUE(userId, date)
        );

        CREATE TABLE IF NOT EXISTS Habit (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          parentHabitId TEXT REFERENCES Habit(id),
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          color TEXT,
          icon TEXT,
          isHidden INTEGER NOT NULL DEFAULT 0,
          trackEffort INTEGER NOT NULL DEFAULT 0,
          startDate TEXT NOT NULL,
          allowMultiplePerDay INTEGER NOT NULL DEFAULT 0,
          displayOrder INTEGER NOT NULL DEFAULT 0,
          isPinned INTEGER NOT NULL DEFAULT 0,
          archivedAt TEXT,
          linkedTallyItemId TEXT,
          createdAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_habit_userId ON Habit(userId);

        CREATE TABLE IF NOT EXISTS HabitTarget (
          id TEXT PRIMARY KEY NOT NULL,
          habitId TEXT NOT NULL REFERENCES Habit(id),
          frequencyType TEXT NOT NULL,
          timesPerDay INTEGER,
          intervalDays INTEGER,
          daysOfWeek TEXT,
          timesPerWeek INTEGER,
          intervalWeeks INTEGER,
          timesPerMonth INTEGER,
          daysOfMonth TEXT,
          timesPerYear INTEGER,
          scheduledTime TEXT,
          weekStartDay INTEGER NOT NULL DEFAULT 0,
          habitType TEXT NOT NULL DEFAULT 'binary',
          targetValue REAL,
          targetUnit TEXT,
          directionality TEXT,
          streakCompletionThreshold REAL,
          autoCompleteThreshold INTEGER,
          effectiveFrom TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_habitTarget_habitId ON HabitTarget(habitId);

        CREATE TABLE IF NOT EXISTS HabitLog (
          id TEXT PRIMARY KEY NOT NULL,
          habitId TEXT NOT NULL REFERENCES Habit(id),
          userId TEXT NOT NULL REFERENCES User(id),
          date TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          value REAL,
          effortRating INTEGER,
          note TEXT,
          completedAt TEXT,
          UNIQUE(habitId, date)
        );

        CREATE INDEX IF NOT EXISTS idx_habitLog_userId ON HabitLog(userId);
        CREATE INDEX IF NOT EXISTS idx_habitLog_habitId ON HabitLog(habitId);
        CREATE INDEX IF NOT EXISTS idx_habitLog_date ON HabitLog(date);

        CREATE TABLE IF NOT EXISTS HabitStreakPause (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          habitId TEXT REFERENCES Habit(id),
          startDate TEXT NOT NULL,
          endDate TEXT,
          reasons TEXT,
          reasonNote TEXT,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS HabitPeriodTarget (
          id TEXT PRIMARY KEY NOT NULL,
          habitId TEXT NOT NULL REFERENCES Habit(id),
          userId TEXT NOT NULL REFERENCES User(id),
          period TEXT NOT NULL,
          targetType TEXT NOT NULL,
          targetValue REAL NOT NULL,
          effectiveFrom TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS NutritionMetric (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT REFERENCES User(id),
          name TEXT NOT NULL,
          unit TEXT NOT NULL,
          isSeeded INTEGER NOT NULL DEFAULT 0,
          displayOrder INTEGER NOT NULL DEFAULT 0,
          deletedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS NutritionTarget (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          metricId TEXT NOT NULL REFERENCES NutritionMetric(id),
          targetValue REAL NOT NULL,
          effectiveFrom TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS NutritionLog (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          date TEXT NOT NULL,
          note TEXT,
          loggedAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          UNIQUE(userId, date)
        );

        CREATE TABLE IF NOT EXISTS NutritionLogEntry (
          id TEXT PRIMARY KEY NOT NULL,
          nutritionLogId TEXT NOT NULL REFERENCES NutritionLog(id),
          metricId TEXT NOT NULL REFERENCES NutritionMetric(id),
          value REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_nutritionLogEntry_nutritionLogId ON NutritionLogEntry(nutritionLogId);

        CREATE TABLE IF NOT EXISTS SavedFood (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          name TEXT NOT NULL,
          displayOrder INTEGER NOT NULL DEFAULT 0,
          servingSize REAL NOT NULL,
          servingUnit TEXT NOT NULL,
          defaultQuantity REAL NOT NULL DEFAULT 1,
          brand TEXT,
          lastUsedAt TEXT,
          deletedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS SavedFoodMetric (
          savedFoodId TEXT NOT NULL REFERENCES SavedFood(id),
          metricId TEXT NOT NULL REFERENCES NutritionMetric(id),
          value REAL NOT NULL,
          PRIMARY KEY (savedFoodId, metricId)
        );

        CREATE TABLE IF NOT EXISTS NutritionFoodLogEntry (
          id TEXT PRIMARY KEY NOT NULL,
          nutritionLogId TEXT NOT NULL REFERENCES NutritionLog(id),
          savedFoodId TEXT NOT NULL REFERENCES SavedFood(id),
          quantity REAL NOT NULL,
          savedFoodNameSnapshot TEXT NOT NULL,
          savedFoodMetricsSnapshot TEXT NOT NULL DEFAULT '{}',
          loggedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Medication (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          name TEXT NOT NULL,
          dose REAL,
          doseUnit TEXT,
          notes TEXT,
          color TEXT,
          icon TEXT,
          displayOrder INTEGER NOT NULL DEFAULT 0,
          archivedAt TEXT,
          totalDosesPerDay INTEGER NOT NULL DEFAULT 1,
          doseTimes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_medication_userId ON Medication(userId);

        CREATE TABLE IF NOT EXISTS MedicationLog (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          medicationId TEXT NOT NULL REFERENCES Medication(id),
          date TEXT NOT NULL,
          doseNumber INTEGER NOT NULL DEFAULT 1,
          taken INTEGER NOT NULL DEFAULT 0,
          takenAt TEXT,
          note TEXT,
          UNIQUE(medicationId, date, doseNumber)
        );

        CREATE INDEX IF NOT EXISTS idx_medicationLog_userId ON MedicationLog(userId);
        CREATE INDEX IF NOT EXISTS idx_medicationLog_date ON MedicationLog(date);

        CREATE TABLE IF NOT EXISTS TallyItem (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          name TEXT NOT NULL,
          unit TEXT,
          directionality TEXT,
          resetFrequency TEXT NOT NULL DEFAULT 'daily',
          color TEXT,
          icon TEXT,
          displayOrder INTEGER NOT NULL DEFAULT 0,
          archivedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS TallyLog (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          tallyItemId TEXT NOT NULL REFERENCES TallyItem(id),
          periodStartDate TEXT NOT NULL,
          periodEndDate TEXT NOT NULL,
          count REAL NOT NULL DEFAULT 0,
          updatedAt TEXT NOT NULL,
          UNIQUE(tallyItemId, periodStartDate)
        );

        CREATE INDEX IF NOT EXISTS idx_tallyLog_userId ON TallyLog(userId);

        CREATE TABLE IF NOT EXISTS NotificationSettings (
          userId TEXT PRIMARY KEY NOT NULL REFERENCES User(id),
          pushToken TEXT,
          permissionStatus TEXT NOT NULL DEFAULT 'not_determined',
          quietHoursStart TEXT,
          quietHoursEnd TEXT,
          scheduledNotificationIds TEXT,
          lastWeeklyDigestSentAt TEXT,
          masterEnabled INTEGER NOT NULL DEFAULT 1,
          habitDailyReminder INTEGER NOT NULL DEFAULT 0,
          habitReminderTime TEXT,
          habitStreakAtRisk INTEGER NOT NULL DEFAULT 1,
          habitStreakBroken INTEGER NOT NULL DEFAULT 1,
          workoutReminder INTEGER NOT NULL DEFAULT 0,
          workoutReminderType TEXT NOT NULL DEFAULT 'fixed_time',
          workoutReminderTime TEXT,
          workoutReminderMinutesBefore INTEGER,
          medicationReminder INTEGER NOT NULL DEFAULT 0,
          medicationMissed INTEGER NOT NULL DEFAULT 1,
          weeklyDigest INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS BodyMetric (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          value REAL NOT NULL,
          note TEXT,
          loggedAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bodyMetric_userId ON BodyMetric(userId);
        CREATE INDEX IF NOT EXISTS idx_bodyMetric_type ON BodyMetric(type);
        CREATE INDEX IF NOT EXISTS idx_bodyMetric_date ON BodyMetric(date);

        CREATE TABLE IF NOT EXISTS ProgressPhoto (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL REFERENCES User(id),
          date TEXT NOT NULL,
          uri TEXT NOT NULL,
          angle TEXT,
          note TEXT,
          loggedAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_progressPhoto_userId ON ProgressPhoto(userId);
      `);
    },
  },
];

export async function runMigrations(): Promise<void> {
  const db = await SQLite.openDatabaseAsync('habit.db');
  _db = db;

  await db.execAsync('PRAGMA journal_mode = WAL;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = row?.version ?? 0;

  const pending = migrations.filter((m) => m.version > currentVersion);

  for (const migration of pending) {
    migration.up(db);
    await db.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      migration.version
    );
  }
}
