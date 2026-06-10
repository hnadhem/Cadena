import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../constants/theme';
import { TodayQuickActionButton } from './TodayQuickActionButton';
import type { TodayQuickAction, TodayQuickActionKind } from '../../types/today';

interface TodayQuickActionRowProps {
  actions: TodayQuickAction[];
  checkedActionKinds?: readonly TodayQuickActionKind[];
  onActionPress?: (action: TodayQuickAction) => void;
}

export function TodayQuickActionRow({
  actions,
  checkedActionKinds = [],
  onActionPress,
}: TodayQuickActionRowProps) {
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <TodayQuickActionButton
          key={action.kind}
          action={action}
          isChecked={checkedActionKinds.includes(action.kind)}
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
