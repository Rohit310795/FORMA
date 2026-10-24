import type { RecoveryCheckIn } from '../schemas/wellness';

/**
 * Transparent recovery estimate (0–100). It is a weighted average of the inputs
 * the user actually provided — never a measurement of tissue healing, injury
 * severity or readiness. Every component is returned so the UI can show the maths.
 */

export interface RecoveryInputs {
  checkIn?: Partial<Pick<RecoveryCheckIn, 'sleepHours' | 'sleepQuality' | 'soreness' | 'fatigue' | 'stress' | 'discomfortReported'>>;
  /** Imported or logged sleep hours; used when the check-in lacks them. */
  sleepHours?: number;
  sleepTargetHours?: number;
  /** Completed working sets in the last 3 days and the 28-day daily average × 3. */
  recentSets?: number;
  baselineSets?: number;
  /** Any discomfort log in the last 3 days with severity ≥ 4. */
  recentDiscomfort?: boolean;
}

export interface RecoveryComponent {
  key: 'sleepDuration' | 'sleepQuality' | 'soreness' | 'fatigue' | 'stress' | 'trainingLoad';
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface RecoveryEstimate {
  score: number | null;
  band: 'low' | 'moderate' | 'good' | 'unknown';
  components: RecoveryComponent[];
  missing: string[];
  capped: boolean;
  explanation: string;
  disclaimer: string;
}

const scale5Inverse = (v: number) => Math.round(((5 - v) / 4) * 100); // 1 → 100, 5 → 0
const scale5 = (v: number) => Math.round(((v - 1) / 4) * 100); // 1 → 0, 5 → 100

export const RECOVERY_DISCLAIMER =
  'This is an estimate from what you told us. It does not measure healing, injury or medical readiness to train.';

export function recoveryEstimate(input: RecoveryInputs): RecoveryEstimate {
  const c: NonNullable<RecoveryInputs['checkIn']> = input.checkIn ?? {};
  const components: RecoveryComponent[] = [];
  const missing: string[] = [];
  const sleepHours = c.sleepHours ?? input.sleepHours;
  const target = input.sleepTargetHours ?? 8;

  if (sleepHours !== undefined) {
    const ratio = Math.min(1, sleepHours / target);
    const score = Math.round(Math.max(0, (ratio - 0.5) / 0.5) * 100);
    components.push({ key: 'sleepDuration', label: 'Sleep duration', score, weight: 0.25, detail: `${sleepHours.toFixed(1)} h of ${target} h target` });
  } else missing.push('sleep duration');

  if (c.sleepQuality !== undefined) components.push({ key: 'sleepQuality', label: 'Sleep quality', score: scale5(c.sleepQuality), weight: 0.15, detail: `${c.sleepQuality}/5` });
  else missing.push('sleep quality');
  if (c.soreness !== undefined) components.push({ key: 'soreness', label: 'Muscle soreness', score: scale5Inverse(c.soreness), weight: 0.2, detail: `${c.soreness}/5 (lower is better)` });
  else missing.push('soreness');
  if (c.fatigue !== undefined) components.push({ key: 'fatigue', label: 'Fatigue', score: scale5Inverse(c.fatigue), weight: 0.2, detail: `${c.fatigue}/5 (lower is better)` });
  else missing.push('fatigue');
  if (c.stress !== undefined) components.push({ key: 'stress', label: 'Stress', score: scale5Inverse(c.stress), weight: 0.1, detail: `${c.stress}/5 (lower is better)` });
  else missing.push('stress');

  if (input.recentSets !== undefined && input.baselineSets !== undefined && input.baselineSets > 0) {
    const ratio = input.recentSets / input.baselineSets;
    // ≤1.0× baseline → 100; 2.0× or more → 0.
    const score = Math.round(Math.max(0, Math.min(1, 2 - ratio)) * 100);
    components.push({ key: 'trainingLoad', label: 'Recent training load', score, weight: 0.1, detail: `${input.recentSets} sets in 3 days vs usual ${Math.round(input.baselineSets)}` });
  } else missing.push('training history');

  const totalWeight = components.reduce((s, x) => s + x.weight, 0);
  // Require at least two subjective inputs before showing a number.
  if (components.length < 2 || totalWeight < 0.3) {
    return {
      score: null,
      band: 'unknown',
      components,
      missing,
      capped: false,
      explanation: 'Add a quick check-in (sleep, soreness, fatigue) to see an estimate.',
      disclaimer: RECOVERY_DISCLAIMER,
    };
  }
  let score = Math.round(components.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight);
  let capped = false;
  if (c.discomfortReported || input.recentDiscomfort) {
    if (score > 60) {
      score = 60;
      capped = true;
    }
  }
  const band = score >= 70 ? 'good' : score >= 45 ? 'moderate' : 'low';
  const explanation =
    band === 'good'
      ? 'Your inputs look favourable. Train as planned and keep listening to your body.'
      : band === 'moderate'
        ? 'Consider a lighter session, fewer hard sets, or mobility work today.'
        : 'A rest day, easy walk or gentle mobility may suit you better today.';
  return {
    score,
    band,
    components,
    missing,
    capped,
    explanation: capped ? `${explanation} The estimate is capped because you reported discomfort.` : explanation,
    disclaimer: RECOVERY_DISCLAIMER,
  };
}
