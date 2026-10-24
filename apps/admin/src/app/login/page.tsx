'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Field, Notice } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/admin');
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.' : code === 'auth/multi-factor-auth-required' ? 'This account uses two-step verification. Complete it with a supported client (see docs/SECURITY.md).' : 'Email or password is incorrect.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <form className="card stack" onSubmit={submit} aria-labelledby="login-title">
        <div className="brand" style={{ padding: 0 }}>FORMA<span>ADMIN CONSOLE</span></div>
        <h1 id="login-title">Sign in</h1>
        <p className="muted" style={{ margin: 0 }}>Access is limited to accounts with an admin role. There is no public sign-up.</p>
        <Field label="Email"><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="admin-email" /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="admin-password" /></Field>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {info ? <Notice tone="ok">{info}</Notice> : null}
        <button className="btn primary" type="submit" disabled={busy} data-testid="admin-sign-in">{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="btn sm" onClick={async () => { if (!email) return setError('Enter your email first.'); await sendPasswordResetEmail(auth, email.trim()).catch(() => undefined); setInfo('If that account exists, a reset email is on its way.'); }}>Forgot password</button>
      </form>
    </div>
  );
}
