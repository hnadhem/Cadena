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
import { useUserStore } from '../../store/userStore';
import { formatDateLabelInTimezone } from '../../utils/dateUtils';

interface FitnessNavTileConfig {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: RelativePathString;
}

const FITNESS_TILES: FitnessNavTileConfig[] = [
  {
    title: 'Stats',
    icon: 'stats-chart-outline',
    route: '../fitness/stats',
  },
  {
    title: 'Goals & PRs',
    icon: 'radio-button-on-outline',
    route: '../fitness/goals',
  },
  {
    title: 'Routines',
    icon: 'list-outline',
    route: '../fitness/routines',
  },
  {
    title: 'Metrics',
    icon: 'trending-up-outline',
    route: '../fitness/metrics',
  },
];

export default function FitnessScreen() {
  const timezone = useUserStore((state) => state.timezone);
  const dateLabel = formatDateLabelInTimezone(new Date(), timezone);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Fitness</Text>
          <Text style={styles.subtitle}>{dateLabel}</Text>
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
        <TrainingCard dateLabel={dateLabel} />
        <View style={styles.tileGrid}>
          {FITNESS_TILES.map((tile) => (
            <FitnessNavTile key={tile.title} tile={tile} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TrainingCard({ dateLabel }: { dateLabel: string }) {
  return (
    <Pressable
      onPress={() => router.push('../fitness/activity')}
      style={({ pressed }) => [styles.trainingCard, pressed && styles.pressed]}
    >
      <Text style={styles.trainingTitle}>Training</Text>
      <Text style={styles.trainingDate}>{dateLabel}</Text>

      <View style={styles.activityList}>
        <ActivityRow label="Back / Bi" muted />
        <ActivityRow label="5 km Run" />
      </View>
    </Pressable>
  );
}

function ActivityRow({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityMarker, muted && styles.mutedMarker]} />
      <Text style={[styles.activityText, muted && styles.mutedActivityText]}>{label}</Text>
    </View>
  );
}

function FitnessNavTile({ tile }: { tile: FitnessNavTileConfig }) {
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
    gap: spacing[1],
  },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.heavy,
    color: colors.textPrimaryLight,
  },
  subtitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.medium,
    color: colors.textTertiaryLight,
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
  trainingCard: {
    minHeight: 152,
    padding: spacing[5],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  trainingTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  trainingDate: {
    marginTop: spacing[1],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.medium,
    color: colors.textTertiaryLight,
  },
  activityList: {
    marginTop: spacing[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral300,
  },
  activityRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral300,
  },
  activityMarker: {
    width: 3,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.neutral700,
  },
  mutedMarker: {
    backgroundColor: colors.neutral300,
  },
  activityText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimaryLight,
  },
  mutedActivityText: {
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
