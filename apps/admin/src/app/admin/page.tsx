'use client';
import Link from 'next/link';
import { Badge, Card, Loading, Metric, Notice, PageHeader, pct, usd, useAdmin } from '@/components/ui';

interface UsageTotal { success: number; fallback: number; error: number; blocked: number; safetyOverrides: number; rateLimited: number; inputTokens: number; outputTokens: number; costUsd: number; errorRate: number | null }
interface Overview {
  generatedAt: string;
  users: { total: number; new7: number; new30: number; active1: number; active7: number; active30: number; activeDefinition: string };
  features: { key: string; label: string; aiPowered: boolean; enabled: boolean; rolloutPercent: number }[];
  usageToday: { total: UsageTotal; byProvider: Record<string, Record<string, number>> };
  usageMonth: { total: UsageTotal; byProvider: Record<string, Record<string, number>> };
  budgets: { settings: { globalDailyUsd?: number; globalMonthlyUsd?: number; onExceeded: string }; monthUtilisation: number | null; todayUtilisation: number | null };
  providers: { id: string; displayName: string; kind: string; enabled: boolean; status?: { credential?: { status: string; maskedSuffix?: string }; lastHealthCheck?: { ok: boolean; at: string; message?: string }; lastErrorAt?: string; lastErrorClass?: string; lastSuccessAt?: string } }[];
  routesConfigured: number;
  routesTotal: number;
  recentAudit: { id: string; at: string; actorUid: string; action: string; outcome: string; summary?: string; target?: string }[];
  system: { functions: string; firestore: string; emulator: boolean };
  unavailable: string[];
  costNote: string;
}

export default function OverviewPage() {
  const { data, error, loading, reload } = useAdmin<Overview>('overview.get');
  if (loading && !data) return <Loading />;
  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!data) return null;
  const fresh = `as of ${new Date(data.generatedAt).toLocaleString()}`;
  const m = data.usageMonth.total;
  const t = data.usageToday.total;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Overview" subtitle={`Live figures ${fresh}`} actions={<button className="btn" onClick={reload}>Refresh</button>} />
      {data.routesConfigured < data.routesTotal ? (
        <Notice tone="warn">{data.routesTotal - data.routesConfigured} of {data.routesTotal} AI features have no model route yet, so they show a safe “unavailable” message. <Link href="/admin/routing">Configure routing</Link>.</Notice>
      ) : null}
      <div className="grid cols-4">
        <Metric label="Registered users" value={data.users.total} definition="Accounts that have opened the app at least once" window="All time" source="Firestore users" />
        <Metric label="New registrations" value={`${data.users.new7} / ${data.users.new30}`} definition="Accounts created in the last 7 / 30 days" window="7d / 30d" source="Firestore users.createdAt" />
        <Metric label="Active users" value={`${data.users.active1} · ${data.users.active7} · ${data.users.active30}`} definition={data.users.activeDefinition} window="1d · 7d · 30d" source="users.lastActiveAt" />
        <Metric label="AI requests today" value={t.success + t.fallback} definition={`${t.error} failed attempts · ${t.blocked} blocked · error rate ${pct(t.errorRate)}`} window="Today (UTC)" source="aiUsageDaily" />
      </div>
      <div className="grid cols-4">
        <Metric label="AI requests this month" value={m.success + m.fallback} definition={`${m.fallback} via fallback · ${m.safetyOverrides} safety overrides · ${m.rateLimited} rate-limited`} window="Calendar month (UTC)" source="aiUsageMonthly" />
        <Metric label="Tokens this month" value={`${(m.inputTokens / 1000).toFixed(1)}k in · ${(m.outputTokens / 1000).toFixed(1)}k out`} definition="Provider-reported where available, otherwise estimated" window="Calendar month" source="aiUsageMonthly" />
        <Metric label="Estimated cost this month" value={usd(m.costUsd)} definition={data.costNote} window="Calendar month" source="Admin-entered model prices" />
        <Metric label="Budget used" value={pct(data.budgets.monthUtilisation)} unavailable={data.budgets.monthUtilisation === null} definition={data.budgets.settings.globalMonthlyUsd ? `of ${usd(data.budgets.settings.globalMonthlyUsd)} monthly budget · on limit: ${data.budgets.settings.onExceeded}` : 'Set a monthly budget in AI Usage & Costs'} window="Calendar month" source="appConfig/budgets" />
      </div>
      <div className="grid cols-2">
        <Card title="AI providers" actions={<Link className="btn sm" href="/admin/providers">Manage</Link>}>
          {data.providers.length ? (
            <table>
              <thead><tr><th>Provider</th><th>Status</th><th>Credential</th><th>Last check</th></tr></thead>
              <tbody>
                {data.providers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.displayName}<div className="subtle">{p.kind}</div></td>
                    <td>{p.enabled ? <Badge tone="ok">Enabled</Badge> : <Badge>Disabled</Badge>}{p.status?.lastErrorClass ? <div className="subtle">Last error: {p.status.lastErrorClass}</div> : null}</td>
                    <td>{p.status?.credential?.status === 'configured' ? <Badge tone="ok">Configured {p.status.credential.maskedSuffix}</Badge> : <Badge tone="warn">{p.status?.credential?.status ?? 'missing'}</Badge>}</td>
                    <td>{p.status?.lastHealthCheck ? <><Badge tone={p.status.lastHealthCheck.ok ? 'ok' : 'bad'}>{p.status.lastHealthCheck.ok ? 'OK' : 'Failed'}</Badge><div className="subtle">{new Date(p.status.lastHealthCheck.at).toLocaleString()}</div></> : <span className="subtle">Never</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">No providers yet. <Link href="/admin/providers">Add OpenAI, Gemini or another provider.</Link></p>}
        </Card>
        <Card title="Features" actions={<Link className="btn sm" href="/admin/flags">Manage</Link>}>
          <div className="row">
            {data.features.map((f) => <Badge key={f.key} tone={f.enabled ? 'ok' : 'warn'}>{f.label}{f.rolloutPercent < 100 ? ` ${f.rolloutPercent}%` : ''}{f.enabled ? '' : ' — off'}</Badge>)}
          </div>
          <p className="subtle" style={{ marginTop: 12 }}>{data.features.filter((f) => f.enabled).length} of {data.features.length} enabled.</p>
        </Card>
      </div>
      <div className="grid cols-2">
        <Card title="Recent admin activity" actions={<Link className="btn sm" href="/admin/audit">Audit log</Link>}>
          {data.recentAudit.length ? (
            <table>
              <tbody>
                {data.recentAudit.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }} className="subtle">{new Date(a.at).toLocaleString()}</td>
                    <td><code>{a.action}</code> <Badge tone={a.outcome === 'success' ? 'ok' : a.outcome === 'denied' ? 'warn' : 'bad'}>{a.outcome}</Badge><div className="subtle">{a.summary}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">No activity yet.</p>}
        </Card>
        <Card title="System health">
          <p>Cloud Functions: <Badge tone="ok">{data.system.functions}</Badge> · Firestore: <Badge tone="ok">{data.system.firestore}</Badge> {data.system.emulator ? <Badge tone="warn">Emulator</Badge> : null}</p>
          <h3>Not instrumented yet</h3>
          <ul className="muted">{data.unavailable.map((u) => <li key={u}>{u}</li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
