'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { adminCall, errorMessage } from '@/lib/firebase';

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {title || actions ? (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          {title ? <h2 style={{ margin: 0 }}>{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Every metric states what it is, its window, its source and how fresh it is. */
export function Metric({ label, value, definition, window, source, unavailable }: { label: string; value: ReactNode; definition: string; window: string; source: string; unavailable?: boolean }) {
  return (
    <div className="card metric">
      <div className="subtle">{label}</div>
      <div className="value">{unavailable ? <span className="muted" style={{ fontSize: 16 }}>Not available</span> : value}</div>
      <div className="def">{definition}</div>
      <div className="def">Window: {window} · Source: {source}</div>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  return <div className={`notice ${tone === 'info' ? '' : tone}`} role={tone === 'bad' ? 'alert' : 'status'}>{children}</div>;
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

export function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-checked={checked} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint ? <span className="subtle" style={{ fontWeight: 400 }}>{hint}</span> : null}
    </label>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
      </div>
      {actions}
    </div>
  );
}

/** Loads data through the admin API with loading / error / reload handling. */
export function useAdmin<T>(action: string, payload: unknown = {}, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(payload);
  const depKey = JSON.stringify(deps);
  useEffect(() => {
    let cancelled = false;
    adminCall<T>(action, JSON.parse(key))
      .then(
        (d) => {
          if (cancelled) return;
          setData(d);
          setError(undefined);
        },
        (e) => !cancelled && setError(errorMessage(e)),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [action, key, depKey, version]);
  const reload = useCallback(() => {
    setLoading(true);
    setVersion((v) => v + 1);
  }, []);
  return { data, error, loading, reload, setData };
}

/** Runs a mutation, surfacing a success or error message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string }>();
  const run = useCallback(async <T,>(action: string, payload: unknown, success = 'Saved.'): Promise<T | undefined> => {
    setBusy(true);
    setMessage(undefined);
    try {
      const res = await adminCall<T>(action, payload);
      setMessage({ tone: 'ok', text: success });
      return res;
    } catch (e) {
      setMessage({ tone: 'bad', text: errorMessage(e) });
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  const view = message ? <Notice tone={message.tone}>{message.text}</Notice> : null;
  return { run, busy, message: view, clear: () => setMessage(undefined) };
}

export function Loading() {
  return <p className="muted" role="status">Loading…</p>;
}

export const usd = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `$${n.toFixed(n < 1 ? 4 : 2)}`);
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n * 1000) / 10}%`);
