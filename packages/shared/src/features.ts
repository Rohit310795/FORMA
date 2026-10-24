/**
 * Feature registry: the single list of switchable capabilities. The backend
 * enforces these; the apps only use the evaluated result for presentation.
 */

export const FEATURE_KEYS = [
  'aiCoach',
  'workoutGeneration',
  'personalisedPlans',
  'nutritionInsights',
  'supplements',
  'recovery',
  'kneeHealth',
  'mobility',
  'skincare',
  'sleep',
  'hydration',
  'appleHealthSync',
  'progressInsights',
  'notifications',
  'premiumFeatures',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  /** True when the feature calls an LLM and therefore needs a route + kill switch. */
  aiPowered: boolean;
  defaultEnabled: boolean;
  /** Message shown when the feature is switched off. Non-AI fallback is described here. */
  disabledMessage: string;
}

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  aiCoach: {
    key: 'aiCoach',
    label: 'AI Coach',
    description: 'Conversational coaching grounded in the data the user chooses to share.',
    aiPowered: true,
    defaultEnabled: true,
    disabledMessage:
      'The AI Coach is taking a short break. Your plans, logs and the exercise library all still work.',
  },
  workoutGeneration: {
    key: 'workoutGeneration',
    label: 'AI workout generation',
    description: 'Drafts a workout plan as structured output that the user reviews before saving.',
    aiPowered: true,
    defaultEnabled: true,
    disabledMessage: 'AI plan drafts are unavailable right now. You can still start from a template.',
  },
  personalisedPlans: {
    key: 'personalisedPlans',
    label: 'Personalised plans',
    description: 'Template-based plans adapted to goals, equipment and schedule (no AI).',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Personalised plans are unavailable right now.',
  },
  nutritionInsights: {
    key: 'nutritionInsights',
    label: 'Nutrition insights',
    description: 'AI explanations of nutrition logs and meal ideas.',
    aiPowered: true,
    defaultEnabled: true,
    disabledMessage: 'Nutrition insights are unavailable right now. Logging and targets still work.',
  },
  supplements: {
    key: 'supplements',
    label: 'Supplements',
    description: 'Supplement inventory and evidence summaries.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'The supplements section is unavailable right now.',
  },
  recovery: {
    key: 'recovery',
    label: 'Recovery',
    description: 'Recovery check-ins and the transparent recovery estimate.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Recovery is unavailable right now.',
  },
  kneeHealth: {
    key: 'kneeHealth',
    label: 'Knee Health',
    description: 'Discomfort log, knee exercise education and safety guidance.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Knee Health is unavailable right now.',
  },
  mobility: {
    key: 'mobility',
    label: 'Mobility',
    description: 'Mobility and flexibility routines.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Mobility routines are unavailable right now.',
  },
  skincare: {
    key: 'skincare',
    label: 'Skincare & Glow',
    description: 'Skincare routines, habits and wellness education.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Glow is unavailable right now.',
  },
  sleep: {
    key: 'sleep',
    label: 'Sleep',
    description: 'Sleep logging and trends.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Sleep tracking is unavailable right now.',
  },
  hydration: {
    key: 'hydration',
    label: 'Hydration',
    description: 'Water logging and adjustable targets.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Hydration tracking is unavailable right now.',
  },
  appleHealthSync: {
    key: 'appleHealthSync',
    label: 'Apple Health sync',
    description: 'HealthKit import on iOS development/production builds.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Apple Health sync is unavailable right now.',
  },
  progressInsights: {
    key: 'progressInsights',
    label: 'Progress insights',
    description: 'AI summaries of the user’s own logged progress.',
    aiPowered: true,
    defaultEnabled: true,
    disabledMessage: 'AI progress summaries are unavailable. Your charts and records still work.',
  },
  notifications: {
    key: 'notifications',
    label: 'Notifications',
    description: 'Optional local reminders.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Reminders are unavailable right now.',
  },
  premiumFeatures: {
    key: 'premiumFeatures',
    label: 'Premium features',
    description: 'Gate for Pro-only capabilities.',
    aiPowered: false,
    defaultEnabled: true,
    disabledMessage: 'Premium features are unavailable right now.',
  },
};

/**
 * AI feature routes. Each AI-powered surface has its own route so the owner can
 * pick models, fallbacks, limits and safety policy per surface.
 */
export const AI_ROUTE_KEYS = [
  'coachChat',
  'workoutGeneration',
  'nutritionInsights',
  'recoveryEducation',
  'kneeEducation',
  'progressSummary',
  'wellnessGuidance',
  'supplementEducation',
] as const;
export type AiRouteKey = (typeof AI_ROUTE_KEYS)[number];

