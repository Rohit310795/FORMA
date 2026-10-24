import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/lib/theme';
import { useFeature } from '@/lib/config';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName, focused: IconName) =>
  function TabIcon({ color, focused: isFocused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={isFocused ? focused : name} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  const { c } = useTheme();
  const coach = useFeature('aiCoach');
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSubtle,
        tabBarStyle: { backgroundColor: c.surfaceSunken, borderTopColor: c.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: icon('barbell-outline', 'barbell') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: icon('nutrition-outline', 'nutrition') }} />
      <Tabs.Screen name="coach" options={{ title: 'AI Coach', tabBarIcon: icon('sparkles-outline', 'sparkles'), tabBarBadge: coach.enabled ? undefined : '•' }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('grid-outline', 'grid') }} />
    </Tabs>
  );
}
