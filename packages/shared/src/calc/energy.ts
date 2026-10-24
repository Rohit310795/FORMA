/**
 * Energy estimates. These are population equations with real uncertainty
 * (individual error is commonly ±10% or more), so the UI always labels them
 * as estimates and lets the user override targets.
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting',
  light: 'Lightly active (1–3 sessions/week)',
  moderate: 'Moderately active (3–5 sessions/week)',
  active: 'Very active (6–7 sessions/week)',
  very_active: 'Physically demanding job + training',
};

export interface EnergyInput {
  weightKg: number;
  heightCm: number;
  age: number;
  /** 'prefer_not' uses the midpoint of the two equations. */
  calcSex: 'female' | 'male' | 'prefer_not';
  activity: ActivityLevel;
}

/** Mifflin–St Jeor (1990). */
export function bmrMifflinStJeor({ weightKg, heightCm, age, calcSex }: Omit<EnergyInput, 'activity'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = calcSex === 'male' ? 5 : calcSex === 'female' ? -161 : -78;
  return Math.round(base + offset);
}

export function tdee(input: EnergyInput): number {
  return Math.round(bmrMifflinStJeor(input) * ACTIVITY_FACTORS[input.activity]);
}

export type EnergyGoal = 'lose' | 'maintain' | 'gain';

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  tdee: number;
  adjustmentKcal: number;
  notes: string[];
}

/** Absolute floors — the app never suggests targets below these. */
export const MIN_KCAL_TARGET = 1200;
/** Conservative caps: deficit ≤ 20% of TDEE (max 500), surplus ≤ 10% (max 300). */
export const MAX_DEFICIT_FRACTION = 0.2;
export const MAX_SURPLUS_FRACTION = 0.1;

export function macroTargets(input: EnergyInput, goal: EnergyGoal): MacroTargets {
  const bmr = bmrMifflinStJeor(input);
  const maintenance = tdee(input);
  const notes: string[] = [
    'Estimated with the Mifflin–St Jeor equation and an activity multiplier. Real needs vary; adjust based on 2–3 weeks of trends.',
  ];
  let adjustment = 0;
  if (goal === 'lose') adjustment = -Math.min(500, Math.round(maintenance * MAX_DEFICIT_FRACTION));
  if (goal === 'gain') adjustment = Math.min(300, Math.round(maintenance * MAX_SURPLUS_FRACTION));
  let kcal = maintenance + adjustment;
  const floor = Math.max(MIN_KCAL_TARGET, bmr);
  if (goal === 'lose' && kcal < floor) {
    kcal = floor;
    adjustment = kcal - maintenance;
    notes.push('Target raised to a safe minimum. Very low intakes are not recommended without professional supervision.');
  }
  // Protein 1.6 g/kg (lose/gain) or 1.2 g/kg (maintain) — within commonly cited ranges for active adults.
  const proteinG = Math.round(input.weightKg * (goal === 'maintain' ? 1.2 : 1.6));
  const fatG = Math.round(Math.max((kcal * 0.25) / 9, input.weightKg * 0.6));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal: Math.round(kcal), proteinG, carbsG, fatG, bmr, tdee: maintenance, adjustmentKcal: adjustment, notes };
}

export function goalToEnergyGoal(goal?: string): EnergyGoal {
  if (goal === 'fat_loss') return 'lose';
  if (goal === 'muscle_gain') return 'gain';
  return 'maintain';
}

/**
 * General hydration guidance: ~30–35 ml/kg/day with an activity bump, clamped.
 * Presented as adjustable guidance, not a medical requirement.
 */
export function suggestedWaterMl(weightKg: number | undefined, activity: ActivityLevel = 'light'): number {
  const base = (weightKg ?? 70) * 33;
  const bump = activity === 'active' || activity === 'very_active' ? 500 : activity === 'moderate' ? 250 : 0;
  return Math.min(4000, Math.max(1500, Math.round((base + bump) / 50) * 50));
}
