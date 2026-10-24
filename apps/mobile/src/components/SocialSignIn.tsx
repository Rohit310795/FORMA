import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

WebBrowser.maybeCompleteAuthSession();

/** Apple and Google buttons appear only where the provider is actually configured. */
export function SocialSignIn() {
  const { signInWithApple, signInWithGoogleWeb } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string>();
  const nativeGoogle = Platform.OS !== 'web' && Boolean(Platform.OS === 'ios' ? env.googleIosClientId : env.googleAndroidClientId);
  const webGoogle = Platform.OS === 'web' && !env.useEmulators && Boolean(env.googleWebClientId);

  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = (fn: () => Promise<void>) => async () => {
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  if (!appleAvailable && !nativeGoogle && !webGoogle) return null;
  return (
    <View style={{ gap: 10 }}>
      {appleAvailable ? <Button label="Continue with Apple" icon="logo-apple" variant="secondary" onPress={run(signInWithApple)} /> : null}
      {webGoogle ? <Button label="Continue with Google" icon="logo-google" variant="secondary" onPress={run(signInWithGoogleWeb)} /> : null}
      {nativeGoogle ? <NativeGoogle onError={setError} /> : null}
      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
    </View>
  );
}

function NativeGoogle({ onError }: { onError: (m: string) => void }) {
  const { signInWithGoogleIdToken } = useAuth();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: env.googleIosClientId || undefined,
    androidClientId: env.googleAndroidClientId || undefined,
    webClientId: env.googleWebClientId || undefined,
  });
  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      signInWithGoogleIdToken(response.params.id_token).catch((e) => onError(authErrorMessage(e)));
    }
  }, [response, signInWithGoogleIdToken, onError]);
  return <Button label="Continue with Google" icon="logo-google" variant="secondary" disabled={!request} onPress={() => void promptAsync()} />;
}
