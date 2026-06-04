import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';

interface TodaySectionProps {
  title: string;
  children: React.ReactNode;
}

export function TodaySection({ title, children }: TodaySectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[3],
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondaryLight,
    textTransform: 'uppercase',
  },
});
