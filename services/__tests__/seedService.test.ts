import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EquipmentType, LoadType, MuscleGroup } from '../../constants/enums';
import { getDb, runMigrations } from '../db';
import { seedBuiltInData } from '../seedService';

interface MockExerciseRow {
  id: string;
  userId: string | null;
  name: string;
  category: string;
  setMode: string;
  loadType: string;
  muscleGroupsPrimary: string;
  muscleGroupsSecondary: string;
  equipment: string | null;
  attributes: string;
  deletedAt: string | null;
}

interface MockNutritionMetricRow {
  id: string;
  userId: string | null;
  name: string;
  unit: string;
  isSeeded: number;
  displayOrder: number;
  deletedAt: string | null;
}

interface MockSnapshot {
  exercises: MockExerciseRow[];
  nutritionMetrics: MockNutritionMetricRow[];
}

interface MockSqliteControls {
  __deleteExercise: (databaseName: string, exerciseId: string) => void;
  __deleteNutritionMetric: (databaseName: string, metricId: string) => void;
  __getSnapshot: (databaseName?: string) => MockSnapshot;
  __resetDatabase: (databaseName: string) => void;
}

jest.mock('expo-sqlite', () => {
  type MockBindValue = string | number | null | boolean | Uint8Array;

  interface MockExerciseRow {
    id: string;
    userId: string | null;
    name: string;
    category: string;
    setMode: string;
    loadType: string;
    muscleGroupsPrimary: string;
    muscleGroupsSecondary: string;
    equipment: string | null;
    attributes: string;
    deletedAt: string | null;
  }

  interface MockNutritionMetricRow {
    id: string;
    userId: string | null;
    name: string;
    unit: string;
    isSeeded: number;
    displayOrder: number;
    deletedAt: string | null;
  }

  interface MockSnapshot {
    exercises: MockExerciseRow[];
    nutritionMetrics: MockNutritionMetricRow[];
  }

  const databases = new Map<string, MockSQLiteDatabase>();

  class MockSQLiteDatabase {
    private schemaVersion: number | null = null;
    private exercises: MockExerciseRow[] = [];
    private nutritionMetrics: MockNutritionMetricRow[] = [];

    async execAsync(_source: string): Promise<void> {}

    execSync(_source: string): void {}

    async withExclusiveTransactionAsync(
      task: (txn: MockSQLiteDatabase) => Promise<void>
    ): Promise<void> {
      const snapshot = this.snapshot();

      try {
        await task(this);
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    }

    async runAsync(
      source: string,
      ...params: MockBindValue[]
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      if (source.includes('INSERT INTO schema_version')) {
        this.schemaVersion = readNumberParam(params, 0, 'schema version');
        return { lastInsertRowId: 1, changes: 1 };
      }

      if (source.includes('INSERT INTO Exercise')) {
        this.exercises.push(readExerciseParams(params));
        return { lastInsertRowId: this.exercises.length, changes: 1 };
      }

      if (source.includes('INSERT INTO NutritionMetric')) {
        this.nutritionMetrics.push(readNutritionMetricParams(params));
        return { lastInsertRowId: this.nutritionMetrics.length, changes: 1 };
      }

      return { lastInsertRowId: 0, changes: 1 };
    }

    async getFirstAsync(
      source: string,
      ...params: MockBindValue[]
    ): Promise<unknown | null> {
      if (source.includes('SELECT version FROM schema_version')) {
        return this.schemaVersion === null ? null : { version: this.schemaVersion };
      }

      if (source.includes('FROM Exercise')) {
        const exerciseId = readStringParam(params, 0, 'exerciseId');
        const row = this.exercises.find((exercise) => exercise.id === exerciseId);
        return row ? { id: row.id } : null;
      }

      if (source.includes('FROM NutritionMetric')) {
        const metricId = readStringParam(params, 0, 'metricId');
        const row = this.nutritionMetrics.find((metric) => metric.id === metricId);
        return row ? { id: row.id } : null;
      }

      return null;
    }

    deleteExercise(exerciseId: string): void {
      this.exercises = this.exercises.filter((exercise) => exercise.id !== exerciseId);
    }

    deleteNutritionMetric(metricId: string): void {
      this.nutritionMetrics = this.nutritionMetrics.filter(
        (metric) => metric.id !== metricId
      );
    }

    snapshot(): MockSnapshot {
      return {
        exercises: this.exercises.map(cloneExerciseRow),
        nutritionMetrics: this.nutritionMetrics.map(cloneNutritionMetricRow),
      };
    }

    private restore(snapshot: MockSnapshot): void {
      this.exercises = snapshot.exercises.map(cloneExerciseRow);
      this.nutritionMetrics = snapshot.nutritionMetrics.map(cloneNutritionMetricRow);
    }
  }

  return {
    openDatabaseAsync: async (databaseName = 'habit.db') =>
      getDatabase(databaseName),
    __deleteExercise: (databaseName: string, exerciseId: string) => {
      getDatabase(databaseName).deleteExercise(exerciseId);
    },
    __deleteNutritionMetric: (databaseName: string, metricId: string) => {
      getDatabase(databaseName).deleteNutritionMetric(metricId);
    },
    __getSnapshot: (databaseName = 'habit.db') =>
      getDatabase(databaseName).snapshot(),
    __resetDatabase: (databaseName: string) => {
      databases.set(databaseName, new MockSQLiteDatabase());
    },
  };

  function getDatabase(databaseName: string): MockSQLiteDatabase {
    let database = databases.get(databaseName);

    if (!database) {
      database = new MockSQLiteDatabase();
      databases.set(databaseName, database);
    }

    return database;
  }

  function readExerciseParams(params: MockBindValue[]): MockExerciseRow {
    return {
      id: readStringParam(params, 0, 'id'),
      userId: readNullableStringParam(params, 1, 'userId'),
      name: readStringParam(params, 2, 'name'),
      category: readStringParam(params, 3, 'category'),
      setMode: readStringParam(params, 4, 'setMode'),
      loadType: readStringParam(params, 5, 'loadType'),
      muscleGroupsPrimary: readStringParam(params, 6, 'muscleGroupsPrimary'),
      muscleGroupsSecondary: readStringParam(params, 7, 'muscleGroupsSecondary'),
      equipment: readNullableStringParam(params, 8, 'equipment'),
      attributes: '[]',
      deletedAt: null,
    };
  }

  function readNutritionMetricParams(
    params: MockBindValue[]
  ): MockNutritionMetricRow {
    return {
      id: readStringParam(params, 0, 'id'),
      userId: readNullableStringParam(params, 1, 'userId'),
      name: readStringParam(params, 2, 'name'),
      unit: readStringParam(params, 3, 'unit'),
      isSeeded: readNumberParam(params, 4, 'isSeeded'),
      displayOrder: readNumberParam(params, 5, 'displayOrder'),
      deletedAt: null,
    };
  }

  function cloneExerciseRow(row: MockExerciseRow): MockExerciseRow {
    return { ...row };
  }

  function cloneNutritionMetricRow(
    row: MockNutritionMetricRow
  ): MockNutritionMetricRow {
    return { ...row };
  }

  function readStringParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): string {
    const value = params[index];

    if (typeof value !== 'string') {
      throw new Error(`Expected ${label} to be a string.`);
    }

    return value;
  }

  function readNullableStringParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): string | null {
    const value = params[index];

    if (value === null || typeof value === 'string') {
      return value;
    }

    throw new Error(`Expected ${label} to be a string or null.`);
  }

  function readNumberParam(
    params: MockBindValue[],
    index: number,
    label: string
  ): number {
    const value = params[index];

    if (typeof value !== 'number') {
      throw new Error(`Expected ${label} to be a number.`);
    }

    return value;
  }
});

