import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';
import { ProfileProvider, useProfile } from '@/lib/profile';
import { ConfigProvider } from '@/lib/config';
import { ThemeProvider, useTheme, type ThemePreference } from '@/lib/theme';
import { Loading } from '@/components/ui/Feedback';

/** Signed-out visitors land on Welcome; guards redirect signed-in users onward. */
export const unstable_settings = { initialRouteName: 'welcome' };

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <Shell />
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { user, initializing } = useAuth();
  useEffect(() => {
    if (!initializing) void SplashScreen.hideAsync().catch(() => undefined);
  }, [initializing]);
  if (initializing) return <ThemeProvider preference="dark"><Boot /></ThemeProvider>;
  if (!user) {
    return (
      <ThemeProvider preference="dark">
        <Navigator signedIn={false} onboarded={false} />
      </ThemeProvider>
    );
  }
  return (
    <ProfileProvider>
      <SignedInShell />
    </ProfileProvider>
  );
}

function SignedInShell() {
  const { profile, loading } = useProfile();
  return (
    <ThemeProvider preference={(profile?.theme as ThemePreference) ?? 'dark'}>
      <ConfigProvider>{loading ? <Boot /> : <Navigator signedIn onboarded={Boolean(profile?.onboardingCompletedAt)} />}</ConfigProvider>
    </ThemeProvider>
  );
}

function Boot() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
      <Loading label="Loading FORMA…" />
    </View>
  );
}

/** Route guards: signed-out, onboarding and app screens are mutually exclusive. */
function Navigator({ signedIn, onboarded }: { signedIn: boolean; onboarded: boolean }) {
  const { c, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
