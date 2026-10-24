import type { ProviderKind } from '@forma/shared';
import type { ProviderAdapter } from '../types';
import { makeOpenAiAdapter } from './openai';
import { geminiAdapter } from './gemini';
import { anthropicAdapter } from './anthropic';

/** Adding a provider = adding an adapter here. Feature code never changes. */
export const ADAPTERS: Record<ProviderKind, ProviderAdapter> = {
  openai: makeOpenAiAdapter('openai'),
  openai_compatible: makeOpenAiAdapter('openai_compatible'),
  gemini: geminiAdapter,
  anthropic: anthropicAdapter,
};
