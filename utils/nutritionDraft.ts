export type NutritionMetricId = 'calories' | 'protein' | 'carbs' | 'fat';

export type NutritionMetricValues = Record<NutritionMetricId, number>;

export interface NutritionMetricConfig {
  id: NutritionMetricId;
  label: string;
  unit: string;
  target: number;
  step: number;
  displayOrder: number;
}

export interface NutritionSavedFood {
  id: string;
  name: string;
  servingLabel: string;
  displayOrder: number;
  metrics: Partial<NutritionMetricValues>;
}

export interface NutritionLoggedFood {
  id: string;
  foodId: string;
  name: string;
  servingLabel: string;
  metrics: NutritionMetricValues;
  loggedAt: string;
}

export const NUTRITION_METRICS = [
  {
    id: 'calories',
    label: 'Calories',
    unit: 'kcal',
    target: 2200,
    step: 50,
    displayOrder: 0,
  },
  {
    id: 'protein',
    label: 'Protein',
    unit: 'g',
    target: 160,
    step: 5,
    displayOrder: 1,
  },
  {
    id: 'carbs',
    label: 'Carbs',
    unit: 'g',
    target: 240,
    step: 5,
    displayOrder: 2,
  },
  {
    id: 'fat',
    label: 'Fat',
    unit: 'g',
    target: 70,
    step: 5,
    displayOrder: 3,
  },
] as const satisfies readonly NutritionMetricConfig[];

export const SEEDED_NUTRITION_FOODS = [
  {
    id: 'greek-yogurt-bowl',
    name: 'Greek yogurt bowl',
    servingLabel: '1 bowl',
    displayOrder: 0,
    metrics: {
      calories: 340,
      protein: 32,
      carbs: 41,
      fat: 7,
    },
  },
  {
    id: 'chicken-rice-bowl',
    name: 'Chicken rice bowl',
    servingLabel: '1 bowl',
    displayOrder: 1,
    metrics: {
      calories: 620,
      protein: 48,
      carbs: 72,
      fat: 16,
    },
  },
  {
    id: 'protein-shake',
    name: 'Protein shake',
    servingLabel: '16 oz',
    displayOrder: 2,
    metrics: {
      calories: 210,
      protein: 30,
      carbs: 12,
      fat: 4,
    },
  },
  {
    id: 'avocado-toast',
    name: 'Avocado toast',
    servingLabel: '2 slices',
    displayOrder: 3,
    metrics: {
      calories: 430,
      protein: 14,
      carbs: 45,
      fat: 23,
    },
  },
] as const satisfies readonly NutritionSavedFood[];

const EMPTY_VALUES: NutritionMetricValues = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export function createEmptyNutritionMetricValues(): NutritionMetricValues {
  return { ...EMPTY_VALUES };
}

export function normalizeNutritionMetricValue(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.round(value * 10) / 10);
}

export function adjustNutritionMetricValue(
  values: NutritionMetricValues,
  metricId: NutritionMetricId,
  delta: number
): NutritionMetricValues {
  return {
    ...values,
    [metricId]: normalizeNutritionMetricValue(values[metricId] + delta),
  };
}

export function addNutritionMetricValues(
  currentValues: NutritionMetricValues,
  addedValues: Partial<NutritionMetricValues>
): NutritionMetricValues {
  return NUTRITION_METRICS.reduce<NutritionMetricValues>(
    (nextValues, metric) => ({
      ...nextValues,
      [metric.id]: normalizeNutritionMetricValue(
        nextValues[metric.id] + (addedValues[metric.id] ?? 0)
      ),
    }),
    { ...currentValues }
  );
}

export function subtractNutritionMetricValues(
  currentValues: NutritionMetricValues,
  removedValues: Partial<NutritionMetricValues>
): NutritionMetricValues {
  return NUTRITION_METRICS.reduce<NutritionMetricValues>(
    (nextValues, metric) => ({
      ...nextValues,
      [metric.id]: normalizeNutritionMetricValue(
        nextValues[metric.id] - (removedValues[metric.id] ?? 0)
      ),
    }),
    { ...currentValues }
  );
}

export function getSavedFoodMetricValues(
  food: NutritionSavedFood
): NutritionMetricValues {
  return NUTRITION_METRICS.reduce<NutritionMetricValues>(
    (values, metric) => ({
      ...values,
      [metric.id]: normalizeNutritionMetricValue(food.metrics[metric.id] ?? 0),
    }),
    createEmptyNutritionMetricValues()
  );
}

export function getNutritionProgressPercent(value: number, target: number): number {
  if (target <= 0) return 0;

  return Math.min(100, Math.max(0, (value / target) * 100));
}

export function formatNutritionValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
