import { httpsCallable } from 'firebase/functions';
import type { AiContextCategory, AiRouteKey, FeatureDecision, FeatureKey, WorkoutPlan } from '@forma/shared';
import { functions } from './firebase';

export interface MyConfig {
  features: Record<FeatureKey, FeatureDecision>;
  entitlement: { planId: string; planName: string; status: string; billing: string };
  ai: { usedToday: number; usedThisMonth: number; dailyLimit: number; monthlyLimit: number };
  settings: {
    announcement?: { id: string; title: string; body: string; level: 'info' | 'warning'; active: boolean };
    maintenance: { active: boolean; message: string };
    defaultUnits: 'metric' | 'imperial';
    supportEmail?: string;
    supportUrl?: string;
    onboardingDefaults?: { sessionMinutes: number };
    notificationTemplates?: Partial<Record<string, { title: string; body: string }>>;
  };
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  content: string;
  createdAt: string;
  safety: 'ok' | 'modified' | 'blocked' | 'red_flag';
  disclaimers: string[];
  degraded: boolean;
  status: string;
  contextUsed: AiContextCategory[];
}

// Undefined fields are dropped so the server receives clean payloads (the SDK would send them as null).
const clean = <T>(input: T): T => JSON.parse(JSON.stringify(input ?? {}));
const call = <I, O>(name: string) => async (input: I): Promise<O> => (await httpsCallable<I, O>(functions, name, { timeout: 90_000 })(clean(input))).data;

export const api = {
  getMyConfig: call<{ platform?: 'ios' | 'android' | 'web' }, MyConfig>('getMyConfig'),
  aiChat: call<{ conversationId?: string; routeKey?: AiRouteKey; message: string; shareContext?: AiContextCategory[] }, { conversationId: string; message: AssistantMessage }>('aiChat'),
  aiFeedback: call<{ conversationId: string; messageId: string; value: 'up' | 'down' }, { ok: boolean }>('aiFeedback'),
  aiGenerateWorkout: call<{ request?: string; split?: string; sessionMinutes?: number }, { status: string; message: string; plan?: WorkoutPlan; source: 'ai' | 'template'; excluded: number }>('aiGenerateWorkout'),
  exportMyData: call<Record<string, never>, Record<string, unknown>>('exportMyData'),
  deleteMyAccount: call<{ confirm: 'DELETE' }, { deleted: boolean }>('deleteMyAccount'),
};

/** Server errors carry safe messages; anything else becomes a generic message. */
export function apiErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === 'functions/unavailable' || e?.code === 'functions/internal' && !e.message) return 'The service is unreachable right now. Please try again.';
  if (e?.code?.startsWith('functions/') && e.message) return e.message;
  return 'Something went wrong. Please try again.';
}
