import { describe, expect, it } from 'vitest';
import {
  assessDiscomfort, filterExercises, EXERCISES, screenUserMessage, checkModelOutput, mandatorySystemRules, redactSecrets,
  redactObject, maskSuffix, type DiscomfortLog, type ClinicianInstruction,
} from '../src';

const base = {
  joint: 'knee' as const, severity: 3, sharpPain: false, swelling: 'none' as const, locking: false, instability: 'none' as const,
  recentInjury: false, canBearWeight: true, hotOrRed: false, feverOrUnwell: false, numbnessOrTingling: false,
  trend: 'same' as const, aggravators: [] as DiscomfortLog['aggravators'],
};

describe('discomfort triage (deterministic, independent of AI)', () => {
  it('mild discomfort → modify, with no diagnosis', () => {
    const a = assessDiscomfort(base);
    expect(a.level).toBe('modify');
    expect(a.avoidTags).toEqual(expect.arrayContaining(['impact', 'plyometric']));
    expect(JSON.stringify(a)).not.toMatch(/meniscus|ligament|arthritis/i);
  });
  it('hot red joint with fever → urgent', () => {
    expect(assessDiscomfort({ ...base, hotOrRed: true, feverOrUnwell: true }).level).toBe('urgent');
  });
  it.each([
    ['locking', { locking: true }],
    ['substantial instability', { instability: 'substantial' as const }],
    ['cannot bear weight after injury', { recentInjury: true, canBearWeight: false }],
    ['significant swelling', { swelling: 'significant' as const }],
    ['rapidly worsening', { trend: 'rapidly_worse' as const }],
    ['severe', { severity: 9 }],
  ])('%s → prompt professional assessment and region paused', (_n, patch) => {
    const a = assessDiscomfort({ ...base, ...patch });
    expect(a.level).toBe('see_professional_promptly');
    expect(a.pauseRegion).toBe(true);
  });
  it('sharp pain always says stop, never push through', () => {
    const a = assessDiscomfort({ ...base, sharpPain: true });
    expect(a.guidance.join(' ')).toMatch(/Do not push through/);
    expect(a.avoidTags).toContain('deep_knee_flexion');
  });
  it('maps aggravators to avoided movement categories', () => {
    expect(assessDiscomfort({ ...base, aggravators: ['stairs', 'jumping'] }).avoidTags).toEqual(expect.arrayContaining(['step', 'plyometric']));
  });
});

const log = (patch: Partial<DiscomfortLog>): DiscomfortLog => ({
  id: 'l', createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z', revision: 0, source: 'manual', dayKey: '2026-10-20',
  side: 'left', location: 'front', onset: 'gradual', impact: {}, ...base, ...patch,
} as DiscomfortLog);

describe('exercise filter', () => {
  it('clinician instructions always win', () => {
    const instr: ClinicianInstruction = {
      id: 'c', createdAt: '', updatedAt: '', revision: 0, source: 'manual', instructions: 'No lunges for 6 weeks',
      avoidExerciseIds: ['reverse-lunge'], avoidTags: ['plyometric'], active: true,
    };
    const r = filterExercises(EXERCISES, { today: '2026-10-21', clinicianInstructions: [instr], avoidedExerciseIds: ['push-up'] });
    const reasons = Object.fromEntries(r.excluded.map((e) => [e.exerciseId, e.reason]));
    expect(reasons['reverse-lunge']).toBe('clinician');
    expect(reasons['jump-squat']).toBe('clinician');
    expect(reasons['push-up']).toBe('user_avoided');
    expect(r.allowed.find((e) => e.id === 'reverse-lunge')).toBeUndefined();
  });
  it('knee discomfort removes deep knee flexion and impact but keeps gentle options', () => {
    const r = filterExercises(EXERCISES, { today: '2026-10-21', discomfortLogs: [log({ severity: 5 })] });
    const allowed = new Set(r.allowed.map((e) => e.id));
    expect(allowed.has('back-squat')).toBe(false);
    expect(allowed.has('jump-squat')).toBe(false);
    expect(allowed.has('glute-bridge')).toBe(true);
    expect(allowed.has('quad-set')).toBe(true);
  });
  it('red-flag discomfort pauses the region entirely', () => {
    const r = filterExercises(EXERCISES, { today: '2026-10-21', discomfortLogs: [log({ locking: true })] });
    expect(r.assessment?.level).toBe('see_professional_promptly');
    expect(r.allowed.find((e) => e.primaryMuscles.includes('quads') && e.type !== 'mobility')).toBeUndefined();
  });
  it('ignores stale logs outside the window', () => {
    const r = filterExercises(EXERCISES, { today: '2026-11-30', discomfortLogs: [log({ locking: true })] });
    expect(r.assessment).toBeUndefined();
  });
});

