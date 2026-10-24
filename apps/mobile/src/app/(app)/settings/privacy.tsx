import { useState } from 'react';
import { Platform, Share } from 'react-native';
import { AI_CONTEXT_CATEGORIES, AI_CONTEXT_LABELS, type AiContextCategory } from '@forma/shared';
import { useProfile } from '@/lib/profile';
import { useAuth } from '@/lib/auth';
import { api, apiErrorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Field, Toggle } from '@/components/ui/Controls';
import { Banner } from '@/components/ui/Feedback';

export default function Privacy() {
  const { profile, save } = useProfile();
  const { signOut } = useAuth();
  const consent = profile?.consent ?? { healthDetails: false, lifeStageContent: false, aiContext: [] as AiContextCategory[], analytics: false };
  const [busy, setBusy] = useState<string>();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string>();
  const setAi = (k: AiContextCategory, on: boolean) => save({ consent: { ...consent, aiContext: on ? [...consent.aiContext, k] : consent.aiContext.filter((x) => x !== k) } });

  const exportData = async () => {
    setBusy('export');
    setError(undefined);
    try {
      const data = await api.exportMyData({});
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `forma-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: 'FORMA data export', message: json });
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(undefined);
    }
  };

  const deleteAccount = async () => {
    setError(undefined);
    if (confirmText !== 'DELETE') return setError('Type DELETE to confirm.');
    if (!(await confirm('Delete your account?', 'This permanently deletes your profile, logs, photos and AI conversations. It can’t be undone.', 'Delete forever'))) return;
    setBusy('delete');
    try {
      await api.deleteMyAccount({ confirm: 'DELETE' });
      notify('Account deleted', 'Your account and data have been deleted.');
      await signOut().catch(() => undefined);
    } catch (e) {
      const reason = (e as { details?: { reason?: string } }).details?.reason;
      setError(reason === 'recent_login_required' ? 'For your security, sign out and sign back in, then try again within 10 minutes.' : apiErrorMessage(e));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Screen title="Privacy & data" back>
      <Banner tone="info" title="How FORMA uses your data">Your health and body data is used only to run FORMA for you. It is never sold or used for advertising. Administrators can’t see your logs, photos or conversations.</Banner>
      <Card style={{ gap: 8 }}>
        <Text variant="heading">AI Coach data sharing</Text>
        <Text variant="caption" tone="muted">Only categories you switch on are summarised and sent with an AI request. You can also narrow it per message in the Coach.</Text>
        {AI_CONTEXT_CATEGORIES.map((k) => (
          <Toggle
            key={k}
            label={AI_CONTEXT_LABELS[k]}
            description={k === 'discomfort' && !consent.healthDetails ? 'Requires health-detail storage below' : undefined}
            value={consent.aiContext.includes(k)}
            onChange={(v) => (k === 'discomfort' && !consent.healthDetails ? undefined : setAi(k, v))}
          />
        ))}
      </Card>
      <Card style={{ gap: 8 }}>
        <Text variant="heading">Sensitive details</Text>
        <Toggle label="Store discomfort logs and clinician notes" value={consent.healthDetails} onChange={(v) => save({ consent: { ...consent, healthDetails: v, aiContext: v ? consent.aiContext : consent.aiContext.filter((x) => x !== 'discomfort') } })} />
        <Text variant="caption" tone="subtle">Turning this off stops new entries. Existing entries remain until you delete them (Recovery → History) or delete your account.</Text>
        <Toggle label="Life-stage content (cycle, pregnancy, menopause)" value={consent.lifeStageContent} onChange={(v) => save({ consent: { ...consent, lifeStageContent: v } })} />
        <Toggle label="Anonymous usage analytics" value={consent.analytics} onChange={(v) => save({ consent: { ...consent, analytics: v } })} />
      </Card>
      <Card style={{ gap: 8 }}>
        <Text variant="heading">Apple Health</Text>
        <Text variant="caption" tone="muted">Disconnect in More → Health Sync. To revoke all access, open the Health app → Profile → Apps → FORMA.</Text>
      </Card>
      <Card style={{ gap: 8 }}>
        <Text variant="heading">Your data</Text>
        <Button label="Download my data (JSON)" icon="download-outline" variant="secondary" onPress={exportData} loading={busy === 'export'} />
      </Card>
      <Card style={{ gap: 8 }}>
        <Text variant="heading" tone="danger">Delete account</Text>
        <Text variant="caption" tone="muted">Permanently deletes your account, all logs, progress photos and AI conversations.</Text>
        <Field label="Type DELETE to confirm" value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />
        <Button label="Delete my account" variant="danger" onPress={deleteAccount} loading={busy === 'delete'} />
      </Card>
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Screen>
  );
}
