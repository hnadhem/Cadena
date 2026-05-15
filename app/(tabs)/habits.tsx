import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Header } from '../../components/shared/Header';
import { colors, spacing, typography } from '../../constants/theme';

export default function HabitsScreen() {
  return (
    <View style={styles.container}>
      <Header title="Habits" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.placeholder}>Habits and progress will appear here.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    padding: spacing[4],
  },
  placeholder: {
    fontSize: typography.size.base,
    color: colors.textSecondaryLight,
  },
});
