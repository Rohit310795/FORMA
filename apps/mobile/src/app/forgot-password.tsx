import { useState } from 'react';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Banner } from '@/components/ui/Feedback';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError(undefined);
    if (!email.includes('@')) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Don't reveal whether an account exists.
      if (code === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Reset password" back>
      <Text tone="muted">Enter your email and we’ll send a link to choose a new password.</Text>
      {sent ? (
        <Banner tone="success" title="Check your inbox">If an account exists for that address, a reset link is on its way.</Banner>
      ) : (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
          <Button label="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
    </Screen>
  );
}
