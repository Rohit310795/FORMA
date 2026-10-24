import { describe, expect, it } from 'vitest';
import { ADAPTERS } from '../src/ai/adapters';
import { classifyStatus } from '../src/ai/adapters/http';
import { AiProviderError } from '../src/ai/types';

const args = { apiKey: 'sk-secret-key-123456', model: 'm', system: 'sys', messages: [{ role: 'user' as const, content: 'hi' }], maxOutputTokens: 100, temperature: 0.2, timeoutMs: 1000 };

function mockFetch(status: number, body: unknown, capture?: { url?: string; init?: RequestInit }) {
  return async (url: string, init?: RequestInit) => {
    if (capture) Object.assign(capture, { url, init });
    return new Response(JSON.stringify(body), { status });
  };
}

describe('provider adapters', () => {
  it('OpenAI: sends bearer auth, system message, json_schema; parses usage', async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    const res = await ADAPTERS.openai.generate({ ...args, json: { name: 'x', schema: { type: 'object' } } }, mockFetch(200, { choices: [{ message: { content: '{"a":1}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } }, cap));
    expect(cap.url).toBe('https://api.openai.com/v1/chat/completions');
    expect((cap.init!.headers as Record<string, string>).authorization).toBe('Bearer sk-secret-key-123456');
    const body = JSON.parse(cap.init!.body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.response_format.type).toBe('json_schema');
    expect(body.max_completion_tokens).toBe(100);
    expect(res).toMatchObject({ text: '{"a":1}', inputTokens: 10, outputTokens: 5 });
  });

  it('OpenAI-compatible requires a base URL and uses max_tokens', async () => {
    await expect(ADAPTERS.openai_compatible.generate(args, mockFetch(200, {}))).rejects.toMatchObject({ errorClass: 'bad_request' });
    const cap: { url?: string; init?: RequestInit } = {};
    await ADAPTERS.openai_compatible.generate({ ...args, baseUrl: 'https://example.test/v1/' }, mockFetch(200, { choices: [{ message: { content: 'ok' } }] }, cap));
    expect(cap.url).toBe('https://example.test/v1/chat/completions');
    expect(JSON.parse(cap.init!.body as string).max_tokens).toBe(100);
  });

  it('Gemini: maps roles, uses x-goog-api-key and systemInstruction', async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    const res = await ADAPTERS.gemini.generate({ ...args, messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }, mockFetch(200, { candidates: [{ content: { parts: [{ text: 'hey' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } }, cap));
    expect(cap.url).toContain('/models/m:generateContent');
    expect((cap.init!.headers as Record<string, string>)['x-goog-api-key']).toBe(args.apiKey);
    const body = JSON.parse(cap.init!.body as string);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model']);
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(res).toMatchObject({ text: 'hey', inputTokens: 3, outputTokens: 2 });
  });

  it('Anthropic: uses x-api-key + version header', async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    const res = await ADAPTERS.anthropic.generate(args, mockFetch(200, { content: [{ type: 'text', text: 'yo' }], usage: { input_tokens: 4, output_tokens: 1 } }, cap));
    expect(cap.url).toBe('https://api.anthropic.com/v1/messages');
    expect((cap.init!.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01');
    expect(res.text).toBe('yo');
  });

  it('classifies errors without leaking response bodies or keys', async () => {
    const err = await ADAPTERS.openai.generate(args, mockFetch(401, { error: { message: 'Incorrect API key sk-secret-key-123456' } })).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.errorClass).toBe('auth');
    expect(err.retryable).toBe(false);
    expect(err.message).not.toMatch(/sk-secret/);
    expect(classifyStatus(429)).toMatchObject({ errorClass: 'rate_limit', retryable: true });
    expect(classifyStatus(503)).toMatchObject({ errorClass: 'server', retryable: true });
    expect(classifyStatus(400)).toMatchObject({ errorClass: 'bad_request', retryable: false });
  });

  it('times out with a bounded timeout', async () => {
    const hang = (_u: string, init?: RequestInit) => new Promise<Response>((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const err = await ADAPTERS.gemini.generate({ ...args, timeoutMs: 50 }, hang).catch((e) => e);
    expect(err.errorClass).toBe('timeout');
    expect(err.retryable).toBe(true);
  });

  it('health checks report status without throwing', async () => {
    expect((await ADAPTERS.openai.healthCheck({ apiKey: 'k', timeoutMs: 1000 }, mockFetch(200, { data: [] }))).ok).toBe(true);
    const bad = await ADAPTERS.gemini.healthCheck({ apiKey: 'k', timeoutMs: 1000 }, mockFetch(403, {}));
    expect(bad).toMatchObject({ ok: false });
    expect(bad.message).toMatch(/credentials/);
  });
});
