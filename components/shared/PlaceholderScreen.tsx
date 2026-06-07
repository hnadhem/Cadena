import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';

interface PlaceholderScreenProps {
  title: string;
  message: string;
  detail?: string;
}

export function PlaceholderScreen({ title, message, detail }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    gap: spacing[3],
    padding: spacing[4],
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimaryLight,
  },
  message: {
    fontSize: typography.size.base,
    color: colors.textSecondaryLight,
    lineHeight: typography.size.base * typography.lineHeight.normal,
  },
  detail: {
    fontSize: typography.size.sm,
    color: colors.textTertiaryLight,
  },
});
