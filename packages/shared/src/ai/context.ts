import { AI_ROUTES, type AiContextCategory, type AiRouteKey } from '../features';

/**
 * The smallest set of context categories a request may use:
 * route's hard allow-list ∩ admin route config ∩ user's stored consent ∩ per-request choice.
 */
export function permittedContext(params: {
  routeKey: AiRouteKey;
  routeConfigCategories?: string[];
  userConsent: AiContextCategory[];
  requestShare?: AiContextCategory[];
  hasHealthConsent: boolean;
}): AiContextCategory[] {
  const allowed = new Set<AiContextCategory>(AI_ROUTES[params.routeKey].allowedContext);
  const configured = params.routeConfigCategories?.length ? new Set(params.routeConfigCategories) : undefined;
  const consent = new Set(params.userConsent);
  const request = params.requestShare ? new Set(params.requestShare) : undefined;
  return [...allowed].filter(
    (c) =>
      (!configured || configured.has(c)) &&
      consent.has(c) &&
      (!request || request.has(c)) &&
      // Discomfort details need the separate explicit health consent.
      (c !== 'discomfort' || params.hasHealthConsent),
  );
}

/** Rough token estimate (~4 chars/token) used when a provider omits usage. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function estimateCostMicroUsd(inputTokens: number, outputTokens: number, inputPricePer1M?: number, outputPricePer1M?: number): number | undefined {
  if (inputPricePer1M === undefined && outputPricePer1M === undefined) return undefined;
  // price per 1M tokens in USD → micro-USD per token == price
  return Math.round(inputTokens * (inputPricePer1M ?? 0) + outputTokens * (outputPricePer1M ?? 0));
}