export interface AiRouteDefinition {
  key: AiRouteKey;
  label: string;
  /** Feature flag that gates (and kill-switches) this route. */
  feature: FeatureKey;
  /** Minimum safety policy. Admins may make it stricter, never weaker. */
  minimumSafetyPolicy: SafetyPolicyId;
  requiresStructuredOutput: boolean;
  /** Data categories the route may ever see (further limited by user consent). */
  allowedContext: readonly AiContextCategory[];
}

export const SAFETY_POLICY_IDS = ['standard', 'health', 'supplement', 'joint'] as const;
export type SafetyPolicyId = (typeof SAFETY_POLICY_IDS)[number];
/** Strictness order — a higher index is stricter. */
export const SAFETY_POLICY_RANK: Record<SafetyPolicyId, number> = {
  standard: 0,
  health: 1,
  supplement: 2,
  joint: 3,
};

export const AI_CONTEXT_CATEGORIES = [
  'profile',
  'goals',
  'workouts',
  'body',
  'nutrition',
  'recovery',
  'discomfort',
  'sleep',
  'supplements',
] as const;
export type AiContextCategory = (typeof AI_CONTEXT_CATEGORIES)[number];

export const AI_CONTEXT_LABELS: Record<AiContextCategory, string> = {
  profile: 'Basic profile (age range, experience, equipment)',
  goals: 'Goals and training preferences',
  workouts: 'Workout history summary',
  body: 'Body measurements summary',
  nutrition: 'Nutrition log summary',
  recovery: 'Recovery check-ins',
  discomfort: 'Discomfort logs and clinician notes',
  sleep: 'Sleep summary',
  supplements: 'Supplement list',
};

export const AI_ROUTES: Record<AiRouteKey, AiRouteDefinition> = {
  coachChat: {
    key: 'coachChat',
    label: 'AI Coach chat',
    feature: 'aiCoach',
    minimumSafetyPolicy: 'health',
    requiresStructuredOutput: false,
    allowedContext: ['profile', 'goals', 'workouts', 'body', 'nutrition', 'recovery', 'discomfort', 'sleep', 'supplements'],
  },
  workoutGeneration: {
    key: 'workoutGeneration',
    label: 'Workout generation',
    feature: 'workoutGeneration',
    minimumSafetyPolicy: 'joint',
    requiresStructuredOutput: true,
    allowedContext: ['profile', 'goals', 'workouts', 'discomfort', 'recovery'],
  },
  nutritionInsights: {
    key: 'nutritionInsights',
    label: 'Nutrition insights',
    feature: 'nutritionInsights',
    minimumSafetyPolicy: 'health',
    requiresStructuredOutput: false,
    allowedContext: ['profile', 'goals', 'nutrition', 'body'],
  },
  recoveryEducation: {
    key: 'recoveryEducation',
    label: 'Recovery education',
    feature: 'recovery',
    minimumSafetyPolicy: 'joint',
    requiresStructuredOutput: false,
    allowedContext: ['profile', 'recovery', 'sleep', 'workouts', 'discomfort'],
  },
  kneeEducation: {
    key: 'kneeEducation',
    label: 'Knee-health education',
    feature: 'kneeHealth',
    minimumSafetyPolicy: 'joint',
    requiresStructuredOutput: false,
    allowedContext: ['profile', 'discomfort', 'workouts'],
  },
  progressSummary: {
    key: 'progressSummary',
    label: 'Progress summaries',
    feature: 'progressInsights',
    minimumSafetyPolicy: 'health',
    requiresStructuredOutput: false,
    allowedContext: ['goals', 'workouts', 'body', 'nutrition', 'sleep', 'recovery'],
  },
  wellnessGuidance: {
    key: 'wellnessGuidance',
    label: 'Skincare & wellness',
    feature: 'skincare',
    minimumSafetyPolicy: 'health',
    requiresStructuredOutput: false,
    allowedContext: ['profile', 'sleep'],
  },
  supplementEducation: {
    key: 'supplementEducation',
    label: 'Supplement education',
    feature: 'supplements',
    minimumSafetyPolicy: 'supplement',
    requiresStructuredOutput: false,
    allowedContext: ['profile', 'goals', 'supplements'],
  },
};

/** Stable 0–99 bucket for staged rollouts (FNV-1a). Same user → same bucket. */
export function rolloutBucket(uid: string, key: string): number {
  let h = 0x811c9dc5;
  const s = `${key}:${uid}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}
