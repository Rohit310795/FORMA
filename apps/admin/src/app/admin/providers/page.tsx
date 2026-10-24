'use client';
import { useState } from 'react';
import { CAPABILITIES, PROVIDER_KINDS, type Capability, type ModelConfig, type ProviderConfig, type ProviderKind } from '@forma/shared';
import { useSession } from '@/lib/session';
import { Badge, Card, Field, Loading, Notice, PageHeader, Switch, useAction, useAdmin } from '@/components/ui';

interface Row {
  id: string;
  config: ProviderConfig;
  status: { credential: { status: string; maskedSuffix?: string; rotatedAt?: string }; lastHealthCheck?: { at: string; ok: boolean; latencyMs?: number; message?: string }; lastSuccessAt?: string; lastErrorAt?: string; lastErrorClass?: string };
}

const KIND_LABEL: Record<ProviderKind, string> = { openai: 'OpenAI', gemini: 'Google Gemini', anthropic: 'Anthropic', openai_compatible: 'OpenAI-compatible (custom URL)' };
const blank = (kind: ProviderKind = 'openai'): ProviderConfig => ({
  id: '', kind, displayName: KIND_LABEL[kind], enabled: false, models: [], priority: 50, timeoutMs: 30000, retry: { maxRetries: 1, backoffMs: 500 }, rateLimitPerMinute: 120,
});

export default function ProvidersPage() {
  const { can } = useSession();
  const { data, error, loading, reload } = useAdmin<Row[]>('providers.list');
  const [editing, setEditing] = useState<ProviderConfig>();
  if (loading && !data) return <Loading />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="AI Providers" subtitle="Connect model providers. Keys are stored in Google Secret Manager and never shown again." actions={can('providers.write') ? <button className="btn primary" onClick={() => setEditing(blank())}>Add provider</button> : null} />
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {editing ? <ProviderForm initial={editing} isNew={!data?.some((p) => p.id === editing.id)} onDone={() => { setEditing(undefined); void reload(); }} /> : null}
      {data?.length ? data.map((p) => <ProviderCard key={p.id} row={p} onEdit={() => setEditing(p.config)} onChange={reload} />) : !editing ? <Notice>No providers yet. Add OpenAI, Google Gemini or a compatible provider to enable AI features.</Notice> : null}
    </div>
  );
}

