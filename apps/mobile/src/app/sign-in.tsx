import { useState } from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { SocialSignIn } from '@/components/SocialSignIn';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    if (!email.includes('@')) return setError('Enter the email address you signed up with.');
    if (!password) return setError('Please enter your password.');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Welcome back" subtitle="Sign in to continue" back>
      <SocialSignIn />
      <Field label="Email" testID="email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" testID="password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      {error ? <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label="Sign in" testID="sign-in-submit" onPress={submit} loading={busy} />
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Link href="/forgot-password" style={{ padding: 8 }}>
          <Text variant="label" tone="primary">Forgot password?</Text>
        </Link>
        <Text variant="caption" tone="muted" onPress={() => router.replace('/sign-up')}>
          New to FORMA? <Text variant="caption" tone="primary">Create an account</Text>
        </Text>
      </View>
    </Screen>
  );
}
