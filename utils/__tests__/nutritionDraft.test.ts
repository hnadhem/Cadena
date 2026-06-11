import { describe, expect, it } from '@jest/globals';
import {
  addNutritionMetricValues,
  adjustNutritionMetricValue,
  createEmptyNutritionMetricValues,
  getNutritionProgressPercent,
  getSavedFoodMetricValues,
  SEEDED_NUTRITION_FOODS,
  subtractNutritionMetricValues,
} from '../nutritionDraft';

describe('nutritionDraft', () => {
  it('adjusts one metric while leaving the others intact', () => {
    const values = createEmptyNutritionMetricValues();
    const adjusted = adjustNutritionMetricValue(values, 'protein', 25);

    expect(adjusted).toEqual({
      calories: 0,
      protein: 25,
      carbs: 0,
      fat: 0,
    });
  });

  it('does not step a metric below zero', () => {
    const adjusted = adjustNutritionMetricValue(
      createEmptyNutritionMetricValues(),
      'calories',
      -50
    );

    expect(adjusted.calories).toBe(0);
  });

  it('adds seeded food metrics into the draft totals', () => {
    const food = SEEDED_NUTRITION_FOODS.find(
      (candidate) => candidate.id === 'protein-shake'
    );

    if (!food) {
      throw new Error('Seeded food was not found.');
    }

    const values = addNutritionMetricValues(
      createEmptyNutritionMetricValues(),
      getSavedFoodMetricValues(food)
    );

    expect(values).toEqual({
      calories: 210,
      protein: 30,
      carbs: 12,
      fat: 4,
    });
  });

  it('subtracts food metrics without producing negative totals', () => {
    const values = subtractNutritionMetricValues(
      {
        calories: 100,
        protein: 5,
        carbs: 4,
        fat: 3,
      },
      {
        calories: 210,
        protein: 30,
        carbs: 12,
        fat: 4,
      }
    );

    expect(values).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it('clamps progress between 0 and 100', () => {
    expect(getNutritionProgressPercent(50, 100)).toBe(50);
    expect(getNutritionProgressPercent(150, 100)).toBe(100);
    expect(getNutritionProgressPercent(-5, 100)).toBe(0);
    expect(getNutritionProgressPercent(5, 0)).toBe(0);
  });
});
