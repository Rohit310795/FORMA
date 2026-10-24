import { z } from 'zod';
import { AI_ROUTE_KEYS, FEATURE_KEYS, SAFETY_POLICY_IDS } from '../features';
import { isoDateTime, longText, shortText } from './common';

export const PROVIDER_KINDS = ['openai', 'gemini', 'anthropic', 'openai_compatible'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];
export const CAPABILITIES = ['text', 'json', 'streaming', 'tools', 'vision'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const modelConfigSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: shortText.optional(),
  capabilities: z.array(z.enum(CAPABILITIES)).min(1),
  /** Admin-entered pricing in USD per 1M tokens. Estimates only; verify with the provider. */
  inputPricePer1M: z.number().min(0).max(1000).optional(),
  outputPricePer1M: z.number().min(0).max(1000).optional(),
  maxOutputTokens: z.number().int().min(16).max(200000).optional(),
  enabled: z.boolean().default(true),
});
export type ModelConfig = z.infer<typeof modelConfigSchema>;

export const retryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(3).default(1),
  backoffMs: z.number().int().min(0).max(10000).default(500),
});

/** Stored in `aiProviderMetadata/{id}`. Never contains a secret — only a reference. */
export const providerConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  kind: z.enum(PROVIDER_KINDS),
  displayName: shortText.min(1),
  enabled: z.boolean().default(false),
  /** Required for openai_compatible; optional override for others. HTTPS only. */
  baseUrl: z.string().url().startsWith('https://').optional(),
  models: z.array(modelConfigSchema).max(50).default([]),
  defaultModel: z.string().max(120).optional(),
  priority: z.number().int().min(0).max(100).default(50),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  retry: retryPolicySchema.default({ maxRetries: 1, backoffMs: 500 }),
  rateLimitPerMinute: z.number().int().min(1).max(100000).default(120),
  dailyBudgetUsd: z.number().min(0).max(1000000).optional(),
  monthlyBudgetUsd: z.number().min(0).max(10000000).optional(),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/** Server-maintained status fields kept alongside the config. */
