/**
 * Supplement education entries. Summaries are deliberately cautious and point
 * to the public reference each is based on. No products, prices, brands,
 * certifications or reviews are included.
 */

export interface SupplementReference {
  id: string;
  name: string;
  category: 'performance' | 'protein' | 'vitamin' | 'mineral' | 'fatty_acid' | 'general';
  evidence: 'strong' | 'moderate' | 'limited';
  summary: string;
  commonUse: string;
  cautions: string[];
  interactions: string[];
  sources: { title: string; publisher: string }[];
}

const PHARMACIST = 'Check with a doctor or pharmacist first if you take medicines, are pregnant or breastfeeding, or have a health condition.';

export const SUPPLEMENTS: SupplementReference[] = [
  {
    id: 'creatine-monohydrate', name: 'Creatine monohydrate', category: 'performance', evidence: 'strong',
    summary: 'One of the most researched sports supplements. Alongside resistance training, it is consistently associated with small improvements in strength and high-intensity performance.',
    commonUse: 'Research commonly uses about 3–5 g per day.',
    cautions: ['May cause water-weight gain or stomach upset in some people.', 'People with kidney disease should speak to their doctor before use.', PHARMACIST],
    interactions: ['Discuss with your doctor if you take medicines that affect the kidneys.'],
    sources: [{ title: 'Position stand: safety and efficacy of creatine supplementation (2017)', publisher: 'International Society of Sports Nutrition' }],
  },
  {
    id: 'whey-protein', name: 'Whey protein', category: 'protein', evidence: 'strong',
    summary: 'A convenient dairy-based protein source. It helps people reach a daily protein target; it is not more effective than the same protein from food.',
    commonUse: 'Used to top up daily protein when food alone is inconvenient.',
    cautions: ['Contains milk protein — not suitable with a dairy allergy.', 'May contain lactose; isolates usually contain less.', 'Check labels for added sugars and third-party testing.'],
    interactions: [],
    sources: [{ title: 'Position stand: protein and exercise (2017)', publisher: 'International Society of Sports Nutrition' }],
  },
  {
    id: 'vitamin-d', name: 'Vitamin D', category: 'vitamin', evidence: 'moderate',
    summary: 'Important for bone health. Many people have low levels, but whether you need a supplement — and how much — is best decided with a clinician, ideally after a blood test.',
    commonUse: 'Doses vary by country guidance; the adult tolerable upper intake level is 4,000 IU (100 mcg) per day.',
    cautions: ['Taking too much over time can be harmful.', 'Do not self-treat a suspected deficiency with high doses.', PHARMACIST],
    interactions: ['Can interact with some medicines, including certain diuretics and steroids.'],
    sources: [{ title: 'Vitamin D — Fact Sheet for Health Professionals', publisher: 'NIH Office of Dietary Supplements' }],
  },
  {
    id: 'omega-3', name: 'Omega-3 (fish oil)', category: 'fatty_acid', evidence: 'moderate',
    summary: 'Provides EPA and DHA. Eating fatty fish is a common food-first approach. Evidence for supplements varies by outcome.',
    commonUse: 'Often used by people who rarely eat oily fish.',
    cautions: ['May cause fishy aftertaste or stomach upset.', PHARMACIST],
    interactions: ['May increase bleeding risk with blood thinners such as warfarin.'],
    sources: [{ title: 'Omega-3 Fatty Acids — Fact Sheet for Health Professionals', publisher: 'NIH Office of Dietary Supplements' }],
  },
  {
    id: 'caffeine', name: 'Caffeine', category: 'performance', evidence: 'strong',
    summary: 'Can improve endurance and some aspects of strength and alertness for many people.',
    commonUse: 'For healthy adults, up to about 400 mg per day from all sources is generally considered acceptable by food-safety agencies.',
    cautions: ['Can disrupt sleep — avoid late in the day.', 'Lower limits apply during pregnancy.', 'May worsen anxiety, palpitations or reflux.', PHARMACIST],
    interactions: ['Interacts with some medicines and stimulants.'],
    sources: [{ title: 'Position stand: caffeine and exercise performance (2021)', publisher: 'International Society of Sports Nutrition' }],
  },
  {
    id: 'magnesium', name: 'Magnesium', category: 'mineral', evidence: 'limited',
    summary: 'Essential mineral found in nuts, seeds, legumes and whole grains. Supplements are mainly useful when intake is low.',
    commonUse: 'Supplemental upper limit for adults is 350 mg/day (from supplements, not food).',
    cautions: ['High doses commonly cause diarrhoea.', 'People with kidney disease should not supplement without medical advice.', PHARMACIST],
    interactions: ['Can reduce absorption of some antibiotics and osteoporosis medicines — separate doses as advised by a pharmacist.'],
    sources: [{ title: 'Magnesium — Fact Sheet for Health Professionals', publisher: 'NIH Office of Dietary Supplements' }],
  },
  {
    id: 'multivitamin', name: 'Multivitamin/mineral', category: 'general', evidence: 'limited',
    summary: 'Can help fill gaps in a restricted diet. Evidence that multivitamins prevent chronic disease in generally healthy people is limited.',
    commonUse: 'Sometimes used with restrictive diets or low food variety.',
    cautions: ['Check for overlap with other supplements to avoid excessive intake.', PHARMACIST],
    interactions: ['Some ingredients (e.g. vitamin K) interact with blood thinners.'],
    sources: [{ title: 'Multivitamin/mineral Supplements — Fact Sheet for Health Professionals', publisher: 'NIH Office of Dietary Supplements' }],
  },
  {
    id: 'iron', name: 'Iron', category: 'mineral', evidence: 'moderate',
    summary: 'Treats confirmed iron deficiency. It should not be taken “just in case” — excess iron can be harmful.',
    commonUse: 'Only when a clinician confirms deficiency.',
    cautions: ['Get tested before supplementing.', 'Keep away from children — accidental overdose is dangerous.', PHARMACIST],
    interactions: ['Can interfere with thyroid medicine and some antibiotics.'],
    sources: [{ title: 'Iron — Fact Sheet for Health Professionals', publisher: 'NIH Office of Dietary Supplements' }],
  },
  {
    id: 'beta-alanine', name: 'Beta-alanine', category: 'performance', evidence: 'moderate',
    summary: 'May help performance in high-intensity efforts lasting about 1–4 minutes.',
    commonUse: 'Studied as daily loading over several weeks.',
    cautions: ['Harmless tingling (paraesthesia) is common.', PHARMACIST],
    interactions: [],
    sources: [{ title: 'Position stand: beta-alanine (2015)', publisher: 'International Society of Sports Nutrition' }],
  },
];

export const SUPPLEMENT_MAP = new Map(SUPPLEMENTS.map((s) => [s.id, s]));
