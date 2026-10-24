'use client';
import { useState } from 'react';
import { FEATURE_KEYS, FEATURES, type Entitlement, type FeatureDecision, type FeatureKey, type Plan } from '@forma/shared';
import { useSession } from '@/lib/session';
import { adminCall, errorMessage } from '@/lib/firebase';
import { Badge, Card, Field, Loading, Notice, PageHeader, useAction, useAdmin } from '@/components/ui';

interface ListRow { uid: string; email: string | null; createdAt: string; lastActiveAt: string | null; status: string; disabled: boolean }
interface Detail {
  uid: string; email: string | null; emailVerified: boolean; providers: string[]; createdAt: string; lastSignInAt: string; lastActiveAt: string | null;
  disabled: boolean; status: string; role: string | null; entitlement: Entitlement | null; aiUsage: { today: number; month: number };
  deletionRequest: { requestedAt: string; reason: string; requestedBy: string } | null; features: Record<FeatureKey, FeatureDecision>;
}

export default function UsersPage() {
  const [after, setAfter] = useState<string>();
  const list = useAdmin<{ users: ListRow[]; next: string | null }>('users.list', { after, limit: 25 });
  const [q, setQ] = useState('');
  const [searchError, setSearchError] = useState<string>();
  const [selected, setSelected] = useState<string>();

  const search = async () => {
    setSearchError(undefined);
    try {
      const res = await adminCall<Detail[]>('users.search', { query: q.trim() });
      if (res[0]) setSelected(res[0].uid);
      else setSearchError('No account found.');
    } catch (e) {
      setSearchError(errorMessage(e));
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Users" subtitle="Support tools. Health data, logs and photos are not visible here." />
      <form className="row" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input aria-label="Search by email or user ID" placeholder="Email or user ID" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 320 }} data-testid="user-search" />
        <button className="btn primary" type="submit" disabled={q.trim().length < 3}>Search</button>
        {searchError ? <span className="muted">{searchError}</span> : null}
      </form>
      {selected ? <UserDetail uid={selected} onClose={() => setSelected(undefined)} onChanged={list.reload} /> : null}
      <Card title="Recent registrations">
        {list.loading && !list.data ? <Loading /> : list.error ? <Notice tone="bad">{list.error}</Notice> : (
          <>
            <table>
              <thead><tr><th>Email</th><th>User ID</th><th>Registered</th><th>Last active</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.data?.users.map((u) => (
                  <tr key={u.uid}>
                    <td>{u.email ?? <span className="subtle">—</span>}</td>
                    <td><code>{u.uid.slice(0, 10)}…</code></td>
                    <td className="subtle">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="subtle">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : '—'}</td>
                    <td>{u.status === 'suspended' || u.disabled ? <Badge tone="bad">Suspended</Badge> : <Badge tone="ok">Active</Badge>}</td>
                    <td><button className="btn sm" onClick={() => setSelected(u.uid)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 10 }}>
              {after ? <button className="btn sm" onClick={() => setAfter(undefined)}>First page</button> : null}
              {list.data?.next ? <button className="btn sm" onClick={() => setAfter(list.data!.next!)}>Next page</button> : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function UserDetail({ uid, onClose, onChanged }: { uid: string; onClose: () => void; onChanged: () => void }) {
  const { can, role } = useSession();
  const { data: u, error, loading, reload } = useAdmin<Detail>('users.get', { uid });
  const plans = useAdmin<Plan[]>('plans.list');
  const { run, busy, message } = useAction();
  const [ent, setEnt] = useState<Partial<Entitlement>>();
  if (loading && !u) return <Card><Loading /></Card>;
  if (error || !u) return <Card><Notice tone="bad">{error}</Notice></Card>;
  const e = ent ?? u.entitlement ?? { planId: 'free', status: 'active', featureOverrides: {} };
  const after = async (p: Promise<unknown>) => { await p; await reload(); onChanged(); };
  const suspended = u.status === 'suspended' || u.disabled;
  return (
    <Card title={u.email ?? u.uid} actions={<button className="btn sm" onClick={onClose}>Close</button>}>
      <div className="grid cols-2">
        <div className="stack">
          <table>
            <tbody>
              <tr><td className="subtle">User ID</td><td><code>{u.uid}</code></td></tr>
              <tr><td className="subtle">Sign-in methods</td><td>{u.providers.join(', ') || '—'} {u.emailVerified ? <Badge tone="ok">verified</Badge> : <Badge>unverified</Badge>}</td></tr>
              <tr><td className="subtle">Registered</td><td>{new Date(u.createdAt).toLocaleString()}</td></tr>
              <tr><td className="subtle">Last sign-in</td><td>{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : '—'}</td></tr>
              <tr><td className="subtle">Last active</td><td>{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : '—'}</td></tr>
              <tr><td className="subtle">Status</td><td>{suspended ? <Badge tone="bad">Suspended</Badge> : <Badge tone="ok">Active</Badge>} {u.role ? <Badge tone="info">admin: {u.role}</Badge> : null}</td></tr>
              <tr><td className="subtle">AI usage</td><td>{u.aiUsage.today} today · {u.aiUsage.month} this month</td></tr>
            </tbody>
          </table>
          {can('users.write') ? (
            <div className="row">
              {suspended ? (
                <button className="btn sm" disabled={busy} onClick={() => { const reason = prompt('Reason for reactivating?'); if (reason) void after(run('users.setStatus', { uid, status: 'active', reason }, 'Account reactivated.')); }}>Reactivate</button>
              ) : (
                <button className="btn danger sm" disabled={busy} onClick={() => { const reason = prompt('Reason for suspending (logged)?'); if (reason) void after(run('users.setStatus', { uid, status: 'suspended', reason }, 'Account suspended and signed out.')); }}>Suspend</button>
              )}
              <button className="btn sm" disabled={busy} onClick={() => confirm('Send a password-reset email to this user?') && void run('users.sendPasswordReset', { uid }, 'Password reset email sent.')}>Send password reset</button>
            </div>
          ) : null}
          <h3>Account deletion</h3>
          {u.deletionRequest ? (
            <Notice tone="warn">
              Deletion requested {new Date(u.deletionRequest.requestedAt).toLocaleString()}: {u.deletionRequest.reason}
              <div className="row" style={{ marginTop: 8 }}>
                {can('users.write') ? <button className="btn sm" disabled={busy} onClick={() => void after(run('users.cancelDeletion', { uid }, 'Deletion request cancelled.'))}>Cancel request</button> : null}
                {can('users.delete') ? <button className="btn danger sm" disabled={busy} onClick={() => { const c = prompt('This permanently deletes the account and all data. Type the user ID to confirm.'); if (c) void run('users.executeDeletion', { uid, confirmUid: c }, 'Account deleted.').then((r) => { if (r) { onChanged(); onClose(); } }); }}>Delete permanently (owner)</button> : <span className="subtle">Only the owner can execute deletion.</span>}
              </div>
            </Notice>
          ) : can('users.write') ? (
            <button className="btn danger sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => { const reason = prompt('Why is this account being deleted? (e.g. user request via support)'); if (reason) void after(run('users.requestDeletion', { uid, reason }, 'Deletion requested. The owner must confirm.')); }}>Request deletion</button>
          ) : null}
          {message}
        </div>
        <div className="stack">
          <h3>Plan & entitlements</h3>
          <div className="grid cols-2">
            <Field label="Plan">
              <select value={e.planId} disabled={!can('entitlements.write')} onChange={(x) => setEnt({ ...e, planId: x.target.value })}>
                {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.billing === 'test_mode' ? ' (test mode)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={e.status} disabled={!can('entitlements.write')} onChange={(x) => setEnt({ ...e, status: x.target.value as Entitlement['status'] })}>
                {['active', 'trial', 'expired', 'test'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Daily AI limit override" hint="Blank = plan default"><input type="number" min={0} value={e.aiDailyOverride ?? ''} disabled={!can('entitlements.write')} onChange={(x) => setEnt({ ...e, aiDailyOverride: x.target.value === '' ? undefined : Number(x.target.value) })} /></Field>
          </div>
          <table>
            <thead><tr><th>Feature</th><th>Now</th><th>Override</th></tr></thead>
            <tbody>
              {FEATURE_KEYS.map((k) => (
                <tr key={k}>
                  <td>{FEATURES[k].label}</td>
                  <td>{u.features[k]?.enabled ? <Badge tone="ok">on</Badge> : <Badge tone="warn">off · {u.features[k]?.reason}</Badge>}</td>
                  <td>
                    <select aria-label={`${FEATURES[k].label} override`} disabled={!can('entitlements.write')} value={e.featureOverrides?.[k] === undefined ? '' : String(e.featureOverrides[k])} onChange={(x) => { const o = { ...(e.featureOverrides ?? {}) }; if (x.target.value === '') delete o[k]; else o[k] = x.target.value === 'true'; setEnt({ ...e, featureOverrides: o }); }}>
                      <option value="">Default</option><option value="true">Force on</option><option value="false">Force off</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="subtle" style={{ margin: 0 }}>A global kill switch still wins over “Force on”.{role === 'support' ? '' : ''}</p>
          {can('entitlements.write') ? (
            <button className="btn primary sm" style={{ alignSelf: 'flex-start' }} disabled={busy || !ent} onClick={() => void after(run('users.setEntitlement', { uid, planId: e.planId, status: e.status, featureOverrides: e.featureOverrides ?? {}, aiDailyOverride: e.aiDailyOverride ?? null }, 'Entitlements saved.')).then(() => setEnt(undefined))}>Save entitlements</button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
