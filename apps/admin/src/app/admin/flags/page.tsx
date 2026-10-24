'use client';
import { useState } from 'react';
import type { FeatureDefinition, FeatureFlag } from '@forma/shared';
import { useSession } from '@/lib/session';
import { Badge, Card, Field, Loading, Notice, PageHeader, Switch, useAction, useAdmin } from '@/components/ui';

interface Item { definition: FeatureDefinition; flag: FeatureFlag; stored: boolean }

export default function FlagsPage() {
  const { data, error, loading, reload } = useAdmin<Item[]>('flags.list');
  const plans = useAdmin<{ id: string; name: string }[]>('plans.list');
  if (loading && !data) return <Loading />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Feature Flags" subtitle="Switch features on or off, target plans and platforms, and stage rollouts. Enforced by the backend." />
      <Notice>Turning off an AI feature is an instant kill switch: requests stop before reaching any provider and users see the message below with a non-AI alternative.</Notice>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <div className="grid cols-2">
        {data?.map((i) => <FlagCard key={i.definition.key} item={i} plans={plans.data ?? []} onSaved={reload} />)}
      </div>
    </div>
  );
}

function FlagCard({ item, plans, onSaved }: { item: Item; plans: { id: string; name: string }[]; onSaved: () => void }) {
  const { can } = useSession();
  const [f, setF] = useState<FeatureFlag>(item.flag);
  const { run, busy, message } = useAction();
  const set = (patch: Partial<FeatureFlag>) => setF((x) => ({ ...x, ...patch }));
  const editable = can('flags.write');
  const save = async (next: FeatureFlag) => {
    if (await run('flags.upsert', next, `${item.definition.label} saved.`) !== undefined) onSaved();
  };
  return (
    <Card title={item.definition.label} actions={<div className="row">{item.definition.aiPowered ? <Badge tone="info">AI</Badge> : null}{f.enabled ? <Badge tone="ok">On</Badge> : <Badge tone="warn">Off</Badge>}</div>}>
      <div className="stack">
        <p className="subtle" style={{ margin: 0 }}>{item.definition.description}</p>
        <Switch label={item.definition.aiPowered ? 'Enabled (kill switch)' : 'Enabled'} checked={f.enabled} disabled={!editable || busy} onChange={(v) => { const next = { ...f, enabled: v }; setF(next); void save(next); }} />
        <details>
          <summary className="subtle" style={{ cursor: 'pointer' }}>Targeting & rollout</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <Field label={`Rollout: ${f.rolloutPercent}% of eligible users`}>
              <input type="range" min={0} max={100} step={5} value={f.rolloutPercent} disabled={!editable} onChange={(e) => set({ rolloutPercent: Number(e.target.value) })} />
            </Field>
            <div className="subtle">Plans (none selected = everyone)</div>
            <div className="row">{plans.map((p) => <Switch key={p.id} label={p.name} checked={f.plans.includes(p.id)} disabled={!editable} onChange={(v) => set({ plans: v ? [...f.plans, p.id] : f.plans.filter((x) => x !== p.id) })} />)}</div>
            <div className="subtle">Platforms (none selected = all)</div>
            <div className="row">{(['ios', 'android', 'web'] as const).map((p) => <Switch key={p} label={p} checked={f.platforms.includes(p)} disabled={!editable} onChange={(v) => set({ platforms: v ? [...f.platforms, p] : f.platforms.filter((x) => x !== p) })} />)}</div>
            <Field label="Message when off"><input value={f.message ?? ''} placeholder={item.definition.disabledMessage} disabled={!editable} onChange={(e) => set({ message: e.target.value || undefined })} /></Field>
            {editable ? <button className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => save(f)}>Save targeting</button> : null}
          </div>
        </details>
        {message}
      </div>
    </Card>
  );
}
