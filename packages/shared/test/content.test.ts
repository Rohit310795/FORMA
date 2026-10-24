import { describe, expect, it } from 'vitest';
import {
  EXERCISES, EXERCISE_MAP, exerciseSchema, SPLIT_TEMPLATES, JOINT_EDUCATION, MOBILITY_MAP, FOODS, foodItemSchema,
  searchFoods, scaleMacros, SUPPLEMENTS,
} from '../src';

describe('content integrity', () => {
  it('every exercise passes its schema and ids are unique', () => {
    const ids = new Set<string>();
    for (const e of EXERCISES) {
      expect(() => exerciseSchema.parse(e)).not.toThrow();
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
    }
    expect(EXERCISES.length).toBeGreaterThanOrEqual(60);
  });

  it('never ships unlicensed media URLs', () => {
    expect(EXERCISES.filter((e) => e.media)).toHaveLength(0);
  });

  it('template candidates, joint education and mobility references all resolve', () => {
    for (const t of SPLIT_TEMPLATES) for (const d of t.days) for (const s of d.slots) for (const c of s.candidates) expect(EXERCISE_MAP.has(c), c).toBe(true);
    for (const j of JOINT_EDUCATION) {
      j.exerciseIds.forEach((id) => expect(EXERCISE_MAP.has(id), id).toBe(true));
      j.mobilityRoutineIds.forEach((id) => expect(MOBILITY_MAP.has(id), id).toBe(true));
    }
  });

  it('knee library includes the core education movements', () => {
    const knee = JOINT_EDUCATION.find((j) => j.joint === 'knee')!;
    for (const id of ['quad-set', 'straight-leg-raise', 'seated-knee-extension', 'glute-bridge', 'side-lying-hip-abduction', 'lying-leg-curl', 'standing-calf-raise', 'sit-to-stand', 'step-up', 'single-leg-balance']) {
      expect(knee.exerciseIds).toContain(id);
      const ex = EXERCISE_MAP.get(id)!;
      expect(ex.instructions.length).toBeGreaterThan(0);
    }
  });

  it('foods are valid, labelled approximate, and include Indian staples', () => {
    FOODS.forEach((f) => {
      expect(() => foodItemSchema.parse(f)).not.toThrow();
      expect(f.accuracy).toBe('approximate');
    });
    expect(searchFoods('dal').map((f) => f.id)).toContain('dal-toor');
    expect(searchFoods('chapati')[0]?.id).toBe('roti');
    expect(scaleMacros({ kcal: 100, proteinG: 3.4, carbsG: 10, fatG: 1 }, 1.5)).toEqual({ kcal: 150, proteinG: 5.1, carbsG: 15, fatG: 1.5, fibreG: undefined });
  });

  it('supplement entries cite a source and carry cautions', () => {
    SUPPLEMENTS.forEach((s) => {
      expect(s.sources.length).toBeGreaterThan(0);
      expect(s.cautions.length).toBeGreaterThan(0);
    });
  });
});
