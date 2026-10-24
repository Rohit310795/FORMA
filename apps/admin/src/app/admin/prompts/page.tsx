'use client';
import { useState } from 'react';
import { AI_ROUTE_KEYS, AI_ROUTES, type AiRouteKey, type PromptVersion } from '@forma/shared';
import { useSession } from '@/lib/session';
import { Badge, Card, Field, Loading, Notice, PageHeader, useAction, useAdmin } from '@/components/ui';

interface Data { versions: PromptVersion[]; defaultPrompt: string; minimumSafetyPolicy: string }
interface Preview { text: string; safety: string; note?: string; violations?: string[]; rawBlocked?: boolean; provider?: string; model?: string; policy?: string; disclaimer?: string | null }

export default function PromptsPage() {
  const [routeKey, setRouteKey] = useState<AiRouteKey>('coachChat');
  const { data, error, loading, reload } = useAdmin<Data>('prompts.list', { routeKey });
  const published = data?.versions.find((v) => v.status === 'published');

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Prompts & Policies" subtitle="Versioned guidance for each AI feature, with preview, publish and rollback." />
      <Notice>Editable prompts only shape tone and focus. <strong>Mandatory safety rules live in server code</strong> and are always placed first; red-flag screening and output checks run regardless of prompt text, so a prompt cannot disable them.</Notice>
      <div className="row">
        <Field label="Feature">
          <select value={routeKey} onChange={(e) => setRouteKey(e.target.value as AiRouteKey)}>
            {AI_ROUTE_KEYS.map((k) => <option key={k} value={k}>{AI_ROUTES[k].label}</option>)}
          </select>
        </Field>
        {data ? <Badge>minimum policy: {data.minimumSafetyPolicy}</Badge> : null}
        {published ? <Badge tone="ok">v{published.version} published</Badge> : <Badge>Using built-in default</Badge>}
      </div>
      {loading && !data ? <Loading /> : error ? <Notice tone="bad">{error}</Notice> : data ? (
        <Editor key={routeKey} routeKey={routeKey} data={data} initial={published?.systemPrompt ?? data.defaultPrompt} onChanged={reload} />
      ) : null}
    </div>
  );
}

function Editor({ routeKey, data, initial, onChanged }: { routeKey: AiRouteKey; data: Data; initial: string; onChanged: () => void }) {
  const { can } = useSession();
  const reload = onChanged;
  const [draft, setDraft] = useState(initial);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('How should I warm up before squats?');
  const [preview, setPreview] = useState<Preview>();
  const { run, busy, message: status } = useAction();
  return (
        <div className="grid cols-2">
          <Card title="Draft">
            <div className="stack">
              <Field label="Guidance text"><textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!can('prompts.write')} data-testid="prompt-text" /></Field>
              <Field label="Change note (required)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" disabled={!can('prompts.write')} /></Field>
              {can('prompts.write') ? (
                <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy || note.trim().length < 3 || draft.trim().length < 20} onClick={async () => { if (await run('prompts.createDraft', { routeKey, systemPrompt: draft, changeNote: note }, 'Draft saved. Preview it, then publish.')) { setNote(''); void reload(); } }}>Save as new draft</button>
              ) : null}
              <h3>Preview</h3>
              <Field label="Test message"><input value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
              {can('prompts.write') ? <button className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={async () => setPreview(await run<Preview>('prompts.preview', { routeKey, systemPrompt: draft, message }, 'Preview ready.'))}>Run preview</button> : null}
              {preview ? (
                <div className="card" style={{ background: 'var(--surfaceSunken)' }}>
                  <div className="row"><Badge tone={preview.safety === 'ok' ? 'ok' : 'warn'}>{preview.safety}</Badge>{preview.provider ? <span className="subtle">{preview.provider} · {preview.model} · policy {preview.policy}</span> : null}</div>
                  {preview.rawBlocked ? <Notice tone="warn">The model’s answer broke a safety rule ({preview.violations?.join(', ')}). Users would see this safe fallback instead:</Notice> : null}
                  <p style={{ whiteSpace: 'pre-wrap' }}>{preview.text}</p>
                  {preview.disclaimer ? <p className="subtle">{preview.disclaimer}</p> : null}
                  {preview.note ? <p className="subtle">{preview.note}</p> : null}
                </div>
              ) : null}
              {status}
            </div>
          </Card>
          <Card title="Version history">
            {data?.versions.length ? (
              <table>
                <thead><tr><th>Version</th><th>Status</th><th>Note</th><th /></tr></thead>
                <tbody>
                  {data.versions.map((v) => (
                    <tr key={v.id}>
                      <td>v{v.version}<div className="subtle">{new Date(v.createdAt).toLocaleString()}</div></td>
                      <td><Badge tone={v.status === 'published' ? 'ok' : v.status === 'draft' ? 'info' : undefined}>{v.status}</Badge></td>
                      <td>{v.changeNote}</td>
                      <td>
                        <div className="row">
                          <button className="btn sm" onClick={() => setDraft(v.systemPrompt)}>Load</button>
                          {can('prompts.publish') && v.status !== 'published' ? (
                            <button className="btn sm" disabled={busy} onClick={async () => {
                              const rollback = v.status === 'archived';
                              if (!confirm(`${rollback ? 'Roll back to' : 'Publish'} v${v.version} for ${AI_ROUTES[routeKey].label}? Users will get it immediately.`)) return;
                              if (await run('prompts.publish', { versionId: v.id, confirm: true, rollback }, rollback ? 'Rolled back.' : 'Published.')) void reload();
                            }}>{v.status === 'archived' ? 'Roll back' : 'Publish'}</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">No versions yet — the built-in default is in use.</p>}
          </Card>
        </div>
  );
}
