import type { Capability, ProviderKind } from '@forma/shared';

export type ErrorClass =
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'server'
  | 'bad_request'
  | 'network'
  | 'content_filter'
  | 'invalid_output'
  | 'cancelled'
  | 'unsupported'
  | 'unknown';

export class AiProviderError extends Error {
  constructor(public errorClass: ErrorClass, message: string, public retryable = false, public status?: number) {
    super(message);
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateArgs {
  apiKey: string;
  baseUrl?: string;
  model: string;
  system: string;
  messages: ChatTurn[];
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  /** When set, the provider must return JSON matching this schema. */
  json?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
}

export interface HealthResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Every provider implements this; UI and features never talk to a provider directly. */
export interface ProviderAdapter {
  kind: ProviderKind;
  /** Capabilities the adapter can drive (the model must also list them). */
  supports: Capability[];
  generate(args: GenerateArgs, fetchImpl: FetchLike): Promise<GenerateResult>;
  healthCheck(args: { apiKey: string; baseUrl?: string; timeoutMs: number }, fetchImpl: FetchLike): Promise<HealthResult>;
}
