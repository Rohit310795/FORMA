import type { DiscomfortLog, Joint } from '../schemas/wellness';

/**
 * Deterministic discomfort triage. This never diagnoses. It decides how
 * strongly to point someone toward professional care and which movement
 * categories to set aside. It runs in the app and on the server, independently
 * of any AI model.
 */

export type SafetyLevel = 'ok' | 'modify' | 'see_professional' | 'see_professional_promptly' | 'urgent';

export const SAFETY_LEVEL_RANK: Record<SafetyLevel, number> = {
  ok: 0,
  modify: 1,
  see_professional: 2,
  see_professional_promptly: 3,
  urgent: 4,
};

export interface DiscomfortAssessment {
  level: SafetyLevel;
  headline: string;
  reasons: string[];
  guidance: string[];
  /** Exercise load tags to avoid while this discomfort is current. */
  avoidTags: string[];
  /** True when training that region should pause entirely until assessed. */
  pauseRegion: boolean;
}

const JOINT_TAGS: Record<Joint, { mild: string[]; moderate: string[] }> = {
  knee: { mild: ['impact', 'plyometric'], moderate: ['impact', 'plyometric', 'deep_knee_flexion', 'pivoting', 'kneeling'] },
  hip: { mild: ['impact'], moderate: ['impact', 'plyometric', 'deep_hip_flexion'] },
  ankle: { mild: ['impact'], moderate: ['impact', 'plyometric', 'balance_unstable'] },
  foot: { mild: ['impact'], moderate: ['impact', 'plyometric'] },
  shoulder: { mild: ['overhead'], moderate: ['overhead', 'deep_shoulder_extension', 'hanging'] },
  elbow: { mild: ['heavy_grip'], moderate: ['heavy_grip', 'elbow_flexion_heavy'] },
  wrist: { mild: ['wrist_extension_load'], moderate: ['wrist_extension_load', 'heavy_grip'] },
  neck: { mild: ['neck_load'], moderate: ['neck_load', 'overhead'] },
  upper_back: { mild: [], moderate: ['heavy_spinal_load'] },
  lower_back: { mild: ['spinal_flexion_loaded'], moderate: ['spinal_flexion_loaded', 'heavy_spinal_load', 'impact'] },
};

const AGGRAVATOR_TAGS: Record<string, string[]> = {
  stairs: ['step'],
  squatting: ['deep_knee_flexion'],
  kneeling: ['kneeling'],
  running: ['impact'],
  jumping: ['impact', 'plyometric'],
  overhead: ['overhead'],
  lifting: ['heavy_spinal_load'],
};

export const JOINT_LABEL: Record<Joint, string> = {
  knee: 'knee',
  hip: 'hip',
  ankle: 'ankle',
  foot: 'foot',
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  neck: 'neck',
  upper_back: 'upper back',
  lower_back: 'lower back',
};

type AssessInput = Pick<
  DiscomfortLog,
  | 'joint'
  | 'severity'
  | 'sharpPain'
  | 'swelling'
  | 'locking'
  | 'instability'
  | 'recentInjury'
  | 'canBearWeight'
  | 'hotOrRed'
  | 'feverOrUnwell'
  | 'numbnessOrTingling'
  | 'trend'
  | 'aggravators'
> & { durationDays?: number };

