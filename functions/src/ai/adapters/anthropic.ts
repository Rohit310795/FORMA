import { AiProviderError, type ProviderAdapter } from '../types';
import { requestJson, trimSlash } from './http';

/**
 * Anthropic Messages API — included to show how further providers plug in.
 * Docs: https://docs.anthropic.com/en/api/messages
 * Structured output is requested via instructions and validated server-side.
 */
export const anthropicAdapter: ProviderAdapter = {
  kind: 'anthropic',
  supports: ['text', 'json'],
  async generate(args, fetchImpl) {
    const base = trimSlash(args.baseUrl || 'https://api.anthropic.com/v1');
    const system = args.json
      ? `${args.system}\n\nRespond with a single JSON object only, matching this JSON Schema:\n${JSON.stringify(args.json.schema)}`
      : args.system;
    const data = await requestJson(fetchImpl, `${base}/messages`, {
      headers: { 'x-api-key': args.apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: args.model, system, max_tokens: args.maxOutputTokens, temperature: args.temperature, messages: args.messages },
      timeoutMs: args.timeoutMs,
      signal: args.signal,
    });
    if (data?.stop_reason === 'refusal') throw new AiProviderError('content_filter', 'The model declined to respond');
    const text = (data?.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
    if (!text.trim()) throw new AiProviderError('invalid_output', 'Provider returned no text', true);
    return { text, inputTokens: data?.usage?.input_tokens, outputTokens: data?.usage?.output_tokens, finishReason: data?.stop_reason };
  },
  async healthCheck(args, fetchImpl) {
    const base = trimSlash(args.baseUrl || 'https://api.anthropic.com/v1');
    const started = Date.now();
    try {
      await requestJson(fetchImpl, `${base}/models?limit=1`, { headers: { 'x-api-key': args.apiKey, 'anthropic-version': '2023-06-01' }, timeoutMs: args.timeoutMs });
      return { ok: true, latencyMs: Date.now() - started, message: 'Connected' };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, message: (err as Error).message };
    }
  },
};
