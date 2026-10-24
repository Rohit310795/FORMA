import { AiProviderError, type ProviderAdapter } from '../types';
import { requestJson, trimSlash } from './http';

/**
 * Google Gemini API (generateContent).
 * Docs: https://ai.google.dev/api/generate-content
 */
export const geminiAdapter: ProviderAdapter = {
  kind: 'gemini',
  supports: ['text', 'json'],
  async generate(args, fetchImpl) {
    const base = trimSlash(args.baseUrl || 'https://generativelanguage.googleapis.com/v1beta');
    const generationConfig: Record<string, unknown> = { maxOutputTokens: args.maxOutputTokens, temperature: args.temperature };
    if (args.json) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseJsonSchema = args.json.schema;
    }
    const data = await requestJson(fetchImpl, `${base}/models/${encodeURIComponent(args.model)}:generateContent`, {
      headers: { 'x-goog-api-key': args.apiKey },
      body: {
        systemInstruction: { parts: [{ text: args.system }] },
        contents: args.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig,
      },
      timeoutMs: args.timeoutMs,
      signal: args.signal,
    });
    if (data?.promptFeedback?.blockReason) throw new AiProviderError('content_filter', 'Request was blocked by the provider');
    const cand = data?.candidates?.[0];
    if (cand?.finishReason === 'SAFETY') throw new AiProviderError('content_filter', 'Response was filtered by the provider');
    const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    if (!text.trim()) throw new AiProviderError('invalid_output', 'Provider returned no text', true);
    return {
      text,
      inputTokens: data?.usageMetadata?.promptTokenCount,
      outputTokens: data?.usageMetadata?.candidatesTokenCount,
      finishReason: cand?.finishReason,
    };
  },
  async healthCheck(args, fetchImpl) {
    const base = trimSlash(args.baseUrl || 'https://generativelanguage.googleapis.com/v1beta');
    const started = Date.now();
    try {
      await requestJson(fetchImpl, `${base}/models?pageSize=1`, { headers: { 'x-goog-api-key': args.apiKey }, timeoutMs: args.timeoutMs });
      return { ok: true, latencyMs: Date.now() - started, message: 'Connected' };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, message: (err as Error).message };
    }
  },
};