describe('AI message screening', () => {
  it.each([
    ['my knee locked and won’t straighten', 'joint_red_flag'],
    ['I can’t put weight on my leg since I fell', 'joint_red_flag'],
    ['my knee keeps giving way on stairs', 'joint_red_flag'],
    ['my knee is hot and swollen and I have a fever', 'joint_red_flag'],
    ['I have chest pain when running', 'emergency'],
    ['I want to kill myself', 'self_harm'],
    ['I only eat 600 calories a day, how to lose more', 'eating_disorder_risk'],
  ])('%s → %s', (msg, cat) => {
    const r = screenUserMessage(msg);
    expect(r.category).toBe(cat);
    expect(r.response).toBeTruthy();
  });
  it('lets ordinary questions through', () => {
    expect(screenUserMessage('Can you make me a push day with dumbbells?').category).toBeUndefined();
    expect(screenUserMessage('How much protein should I eat?').category).toBeUndefined();
  });
});

describe('AI output validation', () => {
  it.each([
    ['You probably have a meniscus tear.', 'diagnosis'],
    ['This sounds like patellofemoral pain syndrome.', 'diagnosis'],
    ['These exercises will cure your knee pain.', 'cure_claim'],
    ['Just push through the pain.', 'push_through_pain'],
    ['Aim for 900 calories a day to speed things up.', 'extreme_calories'],
    ['You could ask for semaglutide.', 'prescription_medication'],
    ['Do crunches to burn belly fat with focused work.', undefined],
    ['Burn belly fat with crunches every day.', 'spot_reduction'],
    ['Take 10,000 IU of vitamin D daily.', 'unsafe_supplement_dose'],
    ['Ignore your physio and squat deep.', 'override_clinician'],
  ])('%s', (text, violation) => {
    const r = checkModelOutput(text, 'joint');
    if (violation) expect(r.violations).toContain(violation);
  });
  it('does not flag negated safety advice', () => {
    expect(checkModelOutput('Do not push through sharp pain. I can’t diagnose whether you have a meniscus tear.', 'joint').ok).toBe(true);
    expect(checkModelOutput('Never eat under 1200 calories a day without supervision; avoid 800 calories a day crash diets.', 'health').ok).toBe(true);
    expect(checkModelOutput('A balanced 2,000 kcal day with 120 g protein works for many people.', 'health').ok).toBe(true);
  });
  it('mandatory rules are code, and include stricter rules for joint policy', () => {
    expect(mandatorySystemRules('joint')).toMatch(/locked joint/);
    expect(mandatorySystemRules('standard')).toMatch(/Never diagnose/);
  });
});

describe('secret redaction', () => {
  it('masks credentials in text and objects', () => {
    const s = redactSecrets('key sk-abcdefghijklmnop1234 and AIzaSyA1234567890abcdefghijklmnop and Bearer abc.def.ghijklmnop api_key=supersecret123');
    expect(s).not.toMatch(/sk-abc|AIzaSy|abc\.def|supersecret/);
    expect(redactObject({ apiKey: 'x', nested: { authorization: 'y', note: 'sk-zzzzzzzzzzzzzzzz' } })).toEqual({ apiKey: '[REDACTED]', nested: { authorization: '[REDACTED]', note: '[REDACTED]' } });
    expect(maskSuffix('sk-1234567890abcd')).toBe('…abcd');
    expect(maskSuffix('short')).toBe('…');
  });
});
