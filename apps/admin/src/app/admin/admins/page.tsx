'use client';
import { useState } from 'react';
import { ADMIN_ROLES, ROLE_PERMISSIONS, type AdminRole } from '@forma/shared';
import { Badge, Card, Field, Loading, Notice, PageHeader, useAction, useAdmin } from '@/components/ui';

export default function AdminsPage() {
  const { data, error, loading, reload } = useAdmin<{ uid: string; role: AdminRole; email: string; grantedAt: string }[]>('admins.list');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole | ''>('support');
  const { run, busy, message } = useAction();
  if (loading && !data) return <Loading />;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Admins" subtitle="Owner only. Roles are stored as server-set Firebase Auth claims; changes sign the person out so new permissions apply." />
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card title="Grant or change a role">
        <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await run('admins.setRole', { email, role: role || null }, 'Role updated.') !== undefined) { setEmail(''); void reload(); } }}>
          <Field label="Email of an existing account"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ minWidth: 280 }} /></Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as AdminRole | '')}>
              {ADMIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="">Remove admin access</option>
            </select>
          </Field>
          <button className="btn primary" disabled={busy} style={{ alignSelf: 'flex-end' }}>Apply</button>
        </form>
        {message}
      </Card>
      <Card title="Current admins">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th>Granted</th></tr></thead>
          <tbody>{data?.map((a) => <tr key={a.uid}><td>{a.email}</td><td><Badge tone={a.role === 'owner' ? 'info' : undefined}>{a.role}</Badge></td><td className="subtle">{new Date(a.grantedAt).toLocaleString()}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="What each role can do">
        <table>
          <tbody>{ADMIN_ROLES.map((r) => <tr key={r}><td><strong>{r}</strong></td><td className="subtle">{ROLE_PERMISSIONS[r].join(', ')}</td></tr>)}</tbody>
        </table>
        <p className="subtle">Consider enabling multi-factor authentication for admin accounts and setting <code>FORMA_ADMIN_REQUIRE_MFA=true</code> (see docs/SECURITY.md).</p>
      </Card>
    </div>
  );
}
