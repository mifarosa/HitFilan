import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import '@/shared'; // installs the storage adapter before any screen reads settings
import { cancelCues } from '@/engine/notifications';
import { colors } from '@/theme';

export default function RootLayout() {
  // Cues of an earlier session (the app was closed or crashed during a workout) must not keep firing.
  useEffect(() => { cancelCues(); }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
    </>
  );
}
