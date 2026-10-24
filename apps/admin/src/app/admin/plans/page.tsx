'use client';
import { useState } from 'react';
import { FEATURE_KEYS, FEATURES, type Plan } from '@forma/shared';
import { useSession } from '@/lib/session';
import { Badge, Card, Field, Loading, Notice, PageHeader, Switch, useAction, useAdmin } from '@/components/ui';

export default function PlansPage() {
  const { can } = useSession();
  const { data, error, loading, reload } = useAdmin<Plan[]>('plans.list');
  const [editing, setEditing] = useState<Plan>();
  if (loading && !data) return <Loading />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Plans & Entitlements" subtitle="Define what each plan includes. Assign plans to people from Users." actions={can('plans.write') ? <button className="btn primary" onClick={() => setEditing({ id: '', name: '', features: [...FEATURE_KEYS].filter((k) => k !== 'premiumFeatures'), aiDailyRequests: 10, aiMonthlyRequests: 100, trialDays: 0, billing: 'test_mode', active: true })}>New plan</button> : null} />
      <Notice tone="warn">No payment provider is integrated yet, so all plans run in <strong>test mode</strong>: entitlements are granted by admins, and no one is charged. Connect a payment provider (e.g. RevenueCat / Stripe) before selling plans.</Notice>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {editing ? <PlanForm plan={editing} onDone={() => { setEditing(undefined); void reload(); }} /> : null}
      <div className="grid cols-2">
        {data?.map((p) => (
          <Card key={p.id} title={p.name} actions={<div className="row"><Badge>{p.billing === 'test_mode' ? 'test mode' : 'external billing'}</Badge>{p.active ? <Badge tone="ok">active</Badge> : <Badge>inactive</Badge>}{can('plans.write') ? <button className="btn sm" onClick={() => setEditing(p)}>Edit</button> : null}</div>}>
            <p className="muted">{p.description}</p>
            <p>AI: {p.aiDailyRequests}/day · {p.aiMonthlyRequests}/month{p.trialDays ? ` · ${p.trialDays}-day trial` : ''}</p>
            <div className="row">{p.features.map((f) => <Badge key={f}>{FEATURES[f].label}</Badge>)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PlanForm({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const [p, setP] = useState(plan);
  const { run, busy, message } = useAction();
  const set = (patch: Partial<Plan>) => setP((x) => ({ ...x, ...patch }));
  return (
    <Card title={plan.id ? `Edit ${plan.name}` : 'New plan'}>
      <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await run('plans.upsert', p, 'Plan saved.') !== undefined) onDone(); }}>
        <div className="grid cols-4">
          <Field label="ID"><input required pattern="[a-z0-9-]{2,30}" disabled={!!plan.id} value={p.id} onChange={(e) => set({ id: e.target.value })} /></Field>
          <Field label="Name"><input required value={p.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="AI requests / day"><input type="number" min={0} value={p.aiDailyRequests} onChange={(e) => set({ aiDailyRequests: Number(e.target.value) })} /></Field>
          <Field label="AI requests / month"><input type="number" min={0} value={p.aiMonthlyRequests} onChange={(e) => set({ aiMonthlyRequests: Number(e.target.value) })} /></Field>
          <Field label="Trial days"><input type="number" min={0} value={p.trialDays} onChange={(e) => set({ trialDays: Number(e.target.value) })} /></Field>
          <Field label="History limit (days)" hint="Blank = unlimited"><input type="number" min={0} value={p.historyDays ?? ''} onChange={(e) => set({ historyDays: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
        </div>
        <Field label="Description"><input value={p.description ?? ''} onChange={(e) => set({ description: e.target.value || undefined })} /></Field>
        <Switch label="Active" checked={p.active} onChange={(v) => set({ active: v })} />
        <div className="subtle">Included features</div>
        <div className="row">{FEATURE_KEYS.map((k) => <Switch key={k} label={FEATURES[k].label} checked={p.features.includes(k)} onChange={(v) => set({ features: v ? [...p.features, k] : p.features.filter((x) => x !== k) })} />)}</div>
        {message}
        <div className="row"><button className="btn primary" disabled={busy}>Save plan</button><button type="button" className="btn" onClick={onDone}>Cancel</button></div>
      </form>
    </Card>
  );
}
