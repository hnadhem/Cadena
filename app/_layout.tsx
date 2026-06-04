import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { runMigrations } from '../services/db';
import { colors } from '../constants/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    runMigrations()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Migration failed:', err);
      });
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand600} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },
});