export const providerStatusSchema = z.object({
  credential: z.object({
    status: z.enum(['missing', 'configured', 'disabled']),
    /** e.g. "…a1B2" — the last 4 characters only, never the key. */
    maskedSuffix: z.string().max(8).optional(),
    secretRef: z.string().max(300).optional(),
    rotatedAt: isoDateTime.optional(),
  }),
  lastHealthCheck: z
    .object({ at: isoDateTime, ok: z.boolean(), latencyMs: z.number().optional(), message: shortText.optional() })
    .optional(),
  lastSuccessAt: isoDateTime.optional(),
  lastErrorAt: isoDateTime.optional(),
  lastErrorClass: z.string().max(40).optional(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const routeTargetSchema = z.object({ providerId: z.string().max(40), model: z.string().max(120) });
export type RouteTarget = z.infer<typeof routeTargetSchema>;

/** Stored in `aiFeatureRoutes/{routeKey}`. */
export const featureRouteSchema = z.object({
  key: z.enum(AI_ROUTE_KEYS),
  enabled: z.boolean().default(true),
  primary: routeTargetSchema.optional(),
  fallbacks: z.array(routeTargetSchema).max(4).default([]),
  maxOutputTokens: z.number().int().min(64).max(16000).default(800),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  perUserPerHour: z.number().int().min(1).max(1000).default(30),
  perUserPerDay: z.number().int().min(1).max(10000).default(100),
  dailyBudgetUsd: z.number().min(0).optional(),
  monthlyBudgetUsd: z.number().min(0).optional(),
  safetyPolicy: z.enum(SAFETY_POLICY_IDS),
  /** Context categories this route may use (intersected with the route's allowed list and user consent). */
  contextCategories: z.array(z.string().max(30)).max(12).default([]),
  /** Temperature 0–1. Lower is more conservative. */
  temperature: z.number().min(0).max(1).default(0.4),
});
export type FeatureRoute = z.infer<typeof featureRouteSchema>;

export const featureFlagSchema = z.object({
  key: z.enum(FEATURE_KEYS),
  enabled: z.boolean(),
  /** 0–100 staged rollout. Applied after segment targeting. */
  rolloutPercent: z.number().int().min(0).max(100).default(100),
  /** Restrict to plans; empty = everyone. */
  plans: z.array(z.string().max(40)).max(10).default([]),
  platforms: z.array(z.enum(['ios', 'android', 'web'])).max(3).default([]),
  message: shortText.optional(),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const planSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,30}$/),
  name: shortText.min(1),
  description: shortText.optional(),
  features: z.array(z.enum(FEATURE_KEYS)),
  aiDailyRequests: z.number().int().min(0).max(100000),
  aiMonthlyRequests: z.number().int().min(0).max(1000000),
  historyDays: z.number().int().min(0).max(36500).optional(),
  trialDays: z.number().int().min(0).max(365).default(0),
  /** Until a payment provider is integrated every plan is in test mode. */
  billing: z.enum(['test_mode', 'external']).default('test_mode'),
  active: z.boolean().default(true),
});
export type Plan = z.infer<typeof planSchema>;

/** Stored in `userEntitlements/{uid}` — written only by the server. */
export const entitlementSchema = z.object({
  planId: z.string().max(30),
  status: z.enum(['active', 'trial', 'expired', 'test']),
  source: z.enum(['default', 'admin_grant', 'test_mode', 'payment']),
  trialEndsAt: isoDateTime.optional(),
  featureOverrides: z.partialRecord(z.enum(FEATURE_KEYS), z.boolean()).default({}),
  aiDailyOverride: z.number().int().min(0).optional(),
  updatedAt: isoDateTime,
  updatedBy: z.string().max(128).optional(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;

export const promptVersionSchema = z.object({
  id: z.string(),
  routeKey: z.enum(AI_ROUTE_KEYS),
  version: z.number().int().min(1),
  status: z.enum(['draft', 'published', 'archived']),
  /** Editable guidance only. Mandatory safety rules are added by server code and cannot be removed here. */
  systemPrompt: z.string().min(1).max(12000),
  changeNote: shortText.min(1),
  /** Optional JSON schema name required for structured routes. */
  outputSchema: z.string().max(60).optional(),
  createdBy: z.string(),
  createdAt: isoDateTime,
  publishedBy: z.string().optional(),
  publishedAt: isoDateTime.optional(),
});
export type PromptVersion = z.infer<typeof promptVersionSchema>;

export const budgetSettingsSchema = z.object({
  globalDailyUsd: z.number().min(0).optional(),
  globalMonthlyUsd: z.number().min(0).optional(),
  /** Percentage at which a warning is recorded. */
  warnAtPercent: z.number().int().min(1).max(100).default(80),
  /** What to do when a budget is exhausted. */
  onExceeded: z.enum(['block', 'allow_and_alert']).default('block'),
});
export type BudgetSettings = z.infer<typeof budgetSettingsSchema>;

export const appSettingsSchema = z.object({
  announcement: z
    .object({ id: z.string().max(40), title: shortText, body: longText, level: z.enum(['info', 'warning']), active: z.boolean() })
    .optional(),
  maintenance: z.object({ active: z.boolean(), message: shortText }).default({ active: false, message: '' }),
  defaultUnits: z.enum(['metric', 'imperial']).default('metric'),
  defaultLocale: z.string().max(20).default('en-IN'),
  defaultTimeZone: z.string().max(64).default('Asia/Kolkata'),
  supportEmail: z.string().email().optional(),
  supportUrl: z.string().url().optional(),
  defaultPlanId: z.string().max(30).default('free'),
  notificationTemplates: z
    .partialRecord(z.enum(['workouts', 'hydration', 'sleep', 'recovery', 'milestones', 'habits']), z.object({ title: shortText, body: shortText }))
    .default({}),
  onboardingDefaults: z.object({ sessionMinutes: z.number().int().min(10).max(180).default(45) }).default({ sessionMinutes: 45 }),
  updatedAt: isoDateTime.optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const auditLogSchema = z.object({
  id: z.string(),
  at: isoDateTime,
  actorUid: z.string(),
  actorRole: z.string().optional(),
  action: z.string().max(80),
  target: z.string().max(200).optional(),
  outcome: z.enum(['success', 'denied', 'error']),
  /** Redacted, human-readable summary. Must never contain secrets or health details. */
  summary: longText.optional(),
  requestId: z.string().max(64).optional(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const aiUsageEventSchema = z.object({
  at: isoDateTime,
  dayKey: z.string(),
  /** Pseudonymous user hash, not the uid. */
  userHash: z.string().max(64),
  routeKey: z.enum(AI_ROUTE_KEYS),
  providerId: z.string().max(40).optional(),
  model: z.string().max(120).optional(),
  outcome: z.enum(['success', 'error', 'fallback', 'blocked_flag', 'blocked_quota', 'blocked_rate', 'blocked_budget', 'safety_override', 'no_route']),
  errorClass: z.string().max(40).optional(),
  attempt: z.number().int().min(1).max(10).default(1),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  /** Estimated cost in micro-USD (1e-6). Estimates use admin-entered prices. */
  costMicroUsd: z.number().int().min(0).optional(),
  latencyMs: z.number().int().min(0).optional(),
  requestId: z.string().max(64),
});
export type AiUsageEvent = z.infer<typeof aiUsageEventSchema>;
