import { redactSecrets } from '@forma/shared';
import { AiProviderError, type FetchLike } from '../types';

/** Classifies an HTTP status into a retry decision without exposing the body. */
export function classifyStatus(status: number): AiProviderError {
  if (status === 401 || status === 403) return new AiProviderError('auth', `Provider rejected the credentials (${status})`, false, status);
  if (status === 429) return new AiProviderError('rate_limit', 'Provider rate limit reached', true, status);
  if (status === 408) return new AiProviderError('timeout', 'Provider timed out', true, status);
  if (status >= 500) return new AiProviderError('server', `Provider error (${status})`, true, status);
  if (status === 400 || status === 404 || status === 422) return new AiProviderError('bad_request', `Provider rejected the request (${status})`, false, status);
  return new AiProviderError('unknown', `Unexpected provider status (${status})`, false, status);
}

/** POST/GET JSON with a hard timeout and caller cancellation. */
export async function requestJson(
  fetchImpl: FetchLike,
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: unknown; timeoutMs: number; signal?: AbortSignal },
): Promise<any> {
  const timeout = AbortSignal.timeout(init.timeoutMs);
  const signal = init.signal ? AbortSignal.any([timeout, init.signal]) : timeout;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...init.headers },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal,
    });
  } catch (err) {
    if (init.signal?.aborted) throw new AiProviderError('cancelled', 'Request cancelled', false);
    if (timeout.aborted) throw new AiProviderError('timeout', `Provider did not respond within ${init.timeoutMs} ms`, true);
    throw new AiProviderError('network', redactSecrets(`Network error: ${(err as Error).message}`), true);
  }
  if (!res.ok) {
    // Drain the body but never surface it: provider errors can echo request data.
    await res.text().catch(() => '');
    throw classifyStatus(res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new AiProviderError('invalid_output', 'Provider returned invalid JSON', true);
  }
}

export const trimSlash = (u: string) => u.replace(/\/+$/, '');
