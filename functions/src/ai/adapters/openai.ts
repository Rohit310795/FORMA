import { AiProviderError, type ProviderAdapter } from '../types';
import { requestJson, trimSlash } from './http';

/**
 * OpenAI Chat Completions API (also used for OpenAI-compatible providers).
 * Docs: https://platform.openai.com/docs/api-reference/chat
 */
export function makeOpenAiAdapter(kind: 'openai' | 'openai_compatible'): ProviderAdapter {
  const defaultBase = 'https://api.openai.com/v1';
  return {
    kind,
    supports: ['text', 'json'],
    async generate(args, fetchImpl) {
      const base = trimSlash(args.baseUrl || defaultBase);
      if (kind === 'openai_compatible' && !args.baseUrl) throw new AiProviderError('bad_request', 'Base URL is required for OpenAI-compatible providers');
      const body: Record<string, unknown> = {
        model: args.model,
        messages: [{ role: 'system', content: args.system }, ...args.messages],
        temperature: args.temperature,
      };
      // Newer OpenAI models use max_completion_tokens; many compatible servers still expect max_tokens.
      body[kind === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = args.maxOutputTokens;
      if (args.json) {
        body.response_format = { type: 'json_schema', json_schema: { name: args.json.name, schema: args.json.schema, strict: true } };
      }
      const data = await requestJson(fetchImpl, `${base}/chat/completions`, {
        headers: { authorization: `Bearer ${args.apiKey}` },
        body,
        timeoutMs: args.timeoutMs,
        signal: args.signal,
      });
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === 'content_filter') throw new AiProviderError('content_filter', 'Response was filtered by the provider');
      const text = choice?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new AiProviderError('invalid_output', 'Provider returned no text', true);
      return { text, inputTokens: data?.usage?.prompt_tokens, outputTokens: data?.usage?.completion_tokens, finishReason: choice?.finish_reason };
    },
    async healthCheck(args, fetchImpl) {
      const base = trimSlash(args.baseUrl || defaultBase);
      const started = Date.now();
      try {
        await requestJson(fetchImpl, `${base}/models`, { headers: { authorization: `Bearer ${args.apiKey}` }, timeoutMs: args.timeoutMs });
        return { ok: true, latencyMs: Date.now() - started, message: 'Connected' };
      } catch (err) {
        return { ok: false, latencyMs: Date.now() - started, message: (err as Error).message };
      }
    },
  };
}
