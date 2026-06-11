import React, { useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useUserStore } from '../../store/userStore';
import { formatDateLabelInTimezone } from '../../utils/dateUtils';
import {
  addNutritionMetricValues,
  adjustNutritionMetricValue,
  createEmptyNutritionMetricValues,
  formatNutritionValue,
  getNutritionProgressPercent,
  getSavedFoodMetricValues,
  NUTRITION_METRICS,
  SEEDED_NUTRITION_FOODS,
  subtractNutritionMetricValues,
  type NutritionLoggedFood,
  type NutritionMetricConfig,
  type NutritionMetricId,
  type NutritionMetricValues,
  type NutritionSavedFood,
} from '../../utils/nutritionDraft';

interface NutritionLoggerProps {
  routeTitle?: string;
}

const METRIC_ICONS: Record<NutritionMetricId, keyof typeof Ionicons.glyphMap> = {
  calories: 'flame-outline',
  protein: 'barbell-outline',
  carbs: 'restaurant-outline',
  fat: 'ellipse-outline',
};

export function NutritionLogger({ routeTitle = 'Nutrition' }: NutritionLoggerProps) {
  const timezone = useUserStore((state) => state.timezone);
  const dateLabel = formatDateLabelInTimezone(new Date(), timezone);
  const [metricValues, setMetricValues] = useState<NutritionMetricValues>(
    createEmptyNutritionMetricValues
  );
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [loggedFoods, setLoggedFoods] = useState<NutritionLoggedFood[]>([]);
  const loggedFoodCounter = useRef(0);

  const savedFoods = useMemo(
    () =>
      [...SEEDED_NUTRITION_FOODS].sort(
        (first, second) => first.displayOrder - second.displayOrder
      ),
    []
  );

  function handleMetricStep(metric: NutritionMetricConfig, direction: -1 | 1) {
    setMetricValues((currentValues) =>
      adjustNutritionMetricValue(
        currentValues,
        metric.id,
        metric.step * direction
      )
    );
  }

  function handleFoodAdd(food: NutritionSavedFood) {
    const foodMetrics = getSavedFoodMetricValues(food);
    const loggedAt = new Date().toISOString();
    loggedFoodCounter.current += 1;

    const loggedFood: NutritionLoggedFood = {
      id: `${food.id}-${loggedFoodCounter.current}`,
      foodId: food.id,
      name: food.name,
      servingLabel: food.servingLabel,
      metrics: foodMetrics,
      loggedAt,
    };

    setMetricValues((currentValues) =>
      addNutritionMetricValues(currentValues, foodMetrics)
    );
    setLoggedFoods((currentFoods) => [loggedFood, ...currentFoods]);
  }

  function handleFoodRemove(food: NutritionLoggedFood) {
    setMetricValues((currentValues) =>
      subtractNutritionMetricValues(currentValues, food.metrics)
    );
    setLoggedFoods((currentFoods) =>
      currentFoods.filter((currentFood) => currentFood.id !== food.id)
    );
  }

  function handleReset() {
    setMetricValues(createEmptyNutritionMetricValues());
    setLoggedFoods([]);
    setFoodPickerOpen(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: routeTitle }} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View>
            <Text style={styles.eyebrow}>{dateLabel}</Text>
            <Text style={styles.title}>Nutrition</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset nutrition draft"
            onPress={handleReset}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.textSecondaryLight} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Macros</Text>
          <View style={styles.metricList}>
            {NUTRITION_METRICS.map((metric) => (
              <MetricRow
                key={metric.id}
                metric={metric}
                value={metricValues[metric.id]}
                onStep={handleMetricStep}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: foodPickerOpen }}
            onPress={() => setFoodPickerOpen((open) => !open)}
            style={({ pressed }) => [
              styles.addFoodButton,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.addFoodLeft}>
              <Ionicons name="add-circle-outline" size={22} color={colors.textPrimaryLight} />
              <Text style={styles.addFoodLabel}>Add food</Text>
            </View>
            <Ionicons
              name={foodPickerOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textTertiaryLight}
            />
          </Pressable>

          {foodPickerOpen && (
            <View style={styles.foodList}>
              {savedFoods.map((food) => (
                <SavedFoodRow
                  key={food.id}
                  food={food}
                  onPress={handleFoodAdd}
                />
              ))}
            </View>
          )}
        </View>

        {loggedFoods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Food log</Text>
            <View style={styles.loggedFoodList}>
              {loggedFoods.map((food) => (
                <LoggedFoodRow
                  key={food.id}
                  food={food}
                  onRemove={handleFoodRemove}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricRow({
  metric,
  value,
  onStep,
}: {
  metric: NutritionMetricConfig;
  value: number;
  onStep: (metric: NutritionMetricConfig, direction: -1 | 1) => void;
}) {
  const progressPercent = getNutritionProgressPercent(value, metric.target);

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHead}>
        <View style={styles.metricTitleGroup}>
          <View style={styles.metricIcon}>
            <Ionicons
              name={METRIC_ICONS[metric.id]}
              size={17}
              color={colors.textSecondaryLight}
            />
          </View>
          <View style={styles.metricCopy}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricTarget}>
              {formatNutritionValue(metric.target)} {metric.unit}
            </Text>
          </View>
        </View>

        <View style={styles.stepper}>
          <StepperButton
            accessibilityLabel={`Decrease ${metric.label}`}
            icon="remove"
            onPress={() => onStep(metric, -1)}
          />
          <View style={styles.valueGroup}>
            <Text style={styles.metricValue}>{formatNutritionValue(value)}</Text>
            <Text style={styles.metricUnit}>{metric.unit}</Text>
          </View>
          <StepperButton
            accessibilityLabel={`Increase ${metric.label}`}
            icon="add"
            onPress={() => onStep(metric, 1)}
          />
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressPercent}%` },
          ]}
        />
      </View>
    </View>
  );
}

function StepperButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: 'add' | 'remove';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.stepperButton,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.textPrimaryLight} />
    </Pressable>
  );
}

function SavedFoodRow({
  food,
  onPress,
}: {
  food: NutritionSavedFood;
  onPress: (food: NutritionSavedFood) => void;
}) {
  const metrics = getSavedFoodMetricValues(food);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${food.name}`}
      onPress={() => onPress(food)}
      style={({ pressed }) => [
        styles.foodRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.foodText}>
        <Text style={styles.foodName} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.foodServing}>{food.servingLabel}</Text>
      </View>
      <View style={styles.foodMetrics}>
        <Text style={styles.foodCalories}>
          {formatNutritionValue(metrics.calories)} kcal
        </Text>
        <Text style={styles.foodMacroLine}>
          P {formatNutritionValue(metrics.protein)} · C{' '}
          {formatNutritionValue(metrics.carbs)} · F{' '}
          {formatNutritionValue(metrics.fat)}
        </Text>
      </View>
    </Pressable>
  );
}

function LoggedFoodRow({
  food,
  onRemove,
}: {
  food: NutritionLoggedFood;
  onRemove: (food: NutritionLoggedFood) => void;
}) {
  return (
    <View style={styles.loggedFoodRow}>
      <View style={styles.foodText}>
        <Text style={styles.foodName} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.foodServing}>{food.servingLabel}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${food.name}`}
        onPress={() => onRemove(food)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.removeButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="close" size={18} color={colors.textSecondaryLight} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    gap: spacing[5],
    padding: spacing[5],
    paddingBottom: spacing[12],
  },
  hero: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  eyebrow: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textTertiaryLight,
  },
  title: {
    marginTop: spacing[1],
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.heavy,
    color: colors.textPrimaryLight,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  section: {
    gap: spacing[3],
  },
  sectionLabel: {
    paddingHorizontal: spacing[1],
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textTertiaryLight,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metricList: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  metricRow: {
    gap: spacing[3],
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  metricHead: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  metricTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  metricIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  metricTarget: {
    marginTop: spacing[1],
    fontSize: typography.size.sm,
    color: colors.textTertiaryLight,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  stepperButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
  },
  valueGroup: {
    width: 76,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    marginTop: -2,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textTertiaryLight,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.neutral200,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.neutral800,
  },
  addFoodButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  addFoodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  addFoodLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  foodList: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  foodRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  foodText: {
    flex: 1,
    minWidth: 0,
  },
  foodName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  foodServing: {
    marginTop: spacing[1],
    fontSize: typography.size.sm,
    color: colors.textTertiaryLight,
  },
  foodMetrics: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  foodCalories: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondaryLight,
  },
  foodMacroLine: {
    marginTop: spacing[1],
    fontSize: typography.size.xs,
    color: colors.textTertiaryLight,
  },
  loggedFoodList: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  loggedFoodRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  removeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral100,
  },
  pressed: {
    opacity: 0.72,
  },
});
