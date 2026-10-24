import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

/** All signed-in, onboarded screens. Protected as a group by the root layout. */
export default function AppLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="session/[id]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
