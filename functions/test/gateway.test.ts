import { describe, expect, it } from 'vitest';
import { runGateway, MAX_TOTAL_ATTEMPTS } from '../src/ai/gateway';
import { fail, makeDeps, provider, route } from './helpers';

const req = (r = route()) => ({ routeKey: 'coachChat' as const, route: r, requestId: 'r1', userHash: 'h', system: 'sys', messages: [{ role: 'user' as const, content: 'hi' }] });

describe('AI gateway', () => {
  it('returns the primary provider result and records usage with cost', async () => {
    const { deps, usage } = makeDeps({ providers: [provider('a'), provider('b')], script: async () => ({ text: 'hello', inputTokens: 1000, outputTokens: 500 }) });
    const r = await runGateway(req(), deps);
    expect(r).toMatchObject({ ok: true, providerId: 'a', fallbackUsed: false, costMicroUsd: 2000 });
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ outcome: 'success', providerId: 'a', inputTokens: 1000 });
    expect(JSON.stringify(usage)).not.toMatch(/sk-test/);
  });

  it('falls back on timeout after bounded retries', async () => {
    const { deps, calls, usage } = makeDeps({
      providers: [provider('a'), provider('b')],
      script: async (_a, p) => (p === 'a' ? fail('timeout', true) : { text: 'from b' }),
    });
    const r = await runGateway(req(), deps);
    expect(r).toMatchObject({ ok: true, providerId: 'b', fallbackUsed: true });
    expect(calls.filter((c) => c.providerId === 'a')).toHaveLength(2); // 1 + maxRetries(1)
    expect(usage.map((u) => u.outcome)).toEqual(['error', 'error', 'fallback']);
  });

  it('does not retry invalid credentials; moves to fallback', async () => {
    const { deps, calls } = makeDeps({ providers: [provider('a'), provider('b')], script: async (_a, p) => (p === 'a' ? fail('auth') : { text: 'ok' }) });
    const r = await runGateway(req(), deps);
    expect(r.ok).toBe(true);
    expect(calls.filter((c) => c.providerId === 'a')).toHaveLength(1);
  });

  it('skips disabled providers, missing credentials and unknown models without calling them', async () => {
    const { deps, calls } = makeDeps({
      providers: [provider('a', { enabled: false }), provider('b', {}, 'disabled'), provider('c', { models: [] }), provider('d')],
      script: async () => ({ text: 'ok' }),
    });
    const r = await runGateway(req(route({ fallbacks: [{ providerId: 'b', model: 'm1' }, { providerId: 'c', model: 'm1' }, { providerId: 'd', model: 'm1' }] })), deps);
    expect(r).toMatchObject({ ok: true, providerId: 'd' });
    expect(calls.map((c) => c.providerId)).toEqual(['d']);
  });

  it('only uses models with the required structured-output capability', async () => {
    const textOnly = provider('a', { models: [{ id: 'm1', capabilities: ['text'], enabled: true }] });
    const { deps, calls } = makeDeps({ providers: [textOnly, provider('b')], script: async () => ({ text: '{}' }) });
    const r = await runGateway({ ...req(), json: { name: 'x', schema: {} } }, deps);
    expect(r).toMatchObject({ ok: true, providerId: 'b' });
    expect(calls).toHaveLength(1);
  });

  it('caps total attempts and never loops forever', async () => {
    const many = Array.from({ length: 5 }, (_, i) => provider(`p${i}`, { retry: { maxRetries: 3, backoffMs: 0 } }));
    const { deps, calls } = makeDeps({ providers: many, script: async () => fail('server', true) });
    const r = await runGateway(req(route({ primary: { providerId: 'p0', model: 'm1' }, fallbacks: many.slice(1).map((p) => ({ providerId: p.config.id, model: 'm1' })) })), deps);
    expect(r.ok).toBe(false);
    expect(calls.length).toBe(MAX_TOTAL_ATTEMPTS);
  });

  it('never calls the same provider/model twice in one chain', async () => {
    const { deps, calls } = makeDeps({ providers: [provider('a', { retry: { maxRetries: 0, backoffMs: 0 } })], script: async () => fail('server', true) });
    await runGateway(req(route({ fallbacks: [{ providerId: 'a', model: 'm1' }, { providerId: 'a', model: 'm1' }] })), deps);
    expect(calls).toHaveLength(1);
  });

  it('skips a provider over budget or rate limit and records why', async () => {
    const { deps, usage } = makeDeps({
      providers: [provider('a'), provider('b')],
      script: async () => ({ text: 'ok' }),
      overrides: { checkProviderBudget: async (p) => ({ allowed: p.id !== 'a' }) },
    });
    const r = await runGateway(req(), deps);
    expect(r).toMatchObject({ ok: true, providerId: 'b' });
    expect(usage[0]).toMatchObject({ outcome: 'blocked_budget', providerId: 'a' });
  });

  it('stops immediately when the request is cancelled', async () => {
    const ctrl = new AbortController();
    const { deps, calls } = makeDeps({ providers: [provider('a'), provider('b')], script: async () => { ctrl.abort(); return fail('cancelled'); } });
    const r = await runGateway({ ...req(), signal: ctrl.signal }, deps);
    expect(r).toMatchObject({ ok: false, errorClass: 'cancelled' });
    expect(calls).toHaveLength(1);
  });

  it('reports no_route when nothing is configured', async () => {
    const { deps } = makeDeps({ providers: [], script: async () => ({ text: '' }) });
    expect(await runGateway(req(route({ primary: undefined, fallbacks: [] })), deps)).toMatchObject({ ok: false, errorClass: 'no_route' });
  });
});
