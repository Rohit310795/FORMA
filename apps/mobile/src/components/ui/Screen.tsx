import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { Text } from './Text';

interface Props {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
  footer?: ReactNode;
}

/** Standard screen: safe area, optional back header, scrollable content, max width for tablets/web. */
export function Screen({ title, subtitle, back, right, children, scroll = true, onRefresh, refreshing = false, contentStyle, footer }: Props) {
  const { c, spacing } = useTheme();
  const header =
    title || back ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm }}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {title ? (
            <Text variant={back ? 'heading' : 'title'} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text variant="caption" tone="muted">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    ) : null;
  const inner = <View style={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg, width: '100%', maxWidth: 720, alignSelf: 'center' }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'left', 'right']}>
      {header}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}>
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
