'use client';
import { useState } from 'react';
import type { BudgetSettings } from '@forma/shared';
import { useSession } from '@/lib/session';
import { Card, Field, Loading, Metric, Notice, PageHeader, pct, usd, useAction, useAdmin } from '@/components/ui';

type Counters = Record<string, Record<string, number>>;
interface Total { success: number; fallback: number; error: number; blocked: number; safetyOverrides: number; rateLimited: number; inputTokens: number; outputTokens: number; costUsd: number; errorRate: number | null; feedbackUp: number; feedbackDown: number }
interface Usage {
  from: string;
  series: (Total & { dayKey: string })[];
  total: Total;
  byProvider: Counters;
  byModel: Counters;
  byRoute: Counters;
  topUsers: { userHash: string; requests: number }[];
  topUsersWindowDays: number;
  budgets: { settings: BudgetSettings; monthSpentUsd: number };
  note: string;
}

function Breakdown({ title, rows }: { title: string; rows: Counters }) {
  const entries = Object.entries(rows);
  return (
    <Card title={title}>
      {entries.length ? (
        <table>
          <thead><tr><th>Name</th><th>Success</th><th>Fallback</th><th>Errors</th><th>Blocked</th><th>Est. cost</th></tr></thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td><code>{k.replace('__', ' · ')}</code></td>
                <td>{v.success ?? 0}</td>
                <td>{v.fallback ?? 0}</td>
                <td>{v.error ?? 0}</td>
                <td>{(v.blocked_budget ?? 0) + (v.blocked_rate ?? 0) + (v.blocked_quota ?? 0) + (v.blocked_flag ?? 0)}</td>
                <td>{usd((v.costMicroUsd ?? 0) / 1e6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">No usage recorded in this period.</p>}
    </Card>
  );
}

export default function UsagePage() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useAdmin<Usage>('usage.get', { days });
  if (loading && !data) return <Loading />;
  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!data) return null;
  const t = data.total;
  const max = Math.max(1, ...data.series.map((s) => s.success + s.fallback + s.error));
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        title="AI Usage & Costs"
        subtitle={`From ${data.from} (UTC days). ${data.note}`}
        actions={
          <div className="row">
            <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 7, 30, 90].map((d) => <option key={d} value={d}>Last {d} day{d > 1 ? 's' : ''}</option>)}
            </select>
            <button className="btn" onClick={reload}>Refresh</button>
          </div>
        }
      />
      <div className="grid cols-4">
        <Metric label="Successful requests" value={t.success + t.fallback} definition={`${t.fallback} answered by a fallback model`} window={`Last ${days} days`} source="aiUsageDaily" />
        <Metric label="Failed attempts" value={t.error} definition={`Error rate ${pct(t.errorRate)} of provider attempts`} window={`Last ${days} days`} source="aiUsageDaily" />
        <Metric label="Blocked" value={t.blocked} definition={`Flags, quotas, budgets, missing routes · ${t.rateLimited} rate-limited`} window={`Last ${days} days`} source="aiUsageDaily" />
        <Metric label="Safety overrides" value={t.safetyOverrides} definition="Red-flag answers and replaced unsafe outputs" window={`Last ${days} days`} source="aiUsageDaily" />
        <Metric label="Tokens" value={`${(t.inputTokens / 1000).toFixed(1)}k / ${(t.outputTokens / 1000).toFixed(1)}k`} definition="Input / output; provider-reported or estimated" window={`Last ${days} days`} source="aiUsageDaily" />
        <Metric label="Estimated cost" value={usd(t.costUsd)} definition="Tokens × your per-model prices" window={`Last ${days} days`} source="Admin-entered prices" />
        <Metric label="Feedback" value={`👍 ${t.feedbackUp} · 👎 ${t.feedbackDown}`} definition="User ratings on AI answers" window={`Last ${days} days`} source="aiUsageDaily.feedback" />
        <Metric label="Spent this month" value={usd(data.budgets.monthSpentUsd)} definition={data.budgets.settings.globalMonthlyUsd ? `${pct(data.budgets.monthSpentUsd / data.budgets.settings.globalMonthlyUsd)} of monthly budget` : 'No monthly budget set'} window="Calendar month" source="aiUsageMonthly" />
      </div>
      <Card title="Requests per day">
        {data.series.length ? (
          <>
            <div className="spark" role="img" aria-label={`Requests per day: ${data.series.map((s) => `${s.dayKey} ${s.success + s.fallback}`).join(', ')}`}>
              {data.series.map((s) => <div key={s.dayKey} title={`${s.dayKey}: ${s.success + s.fallback} ok, ${s.error} errors`} style={{ height: `${((s.success + s.fallback + s.error) / max) * 100}%` }} />)}
            </div>
            <div className="row subtle" style={{ justifyContent: 'space-between' }}><span>{data.series[0]?.dayKey}</span><span>{data.series[data.series.length - 1]?.dayKey}</span></div>
          </>
        ) : <p className="muted">No requests yet.</p>}
      </Card>
      <div className="grid cols-2">
        <Breakdown title="By provider" rows={data.byProvider} />
        <Breakdown title="By feature" rows={data.byRoute} />
        <Breakdown title="By model" rows={data.byModel} />
        <Card title={`Top users (anonymised, last ${data.topUsersWindowDays} days)`}>
          {data.topUsers.length ? (
            <table><tbody>{data.topUsers.map((u) => <tr key={u.userHash}><td><code>{u.userHash}</code></td><td>{u.requests} requests</td></tr>)}</tbody></table>
          ) : <p className="muted">No data.</p>}
          <p className="subtle">Pseudonymous hashes — no names or emails are stored with usage events.</p>
        </Card>
      </div>
      <Budgets key={JSON.stringify(data.budgets.settings)} initial={data.budgets.settings} />
    </div>
  );
}

function Budgets({ initial }: { initial: BudgetSettings }) {
  const { can } = useSession();
  const [b, setB] = useState(initial);
  const { run, busy, message } = useAction();
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <Card title="Budgets">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void run('budgets.update', b, 'Budgets saved.'); }}>
        <fieldset disabled={!can('budgets.write')} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="grid cols-4">
            <Field label="Global daily budget (USD)"><input type="number" min={0} step="0.01" value={b.globalDailyUsd ?? ''} onChange={(e) => setB({ ...b, globalDailyUsd: num(e.target.value) })} /></Field>
            <Field label="Global monthly budget (USD)"><input type="number" min={0} step="0.01" value={b.globalMonthlyUsd ?? ''} onChange={(e) => setB({ ...b, globalMonthlyUsd: num(e.target.value) })} /></Field>
            <Field label="Warn at (% of budget)"><input type="number" min={1} max={100} value={b.warnAtPercent} onChange={(e) => setB({ ...b, warnAtPercent: Number(e.target.value) })} /></Field>
            <Field label="When a budget is reached">
              <select value={b.onExceeded} onChange={(e) => setB({ ...b, onExceeded: e.target.value as BudgetSettings['onExceeded'] })}>
                <option value="block">Block AI requests (safe fallback shown)</option>
                <option value="allow_and_alert">Allow and record an alert</option>
              </select>
            </Field>
          </div>
        </fieldset>
        <p className="subtle" style={{ margin: 0 }}>Enforced on the server before any provider call. Per-feature budgets are set in Feature AI Routing; per-provider budgets in AI Providers (an exhausted provider is skipped in favour of the fallback).</p>
        {message}
        {can('budgets.write') ? <button className="btn primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>Save budgets</button> : null}
      </form>
    </Card>
  );
}