export function assessDiscomfort(log: AssessInput): DiscomfortAssessment {
  const joint = JOINT_LABEL[log.joint];
  const reasons: string[] = [];
  let level = (log.severity > 0 || log.sharpPain ? 'modify' : 'ok') as SafetyLevel;
  const raise = (to: SafetyLevel, reason: string) => {
    reasons.push(reason);
    if (SAFETY_LEVEL_RANK[to] > SAFETY_LEVEL_RANK[level]) level = to;
  };

  if (log.hotOrRed && log.feverOrUnwell) raise('urgent', `A hot or red, swollen ${joint} with fever or feeling unwell`);
  if (log.locking) raise('see_professional_promptly', `The ${joint} locking or catching`);
  if (log.instability === 'substantial') raise('see_professional_promptly', `Substantial instability or giving way`);
  if (log.recentInjury && !log.canBearWeight) raise('see_professional_promptly', 'Unable to bear weight after an injury');
  if (log.swelling === 'significant') raise('see_professional_promptly', 'Significant swelling');
  if (log.numbnessOrTingling) raise('see_professional_promptly', 'Numbness or tingling');
  if (log.trend === 'rapidly_worse') raise('see_professional_promptly', 'Symptoms getting rapidly worse');
  if (log.severity >= 8) raise('see_professional_promptly', 'Severe discomfort (8/10 or higher)');
  if (log.hotOrRed && !log.feverOrUnwell) raise('see_professional', `The ${joint} looks hot or red`);
  if (log.severity >= 6) raise('see_professional', 'Discomfort rated 6/10 or higher');
  if ((log.durationDays ?? 0) >= 14 && log.trend !== 'better') raise('see_professional', 'Discomfort lasting two weeks or more without improving');
  if (log.instability === 'occasional') raise('see_professional', 'Occasional giving way');
  if (log.sharpPain) reasons.push('Sharp pain during movement');

  const tags = new Set<string>();
  const jt = JOINT_TAGS[log.joint];
  (log.severity >= 4 || log.sharpPain ? jt.moderate : jt.mild).forEach((t) => tags.add(t));
  for (const a of log.aggravators ?? []) (AGGRAVATOR_TAGS[a] ?? []).forEach((t) => tags.add(t));
  if (level === 'ok') tags.clear();

  const pauseRegion = SAFETY_LEVEL_RANK[level] >= SAFETY_LEVEL_RANK.see_professional_promptly;
  const guidance: string[] = [];
  let headline: string;
  switch (level) {
    case 'urgent':
      headline = 'Please seek urgent medical assessment';
      guidance.push(
        'A hot, red, swollen joint together with fever or feeling unwell needs to be checked by a doctor urgently — today, via urgent care or emergency services.',
        'Do not exercise this joint until you have been assessed.',
      );
      break;
    case 'see_professional_promptly':
      headline = 'Get this checked by a professional soon';
      guidance.push(
        `What you have described is worth a prompt assessment by a doctor or physiotherapist before training your ${joint} again.`,
        `Pause exercises that load your ${joint} for now. Gentle movement of other areas is fine if it is comfortable.`,
        'If symptoms are severe or rapidly worsening, seek care straight away.',
      );
      break;
    case 'see_professional':
      headline = 'Consider a professional opinion';
      guidance.push(
        `Consider booking an appointment with a physiotherapist or doctor to look at your ${joint}.`,
        'Meanwhile, choose comfortable variations and reduce load or range of motion.',
      );
      break;
    case 'modify':
      headline = 'Train around it, gently';
      guidance.push(
        'Choose movements that stay comfortable. Mild, settling discomfort can be okay; sharp or worsening pain is a signal to stop that movement.',
        'Reduce load, range of motion or volume, and check in again next session.',
      );
      break;
    default:
      headline = 'No discomfort reported';
  }
  if (log.sharpPain && level !== 'urgent') guidance.push('Stop any movement that causes sharp pain. Do not push through it.');
  guidance.push('FORMA offers general exercise education — it cannot diagnose a condition or replace professional care.');

  return { level, headline, reasons, guidance, avoidTags: [...tags], pauseRegion };
}

/** Combines several recent logs; the strictest level wins and tags are unioned. */
export function combineAssessments(list: DiscomfortAssessment[]): DiscomfortAssessment | undefined {
  if (!list.length) return undefined;
  const strictest = [...list].sort((a, b) => SAFETY_LEVEL_RANK[b.level] - SAFETY_LEVEL_RANK[a.level])[0]!;
  return {
    ...strictest,
    reasons: [...new Set(list.flatMap((l) => l.reasons))],
    avoidTags: [...new Set(list.flatMap((l) => l.avoidTags))],
    pauseRegion: list.some((l) => l.pauseRegion),
  };
}
