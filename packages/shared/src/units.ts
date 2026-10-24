export type UnitSystem = 'metric' | 'imperial';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FLOZ = 29.5735295625;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;
export const mlToFloz = (ml: number) => ml / ML_PER_FLOZ;

export const round = (n: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Weight is stored in kg; this formats for the user's preferred unit system. */
export function formatWeight(kg: number, units: UnitSystem, dp = 1): string {
  return units === 'imperial' ? `${round(kgToLb(kg), dp)} lb` : `${round(kg, dp)} kg`;
}

/** Lengths are stored in cm. */
export function formatLength(cm: number, units: UnitSystem, dp = 1): string {
  return units === 'imperial' ? `${round(cmToIn(cm), dp)} in` : `${round(cm, dp)} cm`;
}

export function formatVolumeMl(ml: number, units: UnitSystem): string {
  if (units === 'imperial') return `${Math.round(mlToFloz(ml))} fl oz`;
  return ml >= 1000 ? `${round(ml / 1000, 2)} L` : `${Math.round(ml)} ml`;
}

/** Parse a user-entered weight in their unit into kg. */
export const toKg = (value: number, units: UnitSystem) => (units === 'imperial' ? lbToKg(value) : value);
export const toCm = (value: number, units: UnitSystem) => (units === 'imperial' ? inToCm(value) : value);