function ProviderCard({ row, onEdit, onChange }: { row: Row; onEdit: () => void; onChange: () => void }) {
  const { can } = useSession();
  const { run, busy, message } = useAction();
  const [key, setKey] = useState('');
  const [test, setTest] = useState(true);
  const [history, setHistory] = useState<Row['status']['lastHealthCheck'][]>();
  const cred = row.status.credential;
  return (
    <Card
      title={`${row.config.displayName}`}
      actions={
        <div className="row">
          <Badge>{KIND_LABEL[row.config.kind]}</Badge>
          {row.config.enabled ? <Badge tone="ok">Enabled</Badge> : <Badge>Disabled</Badge>}
          {can('providers.write') ? <button className="btn sm" onClick={onEdit}>Edit</button> : null}
        </div>
      }>
      <div className="grid cols-2">
        <div className="stack">
          <div><span className="subtle">ID</span> <code>{row.id}</code> · priority {row.config.priority} · timeout {row.config.timeoutMs} ms · retries {row.config.retry.maxRetries} · {row.config.rateLimitPerMinute}/min</div>
          <div>
            <span className="subtle">Models</span>
            <table>
              <thead><tr><th>Model</th><th>Capabilities</th><th>Price / 1M tokens (in · out)</th></tr></thead>
              <tbody>
                {row.config.models.map((m) => (
                  <tr key={m.id}>
                    <td><code>{m.id}</code>{m.id === row.config.defaultModel ? <> <Badge tone="info">default</Badge></> : null}{!m.enabled ? <> <Badge>off</Badge></> : null}</td>
                    <td>{m.capabilities.join(', ')}</td>
                    <td>{m.inputPricePer1M !== undefined ? `$${m.inputPricePer1M} · $${m.outputPricePer1M ?? 0}` : <span className="subtle">not set</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!row.config.models.length ? <p className="subtle">Add at least one model (Edit).</p> : null}
          </div>
          <div className="subtle">
            Budgets: daily {row.config.dailyBudgetUsd ? `$${row.config.dailyBudgetUsd}` : '—'} · monthly {row.config.monthlyBudgetUsd ? `$${row.config.monthlyBudgetUsd}` : '—'}
            {row.status.lastSuccessAt ? ` · last success ${new Date(row.status.lastSuccessAt).toLocaleString()}` : ''}
            {row.status.lastErrorAt ? ` · last error ${row.status.lastErrorClass} at ${new Date(row.status.lastErrorAt).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="stack">
          <div>
            <span className="subtle">API credential </span>
            {cred.status === 'configured' ? <Badge tone="ok">Configured {cred.maskedSuffix}</Badge> : cred.status === 'disabled' ? <Badge tone="bad">Disabled</Badge> : <Badge tone="warn">Not set</Badge>}
            {cred.rotatedAt ? <span className="subtle"> · rotated {new Date(cred.rotatedAt).toLocaleString()}</span> : null}
          </div>
          {can('providers.secrets') ? (
            <form className="stack" onSubmit={async (e) => { e.preventDefault(); const r = await run('providers.setKey', { providerId: row.id, apiKey: key, testBeforeSave: test }, 'Key saved securely.'); if (r) { setKey(''); onChange(); } }}>
              <Field label={cred.status === 'configured' ? 'Rotate key' : 'Add API key'} hint="Sent once over HTTPS to the server and stored in Secret Manager. It is never returned to the browser.">
                <input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste key" data-testid={`key-${row.id}`} />
              </Field>
              <Switch label="Test connection before saving" checked={test} onChange={setTest} />
              <div className="row">
                <button className="btn primary sm" type="submit" disabled={busy || key.trim().length < 8}>Save key</button>
                {cred.status === 'configured' ? <button className="btn danger sm" type="button" disabled={busy} onClick={async () => { if (confirm('Disable this credential? AI requests will skip this provider until a new key is added.')) { await run('providers.disableKey', { providerId: row.id }, 'Credential disabled.'); onChange(); } }}>Disable key (compromised)</button> : null}
              </div>
            </form>
          ) : null}
          <div className="row">
            {can('providers.write') ? <button className="btn sm" disabled={busy} onClick={async () => { await run('providers.test', { providerId: row.id }, 'Connectivity test finished — see status.'); onChange(); }}>Test connectivity</button> : null}
            <button className="btn sm" onClick={async () => setHistory(await run('providers.healthHistory', { providerId: row.id }, 'Loaded.'))}>Health history</button>
          </div>
          {row.status.lastHealthCheck ? (
            <div className="subtle">Last check: <Badge tone={row.status.lastHealthCheck.ok ? 'ok' : 'bad'}>{row.status.lastHealthCheck.ok ? 'OK' : 'Failed'}</Badge> {row.status.lastHealthCheck.latencyMs ? `${row.status.lastHealthCheck.latencyMs} ms` : ''} {row.status.lastHealthCheck.message} · {new Date(row.status.lastHealthCheck.at).toLocaleString()}</div>
          ) : null}
          {history ? (
            <table>
              <tbody>{history.map((h, i) => h ? <tr key={i}><td className="subtle">{new Date(h.at).toLocaleString()}</td><td><Badge tone={h.ok ? 'ok' : 'bad'}>{h.ok ? 'OK' : 'Failed'}</Badge></td><td className="subtle">{h.latencyMs} ms {h.message}</td></tr> : null)}</tbody>
            </table>
          ) : null}
          {message}
          {can('providers.secrets') ? (
            <button className="btn danger sm" style={{ alignSelf: 'flex-start' }} onClick={async () => { const c = prompt(`Type "${row.id}" to remove this provider and destroy its stored key.`); if (c) { await run('providers.delete', { providerId: row.id, confirm: c }, 'Provider removed.'); onChange(); } }}>Remove provider</button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function ProviderForm({ initial, isNew, onDone }: { initial: ProviderConfig; isNew: boolean; onDone: () => void }) {
  const [p, setP] = useState<ProviderConfig>(initial);
  const { run, busy, message } = useAction();
  const set = (patch: Partial<ProviderConfig>) => setP((x) => ({ ...x, ...patch }));
  const setModel = (i: number, patch: Partial<ModelConfig>) => set({ models: p.models.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <Card title={isNew ? 'Add provider' : `Edit ${initial.displayName}`}>
      <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await run('providers.upsert', p, 'Provider saved.') !== undefined) onDone(); }}>
        <div className="grid cols-4">
          <Field label="Provider type">
            <select value={p.kind} disabled={!isNew} onChange={(e) => set({ kind: e.target.value as ProviderKind, displayName: KIND_LABEL[e.target.value as ProviderKind] })}>
              {PROVIDER_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </Field>
          <Field label="ID" hint="Lowercase letters, numbers, dashes"><input required disabled={!isNew} pattern="[a-z0-9-]{2,40}" value={p.id} onChange={(e) => set({ id: e.target.value })} data-testid="provider-id" /></Field>
          <Field label="Display name"><input required value={p.displayName} onChange={(e) => set({ displayName: e.target.value })} /></Field>
          <Field label="Base URL" hint={p.kind === 'openai_compatible' ? 'Required, https only' : 'Optional override'}><input type="url" value={p.baseUrl ?? ''} onChange={(e) => set({ baseUrl: e.target.value || undefined })} placeholder="https://…" /></Field>
          <Field label="Priority (lower = preferred)"><input type="number" min={0} max={100} value={p.priority} onChange={(e) => set({ priority: Number(e.target.value) })} /></Field>
          <Field label="Timeout (ms)"><input type="number" min={1000} max={120000} value={p.timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} /></Field>
          <Field label="Retries on transient errors (0–3)"><input type="number" min={0} max={3} value={p.retry.maxRetries} onChange={(e) => set({ retry: { ...p.retry, maxRetries: Number(e.target.value) } })} /></Field>
          <Field label="Rate limit (requests/min)"><input type="number" min={1} value={p.rateLimitPerMinute} onChange={(e) => set({ rateLimitPerMinute: Number(e.target.value) })} /></Field>
          <Field label="Daily budget (USD)"><input type="number" min={0} step="0.01" value={p.dailyBudgetUsd ?? ''} onChange={(e) => set({ dailyBudgetUsd: num(e.target.value) })} /></Field>
          <Field label="Monthly budget (USD)"><input type="number" min={0} step="0.01" value={p.monthlyBudgetUsd ?? ''} onChange={(e) => set({ monthlyBudgetUsd: num(e.target.value) })} /></Field>
        </div>
        <Switch label="Enabled" checked={p.enabled} onChange={(v) => set({ enabled: v })} />
        <h3>Models</h3>
        <p className="subtle" style={{ margin: 0 }}>Enter model IDs exactly as the provider documents them. Prices are your own estimates for cost tracking — check the provider’s current pricing page.</p>
        {p.models.map((m, i) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="grid cols-4">
              <Field label="Model ID"><input required value={m.id} onChange={(e) => setModel(i, { id: e.target.value })} data-testid={`model-id-${i}`} /></Field>
              <Field label="Input $ / 1M tokens"><input type="number" min={0} step="0.001" value={m.inputPricePer1M ?? ''} onChange={(e) => setModel(i, { inputPricePer1M: num(e.target.value) })} /></Field>
              <Field label="Output $ / 1M tokens"><input type="number" min={0} step="0.001" value={m.outputPricePer1M ?? ''} onChange={(e) => setModel(i, { outputPricePer1M: num(e.target.value) })} /></Field>
              <Field label="Max output tokens (optional)"><input type="number" min={16} value={m.maxOutputTokens ?? ''} onChange={(e) => setModel(i, { maxOutputTokens: num(e.target.value) })} /></Field>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {CAPABILITIES.map((c) => (
                <Switch key={c} label={c} checked={m.capabilities.includes(c)} onChange={(v) => setModel(i, { capabilities: v ? [...m.capabilities, c] : m.capabilities.filter((x) => x !== c) as Capability[] })} />
              ))}
              <Switch label="Enabled" checked={m.enabled} onChange={(v) => setModel(i, { enabled: v })} />
              <label className="switch"><input type="radio" name="default" checked={p.defaultModel === m.id} onChange={() => set({ defaultModel: m.id })} /> Default</label>
              <button type="button" className="btn danger sm" onClick={() => set({ models: p.models.filter((_, j) => j !== i), defaultModel: p.defaultModel === m.id ? undefined : p.defaultModel })}>Remove</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ models: [...p.models, { id: '', capabilities: ['text', 'json'], enabled: true }] })}>Add model</button>
        {message}
        <div className="row">
          <button className="btn primary" type="submit" disabled={busy}>Save provider</button>
          <button className="btn" type="button" onClick={onDone}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}
