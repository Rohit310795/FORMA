import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Field, Toggle } from '@/components/ui/Controls';
import { SocialSignIn } from '@/components/SocialSignIn';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    if (!name.trim()) return setError('What should we call you?');
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (!agree) return setError('Please accept the Terms and Privacy Policy to continue.');
    setBusy(true);
    try {
      await signUp(email, password, name.trim());
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Create your account" subtitle="It takes about a minute" back>
      <SocialSignIn />
      <Field label="Preferred name" testID="name" value={name} onChangeText={setName} autoComplete="name" textContentType="givenName" />
      <Field label="Email" testID="email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" testID="password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters" />
      <Toggle
        testID="agree"
        label="I agree to the Terms and Privacy Policy"
        description="Your health and body data is private, never sold, and never used for advertising."
        value={agree}
        onChange={setAgree}
      />
      {env.privacyPolicyUrl || env.termsUrl ? (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {env.termsUrl ? <Text variant="caption" tone="primary" onPress={() => Linking.openURL(env.termsUrl)}>Terms</Text> : null}
          {env.privacyPolicyUrl ? <Text variant="caption" tone="primary" onPress={() => Linking.openURL(env.privacyPolicyUrl)}>Privacy Policy</Text> : null}
        </View>
      ) : null}
      {error ? <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label="Create account" testID="sign-up-submit" onPress={submit} loading={busy} />
      <Text variant="caption" tone="muted" style={{ textAlign: 'center' }} onPress={() => router.replace('/sign-in')}>
        Already have an account? <Text variant="caption" tone="primary">Sign in</Text>
      </Text>
    </Screen>
  );
}
