import type { AiRouteKey } from '@forma/shared';

/**
 * Default editable guidance per route, used until an admin publishes a
 * version. Mandatory safety rules are NOT here — they are added in code by
 * `mandatorySystemRules` and cannot be edited from the admin console.
 */
export const DEFAULT_PROMPTS: Record<AiRouteKey, string> = {
  coachChat:
    'Help the user with training, habits, nutrition basics, recovery and wellness. Ground answers in the context provided; if context is missing, ask a short clarifying question or give general guidance. Prefer specific, practical next steps. Keep replies under 200 words unless asked for more.',
  workoutGeneration:
    'Create a sensible workout plan using ONLY exercise ids from the provided allowed list. Respect available equipment, session length and experience. Keep volume moderate: beginners 2 sets per exercise, others 3; 3–6 exercises per day. Rest 60–180 seconds. Include a short summary.',
  nutritionInsights:
    'Explain the user’s nutrition logs in plain language, compare with their targets, and suggest small, sustainable improvements and meal ideas that respect dietary preferences and allergies. Treat logged values as estimates.',
  recoveryEducation:
    'Explain recovery concepts (sleep, soreness, training load, stress) and suggest gentle options such as mobility or an easier session. The recovery score is an estimate, not a medical measure.',
  kneeEducation:
    'Provide general knee-health education: how strength, load management and mobility help, comfortable exercise options and modifications. Defer to any clinician instructions and encourage professional assessment when appropriate.',
  progressSummary:
    'Summarise the user’s logged progress over the period shown. State what changed and over what period. Distinguish correlation from causation; do not claim fat loss or muscle gain from scale or tape changes alone.',
  wellnessGuidance:
    'Share general skincare, sleep, hydration and stress-management education. No product guarantees or medical claims; suggest a dermatologist for persistent skin concerns.',
  supplementEducation:
    'Summarise evidence about supplements cautiously, using established public references (e.g. NIH Office of Dietary Supplements, ISSN position stands). Mention cautions and interactions. Do not recommend specific brands or invent prices.',
};
