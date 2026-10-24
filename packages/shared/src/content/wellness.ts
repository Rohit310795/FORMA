export interface EducationCard {
  id: string;
  title: string;
  body: string;
  topic: 'skincare' | 'sleep' | 'stress' | 'hydration' | 'habits' | 'core' | 'nutrition';
}

export const EDUCATION: EducationCard[] = [
  { id: 'cleanser', topic: 'skincare', title: 'Cleanser', body: 'A gentle, fragrance-free cleanser once or twice a day is enough for most people. Over-washing can leave skin dry or irritated.' },
  { id: 'moisturiser', topic: 'skincare', title: 'Moisturiser', body: 'Moisturiser supports the skin barrier. Lighter gels suit oily skin; creams suit drier skin. Apply to slightly damp skin.' },
  { id: 'sunscreen', topic: 'skincare', title: 'Sunscreen', body: 'Broad-spectrum SPF 30+ every morning, reapplied every two hours outdoors or after sweating, is one of the most effective daily skin habits.' },
  { id: 'new-products', topic: 'skincare', title: 'Trying new products', body: 'Introduce one product at a time and patch-test first. See a dermatologist for persistent acne, rashes or changing moles. Results vary; no routine guarantees a particular appearance.' },
  { id: 'sleep-routine', topic: 'sleep', title: 'Consistent sleep timing', body: 'Going to bed and waking at similar times — including weekends — is one of the most reliable sleep habits.' },
  { id: 'wind-down', topic: 'sleep', title: 'Wind-down', body: 'Dim lights and screens 30–60 minutes before bed, keep the room cool and dark, and limit caffeine after early afternoon.' },
  { id: 'stress-breathing', topic: 'stress', title: 'Breathing breaks', body: 'Slow breathing (for example, in for 4 and out for 6) for a few minutes can help many people feel calmer.' },
  { id: 'hydration-basics', topic: 'hydration', title: 'Hydration basics', body: 'Needs vary with body size, climate and activity. Pale-yellow urine is a simple everyday guide. Targets in FORMA are adjustable guidance, not medical requirements.' },
  { id: 'habit-stacking', topic: 'habits', title: 'Habit stacking', body: 'Attach a new habit to an existing one — for example, a 2-minute mobility routine right after brushing your teeth.' },
  { id: 'spot-reduction', topic: 'core', title: 'Core training and belly fat', body: 'Abdominal exercises strengthen your core, but they do not selectively burn fat from your stomach. Overall fat loss comes from a sustained energy balance over time.' },
  { id: 'energy-estimates', topic: 'nutrition', title: 'About calorie estimates', body: 'BMR and TDEE are estimated with population equations (Mifflin–St Jeor plus an activity multiplier). Individual needs can differ by 10% or more, so FORMA treats them as a starting point and suggests adjusting from your real trends.' },
];

export const DEFAULT_ROUTINES = {
  skincare_am: { name: 'Morning skincare', steps: ['Gentle cleanse', 'Moisturise', 'Sunscreen SPF 30+'] },
  skincare_pm: { name: 'Evening skincare', steps: ['Remove sunscreen / makeup', 'Gentle cleanse', 'Moisturise'] },
  wind_down: { name: 'Wind-down', steps: ['Screens away', 'Dim the lights', '5 minutes of slow breathing', 'Lights out'] },
  habit: { name: 'Daily habits', steps: ['10-minute walk', 'Drink a glass of water on waking', '2-minute mobility break'] },
} as const;
