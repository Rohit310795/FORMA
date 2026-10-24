import type { FoodItem } from '../schemas/nutrition';

/**
 * Starter food database. Values are APPROXIMATE typical figures for a generic
 * preparation, rounded, compiled from public generic references (USDA
 * FoodData Central style generic entries and Indian food composition tables).
 * Home recipes vary widely in oil, ghee and portion size, so every entry is
 * flagged as an estimate and users can edit values when logging.
 */

const SRC_GENERIC = 'Approximate generic value; varies by brand, recipe and portion.';
const SRC_INDIAN = 'Approximate value for a typical home preparation; oil/ghee and portion change it a lot.';

type F = Omit<FoodItem, 'accuracy' | 'sourceNote' | 'aliases' | 'tags'> & Partial<Pick<FoodItem, 'aliases' | 'tags'>>;
const indian = (f: F): FoodItem => ({ aliases: [], tags: [], ...f, accuracy: 'approximate', sourceNote: SRC_INDIAN });
const intl = (f: F): FoodItem => ({ aliases: [], tags: [], ...f, accuracy: 'approximate', sourceNote: SRC_GENERIC });

export const FOODS: FoodItem[] = [
  // Indian staples
  indian({ id: 'roti', name: 'Roti / chapati (plain)', aliases: ['phulka', 'chapati'], cuisine: 'indian', serving: '1 medium (~40 g)', servingGrams: 40, per: { kcal: 110, proteinG: 3.5, carbsG: 20, fatG: 2, fibreG: 3 }, tags: ['veg', 'vegan'] }),
  indian({ id: 'paratha-plain', name: 'Plain paratha', cuisine: 'indian', serving: '1 medium (~60 g)', servingGrams: 60, per: { kcal: 200, proteinG: 4, carbsG: 27, fatG: 8, fibreG: 3 }, tags: ['veg'] }),
  indian({ id: 'rice-white-cooked', name: 'Steamed white rice', aliases: ['chawal'], cuisine: 'indian', serving: '1 cup cooked (~160 g)', servingGrams: 160, per: { kcal: 205, proteinG: 4, carbsG: 45, fatG: 0.5, fibreG: 0.6 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'rice-brown-cooked', name: 'Brown rice (cooked)', cuisine: 'indian', serving: '1 cup cooked (~160 g)', servingGrams: 160, per: { kcal: 195, proteinG: 4.5, carbsG: 41, fatG: 1.5, fibreG: 3 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'dal-toor', name: 'Toor / arhar dal (cooked, home-style)', aliases: ['dal', 'tadka dal'], cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 170, proteinG: 9, carbsG: 24, fatG: 4.5, fibreG: 5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'dal-moong', name: 'Moong dal (cooked)', cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 150, proteinG: 9.5, carbsG: 22, fatG: 3, fibreG: 5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'rajma', name: 'Rajma curry', aliases: ['kidney bean curry'], cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 190, proteinG: 9, carbsG: 26, fatG: 5.5, fibreG: 8 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'chole', name: 'Chole / chana masala', aliases: ['chickpea curry'], cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 220, proteinG: 9, carbsG: 28, fatG: 8, fibreG: 8 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'paneer', name: 'Paneer (raw)', aliases: ['cottage cheese'], cuisine: 'indian', serving: '100 g', servingGrams: 100, per: { kcal: 290, proteinG: 18, carbsG: 3, fatG: 23 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'palak-paneer', name: 'Palak paneer', cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 250, proteinG: 11, carbsG: 9, fatG: 19, fibreG: 3 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'dahi', name: 'Dahi / curd (plain, whole milk)', aliases: ['yogurt', 'curd'], cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 95, proteinG: 5.5, carbsG: 7, fatG: 5 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'idli', name: 'Idli', cuisine: 'indian', serving: '2 pieces (~80 g)', servingGrams: 80, per: { kcal: 115, proteinG: 4, carbsG: 24, fatG: 0.5, fibreG: 1.5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'dosa-plain', name: 'Plain dosa', cuisine: 'indian', serving: '1 medium', per: { kcal: 165, proteinG: 4, carbsG: 27, fatG: 4.5, fibreG: 1.5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'sambar', name: 'Sambar', cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 110, proteinG: 5, carbsG: 15, fatG: 3.5, fibreG: 4 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'poha', name: 'Poha', cuisine: 'indian', serving: '1 plate (~150 g)', servingGrams: 150, per: { kcal: 250, proteinG: 5, carbsG: 40, fatG: 8, fibreG: 2 }, tags: ['veg', 'vegan'] }),
  indian({ id: 'upma', name: 'Upma', cuisine: 'indian', serving: '1 plate (~150 g)', servingGrams: 150, per: { kcal: 230, proteinG: 5.5, carbsG: 34, fatG: 8, fibreG: 2.5 }, tags: ['veg'] }),
  indian({ id: 'chicken-curry', name: 'Chicken curry (home-style)', cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 240, proteinG: 22, carbsG: 6, fatG: 14, fibreG: 1.5 }, tags: ['gluten_free'] }),
  indian({ id: 'tandoori-chicken', name: 'Tandoori chicken', cuisine: 'indian', serving: '2 pieces (~150 g)', servingGrams: 150, per: { kcal: 260, proteinG: 36, carbsG: 4, fatG: 11 }, tags: ['gluten_free'] }),
  indian({ id: 'egg-bhurji', name: 'Egg bhurji', cuisine: 'indian', serving: '2 eggs', per: { kcal: 210, proteinG: 13, carbsG: 4, fatG: 16, fibreG: 1 }, tags: ['eggetarian', 'gluten_free'] }),
  indian({ id: 'khichdi', name: 'Moong dal khichdi', cuisine: 'indian', serving: '1 bowl (~200 g)', servingGrams: 200, per: { kcal: 250, proteinG: 9, carbsG: 42, fatG: 5, fibreG: 4 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'chicken-biryani', name: 'Chicken biryani', cuisine: 'indian', serving: '1 plate (~250 g)', servingGrams: 250, per: { kcal: 450, proteinG: 22, carbsG: 55, fatG: 15, fibreG: 2 }, tags: [] }),
  indian({ id: 'veg-pulao', name: 'Vegetable pulao', cuisine: 'indian', serving: '1 plate (~200 g)', servingGrams: 200, per: { kcal: 300, proteinG: 6, carbsG: 50, fatG: 8, fibreG: 3 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'aloo-sabzi', name: 'Aloo sabzi (dry potato)', cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 180, proteinG: 3, carbsG: 25, fatG: 8, fibreG: 3 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'mixed-veg-sabzi', name: 'Mixed vegetable sabzi', cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 130, proteinG: 3.5, carbsG: 13, fatG: 7, fibreG: 4.5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'masala-chai', name: 'Masala chai (with milk & sugar)', aliases: ['chai', 'tea'], cuisine: 'indian', serving: '1 cup (~150 ml)', per: { kcal: 90, proteinG: 3, carbsG: 12, fatG: 3 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'lassi-sweet', name: 'Sweet lassi', cuisine: 'indian', serving: '1 glass (~250 ml)', per: { kcal: 220, proteinG: 7, carbsG: 32, fatG: 7 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'chaas', name: 'Chaas / buttermilk', cuisine: 'indian', serving: '1 glass (~250 ml)', per: { kcal: 50, proteinG: 3, carbsG: 5, fatG: 2 }, tags: ['veg', 'gluten_free'] }),
  indian({ id: 'sprouts-chaat', name: 'Moong sprouts chaat', cuisine: 'indian', serving: '1 bowl (~150 g)', servingGrams: 150, per: { kcal: 140, proteinG: 9, carbsG: 22, fatG: 2, fibreG: 6 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'roasted-chana', name: 'Roasted chana', cuisine: 'indian', serving: '30 g', servingGrams: 30, per: { kcal: 110, proteinG: 6, carbsG: 17, fatG: 2, fibreG: 5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  indian({ id: 'samosa', name: 'Samosa (potato)', cuisine: 'indian', serving: '1 medium', per: { kcal: 260, proteinG: 4, carbsG: 28, fatG: 15, fibreG: 2.5 }, tags: ['veg', 'vegan'] }),
  indian({ id: 'fish-curry', name: 'Fish curry (home-style)', cuisine: 'indian', serving: '1 katori (~150 g)', servingGrams: 150, per: { kcal: 220, proteinG: 22, carbsG: 5, fatG: 12 }, tags: ['pescatarian', 'gluten_free'] }),
  indian({ id: 'besan-chilla', name: 'Besan chilla', cuisine: 'indian', serving: '1 medium', per: { kcal: 140, proteinG: 7, carbsG: 16, fatG: 5, fibreG: 3 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  // International
  intl({ id: 'egg-boiled', name: 'Egg (boiled, large)', cuisine: 'international', serving: '1 egg (~50 g)', servingGrams: 50, per: { kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 }, tags: ['eggetarian', 'gluten_free'] }),
  intl({ id: 'chicken-breast', name: 'Chicken breast (cooked, skinless)', cuisine: 'international', serving: '100 g', servingGrams: 100, per: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }, tags: ['gluten_free'] }),
  intl({ id: 'salmon', name: 'Salmon (cooked)', cuisine: 'international', serving: '100 g', servingGrams: 100, per: { kcal: 206, proteinG: 22, carbsG: 0, fatG: 12 }, tags: ['pescatarian', 'gluten_free'] }),
  intl({ id: 'tofu-firm', name: 'Tofu (firm)', cuisine: 'international', serving: '100 g', servingGrams: 100, per: { kcal: 145, proteinG: 16, carbsG: 3, fatG: 8.5, fibreG: 2 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'oats-dry', name: 'Rolled oats (dry)', cuisine: 'international', serving: '40 g', servingGrams: 40, per: { kcal: 150, proteinG: 5, carbsG: 27, fatG: 2.6, fibreG: 4 }, tags: ['veg', 'vegan'] }),
  intl({ id: 'milk-whole', name: 'Milk (whole)', cuisine: 'international', serving: '1 glass (250 ml)', per: { kcal: 150, proteinG: 8, carbsG: 12, fatG: 8 }, tags: ['veg', 'gluten_free'] }),
  intl({ id: 'milk-toned', name: 'Milk (toned / semi-skimmed)', cuisine: 'international', serving: '1 glass (250 ml)', per: { kcal: 120, proteinG: 8, carbsG: 12, fatG: 4.5 }, tags: ['veg', 'gluten_free'] }),
  intl({ id: 'greek-yogurt', name: 'Greek yogurt (plain, low-fat)', cuisine: 'international', serving: '150 g', servingGrams: 150, per: { kcal: 110, proteinG: 15, carbsG: 6, fatG: 3 }, tags: ['veg', 'gluten_free'] }),
  intl({ id: 'banana', name: 'Banana', cuisine: 'international', serving: '1 medium (~118 g)', servingGrams: 118, per: { kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fibreG: 3 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'apple', name: 'Apple', cuisine: 'international', serving: '1 medium (~180 g)', servingGrams: 180, per: { kcal: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fibreG: 4.4 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'almonds', name: 'Almonds', cuisine: 'international', serving: '28 g (~23 nuts)', servingGrams: 28, per: { kcal: 164, proteinG: 6, carbsG: 6, fatG: 14, fibreG: 3.5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'peanut-butter', name: 'Peanut butter', cuisine: 'international', serving: '2 tbsp (32 g)', servingGrams: 32, per: { kcal: 190, proteinG: 7, carbsG: 7, fatG: 16, fibreG: 2 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'bread-whole-wheat', name: 'Whole-wheat bread', cuisine: 'international', serving: '1 slice (~30 g)', servingGrams: 30, per: { kcal: 80, proteinG: 4, carbsG: 14, fatG: 1, fibreG: 2 }, tags: ['veg', 'vegan'] }),
  intl({ id: 'sweet-potato', name: 'Sweet potato (baked)', cuisine: 'international', serving: '150 g', servingGrams: 150, per: { kcal: 135, proteinG: 3, carbsG: 31, fatG: 0.2, fibreG: 5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'pasta-cooked', name: 'Pasta (cooked)', cuisine: 'international', serving: '1 cup (~140 g)', servingGrams: 140, per: { kcal: 220, proteinG: 8, carbsG: 43, fatG: 1.3, fibreG: 2.5 }, tags: ['veg', 'vegan'] }),
  intl({ id: 'olive-oil', name: 'Olive oil', cuisine: 'international', serving: '1 tbsp (14 g)', servingGrams: 14, per: { kcal: 120, proteinG: 0, carbsG: 0, fatG: 14 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'ghee', name: 'Ghee', cuisine: 'international', serving: '1 tsp (5 g)', servingGrams: 5, per: { kcal: 45, proteinG: 0, carbsG: 0, fatG: 5 }, tags: ['veg', 'gluten_free'] }),
  intl({ id: 'whey-scoop', name: 'Whey protein (check your label)', cuisine: 'international', serving: '1 scoop (~30 g)', servingGrams: 30, per: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 }, tags: ['veg', 'gluten_free'] }),
  intl({ id: 'broccoli', name: 'Broccoli (cooked)', cuisine: 'international', serving: '1 cup (~150 g)', servingGrams: 150, per: { kcal: 55, proteinG: 4, carbsG: 11, fatG: 0.6, fibreG: 5 }, tags: ['veg', 'vegan', 'gluten_free'] }),
  intl({ id: 'salad-mixed', name: 'Mixed green salad (no dressing)', cuisine: 'international', serving: '1 bowl (~100 g)', servingGrams: 100, per: { kcal: 20, proteinG: 1.5, carbsG: 3.5, fatG: 0.2, fibreG: 2 }, tags: ['veg', 'vegan', 'gluten_free'] }),
];

export function searchFoods(query: string, limit = 25): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOODS.slice(0, limit);
  const scored = FOODS.map((f) => {
    const hay = [f.name, ...f.aliases].map((s) => s.toLowerCase());
    const score = hay.some((h) => h.startsWith(q)) ? 2 : hay.some((h) => h.includes(q)) ? 1 : 0;
    return { f, score };
  }).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name)).slice(0, limit).map((x) => x.f);
}

export function scaleMacros(per: FoodItem['per'], servings: number): FoodItem['per'] {
  const r = (n: number) => Math.round(n * servings * 10) / 10;
  return { kcal: Math.round(per.kcal * servings), proteinG: r(per.proteinG), carbsG: r(per.carbsG), fatG: r(per.fatG), fibreG: per.fibreG !== undefined ? r(per.fibreG) : undefined };
}
