import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../constants/theme';
import { TodayQuickActionButton } from './TodayQuickActionButton';
import type { TodayQuickAction } from '../../types/today';

interface TodayQuickActionRowProps {
  actions: TodayQuickAction[];
  onActionPress?: (action: TodayQuickAction) => void;
}

export function TodayQuickActionRow({ actions, onActionPress }: TodayQuickActionRowProps) {
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <TodayQuickActionButton
          key={action.kind}
          action={action}
          onPress={onActionPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
});
