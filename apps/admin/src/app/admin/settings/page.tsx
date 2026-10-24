'use client';
import { useState } from 'react';
import { REMINDER_CATEGORIES, type AppSettings } from '@forma/shared';
import { useSession } from '@/lib/session';
import { Card, Field, Loading, Notice, PageHeader, Switch, useAction, useAdmin } from '@/components/ui';

export default function SettingsPage() {
  const { data, error, loading } = useAdmin<AppSettings>('settings.get');
  if (loading && !data) return <Loading />;
  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!data) return null;
  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: AppSettings }) {
  const { can } = useSession();
  const plans = useAdmin<{ id: string; name: string }[]>('plans.list');
  const [s, setS] = useState<AppSettings>(initial);
  const { run, busy, message } = useAction();
  const set = (patch: Partial<AppSettings>) => setS({ ...s, ...patch });
  const ann = s.announcement ?? { id: 'main', title: '', body: '', level: 'info' as const, active: false };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="App Settings" subtitle="Public-facing configuration delivered to the app by the server." />
      <form className="stack" style={{ gap: 20 }} onSubmit={(e) => { e.preventDefault(); void run('settings.update', s, 'Settings saved. Apps pick them up within a few minutes.'); }}>
        <fieldset disabled={!can('settings.write')} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <Card title="Announcement">
            <div className="stack">
              <Switch label="Show announcement" checked={ann.active} onChange={(v) => set({ announcement: { ...ann, active: v } })} />
              <div className="grid cols-2">
                <Field label="Title"><input value={ann.title} onChange={(e) => set({ announcement: { ...ann, title: e.target.value } })} /></Field>
                <Field label="Level"><select value={ann.level} onChange={(e) => set({ announcement: { ...ann, level: e.target.value as 'info' | 'warning' } })}><option value="info">Info</option><option value="warning">Warning</option></select></Field>
              </div>
              <Field label="Message"><textarea rows={3} style={{ fontFamily: 'inherit' }} value={ann.body} onChange={(e) => set({ announcement: { ...ann, body: e.target.value } })} /></Field>
            </div>
          </Card>
          <Card title="Maintenance">
            <div className="stack">
              <Switch label="Show maintenance banner" checked={s.maintenance.active} onChange={(v) => set({ maintenance: { ...s.maintenance, active: v } })} />
              <Field label="Message"><input value={s.maintenance.message} onChange={(e) => set({ maintenance: { ...s.maintenance, message: e.target.value } })} /></Field>
            </div>
          </Card>
          <Card title="Defaults & support">
            <div className="grid cols-4">
              <Field label="Default units"><select value={s.defaultUnits} onChange={(e) => set({ defaultUnits: e.target.value as AppSettings['defaultUnits'] })}><option value="metric">Metric</option><option value="imperial">Imperial</option></select></Field>
              <Field label="Default locale"><input value={s.defaultLocale} onChange={(e) => set({ defaultLocale: e.target.value })} /></Field>
              <Field label="Default time zone"><input value={s.defaultTimeZone} onChange={(e) => set({ defaultTimeZone: e.target.value })} /></Field>
              <Field label="Default plan for new users"><select value={s.defaultPlanId} onChange={(e) => set({ defaultPlanId: e.target.value })}>{plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Default session length (min)"><input type="number" min={10} max={180} value={s.onboardingDefaults.sessionMinutes} onChange={(e) => set({ onboardingDefaults: { sessionMinutes: Number(e.target.value) } })} /></Field>
              <Field label="Support email"><input type="email" value={s.supportEmail ?? ''} onChange={(e) => set({ supportEmail: e.target.value || undefined })} /></Field>
              <Field label="Support URL"><input type="url" value={s.supportUrl ?? ''} onChange={(e) => set({ supportUrl: e.target.value || undefined })} /></Field>
            </div>
          </Card>
          <Card title="Notification templates">
            <p className="subtle">Used only when a user opts in to detailed lock-screen text. Keep health details out of these.</p>
            <div className="grid cols-2">
              {REMINDER_CATEGORIES.map((c) => (
                <div key={c} className="stack">
                  <strong style={{ textTransform: 'capitalize' }}>{c}</strong>
                  <Field label="Title"><input value={s.notificationTemplates[c]?.title ?? ''} onChange={(e) => set({ notificationTemplates: { ...s.notificationTemplates, [c]: { title: e.target.value, body: s.notificationTemplates[c]?.body ?? '' } } })} /></Field>
                  <Field label="Body"><input value={s.notificationTemplates[c]?.body ?? ''} onChange={(e) => set({ notificationTemplates: { ...s.notificationTemplates, [c]: { title: s.notificationTemplates[c]?.title ?? '', body: e.target.value } } })} /></Field>
                </div>
              ))}
            </div>
          </Card>
        </fieldset>
        {message}
        {can('settings.write') ? <button className="btn primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>Save settings</button> : null}
      </form>
    </div>
  );
}
