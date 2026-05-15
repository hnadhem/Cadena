import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Settings coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    padding: spacing[4],
  },
  placeholder: {
    fontSize: typography.size.base,
    color: colors.textSecondaryLight,
  },
});
