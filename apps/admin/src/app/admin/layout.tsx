'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Permission } from '@forma/shared';
import { SessionProvider, useSession } from '@/lib/session';
import { usingEmulators } from '@/lib/firebase';
import { Loading } from '@/components/ui';

const NAV: { href: string; label: string; permission: Permission }[] = [
  { href: '/admin', label: 'Overview', permission: 'overview.read' },
  { href: '/admin/providers', label: 'AI Providers', permission: 'providers.read' },
  { href: '/admin/routing', label: 'Feature AI Routing', permission: 'routing.read' },
  { href: '/admin/flags', label: 'Feature Flags', permission: 'flags.read' },
  { href: '/admin/users', label: 'Users', permission: 'users.read' },
  { href: '/admin/plans', label: 'Plans & Entitlements', permission: 'users.read' },
  { href: '/admin/usage', label: 'AI Usage & Costs', permission: 'usage.read' },
  { href: '/admin/prompts', label: 'Prompts & Policies', permission: 'prompts.read' },
  { href: '/admin/settings', label: 'App Settings', permission: 'settings.read' },
  { href: '/admin/audit', label: 'Audit Log', permission: 'audit.read' },
  { href: '/admin/admins', label: 'Admins', permission: 'admins.manage' },
];

function Shell({ children }: { children: ReactNode }) {
  const { state, user, role, can, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (state === 'signed_out') router.replace('/login');
  }, [state, router]);

  if (state === 'loading' || state === 'signed_out') return <div className="login"><Loading /></div>;
  if (state === 'denied') {
    return (
      <div className="login">
        <div className="card stack">
          <h1>No access</h1>
          <p className="muted">{user?.email} isn’t an administrator. Admin roles are granted by the owner from the console, or via the secure bootstrap script for the first owner.</p>
          <button className="btn" onClick={() => logout()}>Sign out</button>
        </div>
      </div>
    );
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">FORMA<span>ADMIN CONSOLE</span></div>
        <nav className="nav" aria-label="Admin">
          {NAV.filter((n) => can(n.permission)).map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href)) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="subtle" style={{ padding: '18px 10px 0' }}>
          {user?.email}
          <br />Role: <strong>{role}</strong>
          {usingEmulators ? <><br /><span className="badge warn" style={{ marginTop: 6 }}>Emulator mode</span></> : null}
          <div style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => logout()}>Sign out</button>
          </div>
        </div>
      </aside>
      <main className="main" id="main">{children}</main>
    </div>
  );
}

const SERVER_FEATURES = (process.env.NEXT_PUBLIC_SERVER_FEATURES ?? 'on') !== 'off';

/** Free (Spark) setup: there is no backend to manage, so explain instead of failing. */
function FreeSetupNotice() {
  return (
    <div className="login">
      <div className="card stack" style={{ maxWidth: 560 }}>
        <div className="brand" style={{ padding: 0 }}>FORMA<span>ADMIN CONSOLE</span></div>
        <h1>Not active on the free setup</h1>
        <p className="muted">
          This FORMA deployment runs on Firebase’s free Spark plan. The admin console manages AI providers, feature flags,
          users and budgets through Cloud Functions, which Firebase only offers on the pay-as-you-go Blaze plan.
        </p>
        <p className="muted">
          The app itself is fully usable: sign-in, plans, workout logging, nutrition, recovery, progress, data export and
          account deletion. AI features are switched off.
        </p>
        <p className="subtle">To enable the console later: upgrade the project to Blaze, deploy the functions, and rebuild with <code>NEXT_PUBLIC_SERVER_FEATURES=on</code> (see docs/SETUP.md).</p>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!SERVER_FEATURES) return <FreeSetupNotice />;
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
