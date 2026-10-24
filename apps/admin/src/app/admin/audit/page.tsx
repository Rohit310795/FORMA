'use client';
import { useState } from 'react';
import { Badge, Card, Loading, Notice, PageHeader, useAdmin } from '@/components/ui';

interface Entry { id: string; at: string; actorUid: string; actorRole?: string; action: string; target?: string; outcome: string; summary?: string; requestId?: string }

export default function AuditPage() {
  const [before, setBefore] = useState<string>();
  const [action, setAction] = useState('');
  const [filter, setFilter] = useState<string>();
  const { data, error, loading, reload } = useAdmin<Entry[]>('audit.list', { before, limit: 50, action: filter });
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Audit Log" subtitle="Append-only record of sensitive admin actions and denied attempts. Secrets and health data are never written here." actions={<button className="btn" onClick={reload}>Refresh</button>} />
      <form className="row" onSubmit={(e) => { e.preventDefault(); setBefore(undefined); setFilter(action.trim() || undefined); }}>
        <input aria-label="Filter by action" placeholder="Filter by action, e.g. providers.setKey" value={action} onChange={(e) => setAction(e.target.value)} style={{ minWidth: 300 }} />
        <button className="btn" type="submit">Filter</button>
      </form>
      <Card>
        {loading && !data ? <Loading /> : error ? <Notice tone="bad">{error}</Notice> : (
          <>
            <table>
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Outcome</th><th>Summary</th></tr></thead>
              <tbody>
                {data?.map((e) => (
                  <tr key={e.id}>
                    <td className="subtle" style={{ whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleString()}</td>
                    <td><code>{e.actorUid.slice(0, 10)}</code><div className="subtle">{e.actorRole}</div></td>
                    <td><code>{e.action}</code></td>
                    <td className="subtle">{e.target}</td>
                    <td><Badge tone={e.outcome === 'success' ? 'ok' : e.outcome === 'denied' ? 'warn' : 'bad'}>{e.outcome}</Badge></td>
                    <td className="subtle" style={{ maxWidth: 420 }}>{e.summary}{e.requestId ? <div>req {e.requestId}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.length ? <p className="muted">No entries.</p> : null}
            <div className="row" style={{ marginTop: 10 }}>
              {before ? <button className="btn sm" onClick={() => setBefore(undefined)}>Newest</button> : null}
              {data && data.length === 50 ? <button className="btn sm" onClick={() => setBefore(data[data.length - 1]!.at)}>Older</button> : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
