import type { Joint } from '../schemas/wellness';

/**
 * General joint-health education. These are examples for an exercise education
 * library — not a treatment prescription, and never assigned automatically
 * from a pain score.
 */

export interface JointEducation {
  joint: Joint;
  title: string;
  intro: string;
  exerciseIds: string[];
  mobilityRoutineIds: string[];
  activityTips: string[];
  seekCare: string[];
  progression: string;
}

const COMMON_SEEK_CARE = [
  'A hot, red, swollen joint with fever or feeling unwell — seek urgent medical care.',
  'Severe or rapidly worsening pain — seek professional care promptly.',
  'Numbness, tingling or weakness that doesn’t settle — see a doctor.',
];

export const JOINT_EDUCATION: JointEducation[] = [
  {
    joint: 'knee',
    title: 'Knee health basics',
    intro:
      'Strong thighs, hips and calves help share load around the knee. Many people with knee discomfort find that gentle, gradually progressed strengthening and staying active help, but what suits you depends on your situation — follow any clinician instructions first.',
    exerciseIds: [
      'quad-set',
      'straight-leg-raise',
      'seated-knee-extension',
      'terminal-knee-extension',
      'glute-bridge',
      'side-lying-hip-abduction',
      'lateral-band-walk',
      'lying-leg-curl',
      'standing-calf-raise',
      'sit-to-stand',
      'box-squat',
      'wall-sit',
      'step-up',
      'single-leg-balance',
      'heel-slide',
    ],
    mobilityRoutineIds: ['knee-friendly-mobility', 'hips-mobility', 'ankle-mobility'],
    activityTips: [
      'Swap high-impact work (jumping, running downhill) for cycling, swimming or walking while knees are sensitive.',
      'Reduce depth: box squats or higher seats instead of deep squats.',
      'Use a handrail on stairs and lead up with the more comfortable leg.',
      'A pain level that stays mild (around 3/10 or less) and settles by the next day is often used as a practical guide for activity — sharp or worsening pain is a signal to stop.',
      'Progress one thing at a time: range, then repetitions, then load.',
    ],
    seekCare: [
      'Your knee locks or catches and won’t straighten.',
      'Substantial instability or the knee giving way.',
      'You can’t bear weight after an injury.',
      'Significant swelling, especially soon after an injury.',
      ...COMMON_SEEK_CARE,
    ],
    progression:
      'Start with isometrics and range-of-motion work, then add bodyweight strength (bridges, sit-to-stand), then step-ups and reduced-depth squats, then gradual load. Move on only when the current stage feels comfortable for a week or more.',
  },
  {
    joint: 'hip',
    title: 'Hip health basics',
    intro: 'Hip strength and mobility support walking, stairs and lifting. Glute and hip-abductor work is a common foundation.',
    exerciseIds: ['glute-bridge', 'side-lying-hip-abduction', 'lateral-band-walk', 'hip-thrust', 'bird-dog', 'step-up'],
    mobilityRoutineIds: ['hips-mobility', 'desk-mobility'],
    activityTips: ['Break up long periods of sitting.', 'Choose comfortable stance widths when squatting.'],
    seekCare: ['Groin pain after a fall, or inability to bear weight.', ...COMMON_SEEK_CARE],
    progression: 'Bodyweight → bands → loaded bridges and hip thrusts.',
  },
  {
    joint: 'ankle',
    title: 'Ankle & foot basics',
    intro: 'Calf strength and balance help the ankle cope with walking, running and stairs.',
    exerciseIds: ['standing-calf-raise', 'seated-calf-raise', 'single-leg-balance'],
    mobilityRoutineIds: ['ankle-mobility', 'calves-mobility'],
    activityTips: ['Build running volume gradually.', 'Balance work can be done while brushing your teeth.'],
    seekCare: ['You can’t take four steps after an ankle injury, or there is bony tenderness.', ...COMMON_SEEK_CARE],
    progression: 'Double-leg → single-leg calf raises; balance with eyes open → eyes closed.',
  },
  {
    joint: 'foot',
    title: 'Foot basics',
    intro: 'Calf and foot strength support the arch. Footwear comfort matters.',
    exerciseIds: ['standing-calf-raise', 'single-leg-balance'],
    mobilityRoutineIds: ['calves-mobility'],
    activityTips: ['Change training surfaces gradually.'],
    seekCare: COMMON_SEEK_CARE,
    progression: 'Gradually add volume to calf raises and balance holds.',
  },
  {
    joint: 'shoulder',
    title: 'Shoulder health basics',
    intro: 'Upper-back and rear-shoulder strength balance pressing work. Many people do well with lighter, controlled ranges while a shoulder is sensitive.',
    exerciseIds: ['band-pull-apart', 'face-pull', 'rear-delt-fly', 'seated-cable-row', 'push-up'],
    mobilityRoutineIds: ['shoulder-mobility', 'thoracic-mobility'],
    activityTips: ['Swap overhead pressing for landmine or incline pressing if overhead is uncomfortable.', 'Keep pressing and pulling volumes roughly balanced.'],
    seekCare: ['Sudden weakness lifting the arm after an injury.', 'Visible deformity after a fall.', ...COMMON_SEEK_CARE],
    progression: 'Bands → light dumbbells → full exercises in comfortable ranges.',
  },
  {
    joint: 'elbow',
    title: 'Elbow basics',
    intro: 'Elbow discomfort often relates to grip-heavy work. Managing grip load and building forearm strength gradually is a common approach.',
    exerciseIds: ['hammer-curl', 'cable-triceps-pushdown'],
    mobilityRoutineIds: ['desk-mobility'],
    activityTips: ['Use straps or thicker handles temporarily to reduce grip demand.'],
    seekCare: COMMON_SEEK_CARE,
    progression: 'Light, slow reps → gradual load increases.',
  },
  {
    joint: 'wrist',
    title: 'Wrist basics',
    intro: 'Wrist comfort in push-ups and presses often improves with neutral grips or handles.',
    exerciseIds: ['incline-push-up', 'farmer-carry'],
    mobilityRoutineIds: ['desk-mobility'],
    activityTips: ['Use push-up handles or fists to keep the wrist neutral.'],
    seekCare: ['Pain at the base of the thumb after a fall onto the hand.', ...COMMON_SEEK_CARE],
    progression: 'Neutral-grip options → gradually return to standard grips.',
  },
  {
    joint: 'neck',
    title: 'Neck & upper back basics',
    intro: 'Posture variety and upper-back strength help many people feel better through long desk days.',
    exerciseIds: ['band-pull-apart', 'face-pull', 'seated-cable-row'],
    mobilityRoutineIds: ['neck-upper-back-mobility', 'desk-mobility', 'thoracic-mobility'],
    activityTips: ['Change position every 30–45 minutes.', 'Raise your screen to eye level.'],
    seekCare: ['Neck pain with arm weakness, numbness or after a significant impact.', ...COMMON_SEEK_CARE],
    progression: 'Mobility → light band work → rows.',
  },
  {
    joint: 'upper_back',
    title: 'Upper back basics',
    intro: 'Thoracic mobility and rowing strength support overhead work and posture variety.',
    exerciseIds: ['seated-cable-row', 'band-pull-apart', 'face-pull'],
    mobilityRoutineIds: ['thoracic-mobility'],
    activityTips: ['Add a set of rows for each pressing exercise.'],
    seekCare: COMMON_SEEK_CARE,
    progression: 'Bands → cables → free weights.',
  },
  {
    joint: 'lower_back',
    title: 'Lower back basics',
    intro: 'Staying gently active is generally encouraged for everyday back discomfort. Core endurance and hip strength are common foundations.',
    exerciseIds: ['bird-dog', 'dead-bug', 'side-plank', 'glute-bridge', 'suitcase-carry'],
    mobilityRoutineIds: ['hips-mobility', 'hamstrings-mobility'],
    activityTips: ['Reduce heavy spinal loading temporarily.', 'Walking is often well tolerated.'],
    seekCare: [
      'Back pain with loss of bladder or bowel control, or numbness around the groin — seek emergency care.',
      'Back pain after a significant fall or with unexplained weight loss or fever.',
      ...COMMON_SEEK_CARE,
    ],
    progression: 'Core endurance → hip hinge patterning → gradual return to loaded lifts.',
  },
];

export function getJointEducation(joint: Joint): JointEducation | undefined {
  return JOINT_EDUCATION.find((j) => j.joint === joint);
}
