import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Header } from '../../components/shared/Header';
import { colors, spacing, typography } from '../../constants/theme';

export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Header
        title="Today"
        rightIcon="settings-outline"
        onRightPress={() => router.push('/settings')}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.placeholder}>Today's activity will appear here.</Text>
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