const sqlite = jest.requireMock('expo-sqlite') as MockSqliteControls;

describe('seedBuiltInData', () => {
  beforeEach(async () => {
    sqlite.__resetDatabase(':memory:');
    await runMigrations(':memory:');
  });

  it('seeds built-in exercises and nutrition metrics on a fresh database', async () => {
    await seedBuiltInData();

    const snapshot = sqlite.__getSnapshot(':memory:');

    expect(snapshot.exercises).toHaveLength(76);
    expect(snapshot.nutritionMetrics).toHaveLength(9);
    expect(new Set(snapshot.exercises.map((row) => row.id)).size).toBe(76);
    expect(new Set(snapshot.nutritionMetrics.map((row) => row.id)).size).toBe(9);
    expect(snapshot.exercises.every((row) => row.userId === null)).toBe(true);
    expect(snapshot.exercises.every((row) => row.attributes === '[]')).toBe(true);
    expect(snapshot.exercises.every((row) => row.deletedAt === null)).toBe(true);
    expect(snapshot.nutritionMetrics.every((row) => row.userId === null)).toBe(true);
    expect(snapshot.nutritionMetrics.every((row) => row.isSeeded === 1)).toBe(true);
    expect(snapshot.nutritionMetrics.every((row) => row.deletedAt === null)).toBe(
      true
    );
    expect(snapshot.nutritionMetrics.map((row) => row.id)).toEqual([
      'seed-nutrition-calories',
      'seed-nutrition-protein',
      'seed-nutrition-carbs',
      'seed-nutrition-fat',
      'seed-nutrition-fiber',
      'seed-nutrition-sugar',
      'seed-nutrition-sodium',
      'seed-nutrition-saturated-fat',
      'seed-nutrition-cholesterol',
    ]);
    expect(snapshot.nutritionMetrics.map((row) => row.unit)).toEqual([
      'kcal',
      'g',
      'g',
      'g',
      'g',
      'g',
      'mg',
      'g',
      'mg',
    ]);
    expect(snapshot.nutritionMetrics.map((row) => row.displayOrder)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('uses only valid enum values and includes required workout-player variety', async () => {
    await seedBuiltInData();

    const snapshot = sqlite.__getSnapshot(':memory:');
    const muscleGroups = new Set(Object.values(MuscleGroup));
    const loadTypes = new Set(Object.values(LoadType));
    const equipmentTypes = new Set(Object.values(EquipmentType));

    for (const exercise of snapshot.exercises) {
      expect(exercise.category).toBe('workout');
      expect(['reps', 'duration']).toContain(exercise.setMode);
      expect(loadTypes.has(exercise.loadType as LoadType)).toBe(true);
      expect(equipmentTypes.has(exercise.equipment as EquipmentType)).toBe(true);

      for (const muscleGroup of readStringArray(exercise.muscleGroupsPrimary)) {
        expect(muscleGroups.has(muscleGroup as MuscleGroup)).toBe(true);
      }

      for (const muscleGroup of readStringArray(exercise.muscleGroupsSecondary)) {
        expect(muscleGroups.has(muscleGroup as MuscleGroup)).toBe(true);
      }
    }

    expect(snapshot.exercises.some((row) => row.setMode === 'duration')).toBe(true);
    expect(
      snapshot.exercises.some((row) => row.loadType === LoadType.BODYWEIGHT)
    ).toBe(true);
    expect(snapshot.exercises.some((row) => row.loadType === LoadType.ASSISTED)).toBe(
      true
    );
    expect(
      snapshot.exercises.some((row) =>
        readStringArray(row.muscleGroupsPrimary).includes(MuscleGroup.FULL_BODY)
      )
    ).toBe(true);
  });

  it('skips existing seed IDs without overwriting them', async () => {
    await getDb().runAsync(
      `INSERT INTO Exercise (
        id, userId, name, category, setMode, loadType,
        muscleGroupsPrimary, muscleGroupsSecondary, equipment
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'seed-plank',
      null,
      'Custom Plank Name',
      'workout',
      'duration',
      LoadType.BODYWEIGHT,
      JSON.stringify([MuscleGroup.CORE]),
      JSON.stringify([]),
      EquipmentType.BODYWEIGHT
    );
    await getDb().runAsync(
      `INSERT INTO NutritionMetric (
        id, userId, name, unit, isSeeded, displayOrder
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      'seed-nutrition-calories',
      null,
      'Custom Calories Name',
      'kcal',
      0,
      99
    );

    await seedBuiltInData();

    const snapshot = sqlite.__getSnapshot(':memory:');
    const plank = snapshot.exercises.find((row) => row.id === 'seed-plank');
    const calories = snapshot.nutritionMetrics.find(
      (row) => row.id === 'seed-nutrition-calories'
    );

    expect(snapshot.exercises).toHaveLength(76);
    expect(snapshot.nutritionMetrics).toHaveLength(9);
    expect(plank?.name).toBe('Custom Plank Name');
    expect(calories?.name).toBe('Custom Calories Name');
    expect(calories?.isSeeded).toBe(0);
    expect(calories?.displayOrder).toBe(99);
  });

  it('is idempotent and restores missing seed rows without duplicating existing rows', async () => {
    await seedBuiltInData();
    const seeded = sqlite.__getSnapshot(':memory:');

    await seedBuiltInData();
    expect(sqlite.__getSnapshot(':memory:')).toEqual(seeded);

    sqlite.__deleteExercise(':memory:', 'seed-plank');
    sqlite.__deleteNutritionMetric(':memory:', 'seed-nutrition-fiber');

    await seedBuiltInData();
    const reseeded = sqlite.__getSnapshot(':memory:');

    expect(reseeded.exercises).toHaveLength(76);
    expect(reseeded.nutritionMetrics).toHaveLength(9);
    expect(reseeded.exercises.filter((row) => row.id === 'seed-plank')).toHaveLength(
      1
    );
    expect(
      reseeded.nutritionMetrics.filter((row) => row.id === 'seed-nutrition-fiber')
    ).toHaveLength(1);
  });
});

function readStringArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array.');
  }

  return parsed.map((item) => {
    if (typeof item !== 'string') {
      throw new Error('Expected string array item.');
    }

    return item;
  });
}
