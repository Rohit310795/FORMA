'use client';
import { useState } from 'react';
import { SAFETY_POLICY_IDS, SAFETY_POLICY_RANK, type AiRouteDefinition, type FeatureRoute, type ProviderConfig, type RouteTarget } from '@forma/shared';
import { useSession } from '@/lib/session';
import { Badge, Card, Field, Loading, Notice, PageHeader, Switch, useAction, useAdmin } from '@/components/ui';

interface Item { definition: AiRouteDefinition; route: FeatureRoute | null }
interface ProviderRow { id: string; config: ProviderConfig; status: { credential: { status: string } } }

const POLICY_HELP: Record<string, string> = {
  standard: 'Core rules only',
  health: 'Health education rules + disclaimer',
  supplement: 'Adds supplement interaction and evidence rules',
  joint: 'Strictest: joint/injury rules, red-flag guidance',
};

export default function RoutingPage() {
  const { data, error, loading, reload } = useAdmin<Item[]>('routes.list');
  const providers = useAdmin<ProviderRow[]>('providers.list');
  if ((loading && !data) || (providers.loading && !providers.data)) return <Loading />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Feature AI Routing" subtitle="Choose the model for each AI feature, with an ordered fallback chain." />
      <Notice>Fallbacks are tried in order only when a provider times out, errors, is over budget or rate-limited. Each request makes at most 6 provider calls. Safety rules are enforced in server code and can’t be weakened below each feature’s minimum.</Notice>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {data?.map((item) => <RouteCard key={item.definition.key} item={item} providers={providers.data ?? []} onSaved={reload} />)}
    </div>
  );
}

function TargetPicker({ value, onChange, providers, needsJson, label }: { value?: RouteTarget; onChange: (v?: RouteTarget) => void; providers: ProviderRow[]; needsJson: boolean; label: string }) {
  const options = providers.flatMap((p) => p.config.models.filter((m) => m.enabled).map((m) => ({ key: `${p.id}::${m.id}`, label: `${p.config.displayName} · ${m.id}${!p.config.enabled ? ' (provider disabled)' : ''}${p.status.credential.status !== 'configured' ? ' (no key)' : ''}${needsJson && !m.capabilities.includes('json') ? ' (no JSON)' : ''}`, disabled: needsJson && !m.capabilities.includes('json') })));
  return (
    <Field label={label}>
      <select value={value ? `${value.providerId}::${value.model}` : ''} onChange={(e) => { const [providerId, model] = e.target.value.split('::'); onChange(e.target.value ? { providerId: providerId!, model: model! } : undefined); }}>
        <option value="">— none —</option>
        {options.map((o) => <option key={o.key} value={o.key} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </Field>
  );
}

function RouteCard({ item, providers, onSaved }: { item: Item; providers: ProviderRow[]; onSaved: () => void }) {
  const { can } = useSession();
  const d = item.definition;
  const [r, setR] = useState<FeatureRoute>(
    item.route ?? { key: d.key, enabled: true, fallbacks: [], maxOutputTokens: d.requiresStructuredOutput ? 2000 : 800, timeoutMs: 30000, perUserPerHour: 30, perUserPerDay: 100, safetyPolicy: d.minimumSafetyPolicy, contextCategories: [...d.allowedContext], temperature: d.requiresStructuredOutput ? 0.2 : 0.4 },
  );
  const { run, busy, message } = useAction();
  const set = (patch: Partial<FeatureRoute>) => setR((x) => ({ ...x, ...patch }));
  const editable = can('routing.write');
  return (
    <Card title={d.label} actions={<div className="row">{d.requiresStructuredOutput ? <Badge tone="info">Structured JSON</Badge> : null}<Badge>min policy: {d.minimumSafetyPolicy}</Badge>{item.route?.primary ? <Badge tone="ok">Configured</Badge> : <Badge tone="warn">No model</Badge>}</div>}>
      <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await run('routes.upsert', r, 'Route saved.') !== undefined) onSaved(); }}>
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <Switch label="AI enabled for this feature" checked={r.enabled} onChange={(v) => set({ enabled: v })} />
          <div className="grid cols-2">
            <TargetPicker label="Primary model" value={r.primary} onChange={(v) => set({ primary: v })} providers={providers} needsJson={d.requiresStructuredOutput} />
            {[0, 1, 2].map((i) => (
              <TargetPicker key={i} label={`Fallback ${i + 1}`} value={r.fallbacks[i]} providers={providers} needsJson={d.requiresStructuredOutput} onChange={(v) => { const f = [...r.fallbacks]; if (v) f[i] = v; else f.splice(i, 1); set({ fallbacks: f.filter(Boolean) }); }} />
            ))}
          </div>
          <div className="grid cols-4">
            <Field label="Safety policy">
              <select value={r.safetyPolicy} onChange={(e) => set({ safetyPolicy: e.target.value as FeatureRoute['safetyPolicy'] })}>
                {SAFETY_POLICY_IDS.map((p) => <option key={p} value={p} disabled={SAFETY_POLICY_RANK[p] < SAFETY_POLICY_RANK[d.minimumSafetyPolicy]}>{p} — {POLICY_HELP[p]}</option>)}
              </select>
            </Field>
            <Field label="Max output tokens"><input type="number" min={64} max={16000} value={r.maxOutputTokens} onChange={(e) => set({ maxOutputTokens: Number(e.target.value) })} /></Field>
            <Field label="Timeout (ms)"><input type="number" min={1000} max={120000} value={r.timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} /></Field>
            <Field label="Temperature (0–1)"><input type="number" min={0} max={1} step={0.1} value={r.temperature} onChange={(e) => set({ temperature: Number(e.target.value) })} /></Field>
            <Field label="Per-user limit / hour"><input type="number" min={1} value={r.perUserPerHour} onChange={(e) => set({ perUserPerHour: Number(e.target.value) })} /></Field>
            <Field label="Per-user limit / day"><input type="number" min={1} value={r.perUserPerDay} onChange={(e) => set({ perUserPerDay: Number(e.target.value) })} /></Field>
            <Field label="Daily budget (USD)"><input type="number" min={0} step="0.01" value={r.dailyBudgetUsd ?? ''} onChange={(e) => set({ dailyBudgetUsd: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
            <Field label="Monthly budget (USD)"><input type="number" min={0} step="0.01" value={r.monthlyBudgetUsd ?? ''} onChange={(e) => set({ monthlyBudgetUsd: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          </div>
          <div>
            <div className="subtle" style={{ marginBottom: 6 }}>Context this feature may use (still limited to what each user consents to)</div>
            <div className="row">
              {d.allowedContext.map((c) => <Switch key={c} label={c} checked={r.contextCategories.includes(c)} onChange={(v) => set({ contextCategories: v ? [...r.contextCategories, c] : r.contextCategories.filter((x) => x !== c) })} />)}
            </div>
          </div>
          {d.requiresStructuredOutput ? <p className="subtle" style={{ margin: 0 }}>Output schema: <code>generatedWorkout</code> (validated server-side; unknown or unsafe exercises are dropped).</p> : null}
        </fieldset>
        {message}
        {editable ? <button className="btn primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>Save route</button> : null}
      </form>
    </Card>
  );
}
