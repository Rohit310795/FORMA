import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

const PILLARS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'barbell-outline', label: 'Training plans & live logging' },
  { icon: 'nutrition-outline', label: 'Nutrition, sleep & hydration' },
  { icon: 'pulse-outline', label: 'Recovery & joint health' },
  { icon: 'sparkles-outline', label: 'An AI coach you control' },
];

export default function Welcome() {
  const { c } = useTheme();
  return (
    <LinearGradient colors={['#1B1638', c.background, c.background]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'space-between', maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={{ marginTop: 48, gap: 12 }}>
          <Text variant="overline" tone="primary">Welcome to</Text>
          <Text variant="display" style={{ fontSize: 52, letterSpacing: 6 }} accessibilityRole="header">FORMA</Text>
          <Text variant="heading" tone="muted">Stronger today. Brighter tomorrow.</Text>
          <Text variant="body" tone="muted" style={{ marginTop: 8 }}>
            Your personal trainer, tracker and wellness coach in one calm, private place.
          </Text>
        </View>
        <View style={{ gap: 14 }}>
          {PILLARS.map((p) => (
            <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={p.icon} size={20} color={c.primary} />
              </View>
              <Text variant="label">{p.label}</Text>
            </View>
          ))}
        </View>
        <View style={{ gap: 12, marginBottom: 12 }}>
          <Button label="Get started" testID="get-started" onPress={() => router.push('/sign-up')} />
          <Button label="I already have an account" variant="ghost" onPress={() => router.push('/sign-in')} />
          <Text variant="caption" tone="subtle" style={{ textAlign: 'center' }}>
            FORMA supports fitness and wellness. It does not diagnose or treat medical conditions.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
