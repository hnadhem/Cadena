import React from 'react';
import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
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

interface HabitsNavTileConfig {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: RelativePathString;
}

const HABITS_TILES: HabitsNavTileConfig[] = [
  {
    title: 'My Habits',
    icon: 'checkmark-circle-outline',
    route: '../habits/manage',
  },
  {
    title: 'Progress',
    icon: 'bar-chart-outline',
    route: '../habits/progress',
  },
  {
    title: 'Nutrition & Meds',
    icon: 'restaurant-outline',
    route: '../habits/nutrition',
  },
  {
    title: 'Tally',
    icon: 'add-circle-outline',
    route: '../habits/tally',
  },
];

export default function HabitsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Habits</Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={32} color={colors.neutral500} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <WeeklyHabitsCard />
        <View style={styles.tileGrid}>
          {HABITS_TILES.map((tile) => (
            <HabitsNavTile key={tile.title} tile={tile} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WeeklyHabitsCard() {
  return (
    <Pressable
      onPress={() => router.push('../habits/weekly')}
      style={({ pressed }) => [styles.weeklyCard, pressed && styles.pressed]}
    >
      <Text style={styles.weeklyTitle}>Habits this week</Text>
      <View style={styles.habitList}>
        <HabitDueRow title="Wake up early" dueText="due in 2 days" />
        <HabitDueRow title="Meal prep" dueText="due in 4 days" />
      </View>
    </Pressable>
  );
}

function HabitDueRow({ title, dueText }: { title: string; dueText: string }) {
  return (
    <View style={styles.habitRow}>
      <View style={styles.habitMarker} />
      <Text style={styles.habitTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.dueText}>{dueText}</Text>
    </View>
  );
}

function HabitsNavTile({ tile }: { tile: HabitsNavTileConfig }) {
  return (
    <Pressable
      onPress={() => router.push(tile.route)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Ionicons name={tile.icon} size={32} color={colors.neutral500} />
      <Text style={styles.tileLabel}>{tile.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    minHeight: 128,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
  },
  headerSide: {
    width: 48,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.heavy,
    color: colors.textPrimaryLight,
  },
  settingsButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: spacing[5],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[12],
  },
  weeklyCard: {
    minHeight: 144,
    padding: spacing[5],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  weeklyTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  habitList: {
    marginTop: spacing[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral300,
  },
  habitRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral300,
  },
  habitMarker: {
    width: 3,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.activity.habit,
  },
  habitTitle: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  dueText: {
    flexShrink: 0,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textTertiaryLight,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    aspectRatio: 0.82,
    minHeight: 196,
    justifyContent: 'space-between',
    padding: spacing[5],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  tileLabel: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  pressed: {
    opacity: 0.75,
  },
});
