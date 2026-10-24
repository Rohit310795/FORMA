export interface MobilityStep {
  name: string;
  /** Either a duration or reps. */
  durationSec?: number;
  reps?: number;
  perSide?: boolean;
  cue: string;
}

export interface MobilityRoutine {
  id: string;
  name: string;
  area: 'hips' | 'ankles' | 'hamstrings' | 'quads' | 'shoulders' | 'thoracic' | 'calves' | 'neck' | 'general' | 'knee';
  kind: 'warmup' | 'cooldown' | 'mobility' | 'flexibility';
  minutes: number;
  description: string;
  steps: MobilityStep[];
  kneeFriendly: boolean;
}

export const MOBILITY_ROUTINES: MobilityRoutine[] = [
  {
    id: 'general-warmup', name: 'Movement Prep Warm-Up', area: 'general', kind: 'warmup', minutes: 6, kneeFriendly: true,
    description: 'Raise temperature and rehearse movement before training.',
    steps: [
      { name: 'March in place', durationSec: 60, cue: 'Swing your arms and breathe easily.' },
      { name: 'Arm circles', reps: 10, cue: 'Small to big circles, both directions.' },
      { name: 'Hip hinge practice', reps: 10, cue: 'Hands on hips, push hips back with a flat back.' },
      { name: 'Bodyweight squat to comfortable depth', reps: 10, cue: 'Smooth and controlled.' },
      { name: 'World’s greatest stretch', reps: 4, perSide: true, cue: 'Lunge, elbow to instep, then rotate up.' },
      { name: 'Glute bridge', reps: 10, cue: 'Squeeze at the top.' },
    ],
  },
  {
    id: 'post-workout-cooldown', name: 'Post-Workout Cooldown', area: 'general', kind: 'cooldown', minutes: 8, kneeFriendly: true,
    description: 'Gentle stretches and slow breathing to wind down.',
    steps: [
      { name: 'Easy walk', durationSec: 120, cue: 'Let your breathing settle.' },
      { name: 'Standing quad stretch', durationSec: 30, perSide: true, cue: 'Hold a support; gentle stretch only.' },
      { name: 'Seated hamstring stretch', durationSec: 30, perSide: true, cue: 'Hinge forward with a long spine.' },
      { name: 'Chest doorway stretch', durationSec: 30, cue: 'Forearm on the frame, step through gently.' },
      { name: 'Child’s pose or supported forward fold', durationSec: 45, cue: 'Breathe slowly into your back.' },
      { name: 'Box breathing', durationSec: 60, cue: 'In 4, hold 4, out 4, hold 4.' },
    ],
  },
  {
    id: 'hips-mobility', name: 'Hip Mobility', area: 'hips', kind: 'mobility', minutes: 8, kneeFriendly: true,
    description: 'Open the hips for squats, hinges and long days sitting.',
    steps: [
      { name: '90/90 hip switches', reps: 8, cue: 'Sit tall and rotate knees side to side.' },
      { name: 'Half-kneeling hip flexor stretch', durationSec: 40, perSide: true, cue: 'Tuck the pelvis; pad the knee.' },
      { name: 'Figure-4 stretch (lying)', durationSec: 40, perSide: true, cue: 'Ankle over opposite knee, pull gently.' },
      { name: 'Adductor rock-back', reps: 10, perSide: true, cue: 'One leg out to the side, rock hips back.' },
      { name: 'Glute bridge', reps: 12, cue: 'Finish with a strong squeeze.' },
    ],
  },
  {
    id: 'ankle-mobility', name: 'Ankle Mobility', area: 'ankles', kind: 'mobility', minutes: 5, kneeFriendly: true,
    description: 'Improve ankle bend for squats and stairs.',
    steps: [
      { name: 'Knee-to-wall rocks', reps: 12, perSide: true, cue: 'Heel down, knee travels over toes.' },
      { name: 'Ankle circles', reps: 10, perSide: true, cue: 'Slow, full circles.' },
      { name: 'Calf raise with slow lower', reps: 10, cue: '3 seconds down.' },
    ],
  },
  {
    id: 'hamstrings-mobility', name: 'Hamstring Flexibility', area: 'hamstrings', kind: 'flexibility', minutes: 6, kneeFriendly: true,
    description: 'Gentle hamstring work for hinging comfort.',
    steps: [
      { name: 'Lying hamstring stretch with strap', durationSec: 45, perSide: true, cue: 'Keep the other leg relaxed.' },
      { name: 'Hip hinge with dowel', reps: 10, cue: 'Dowel touches head, upper back and tailbone.' },
      { name: 'Seated forward reach', durationSec: 45, cue: 'Long spine, breathe out to relax.' },
    ],
  },
  {
    id: 'quads-mobility', name: 'Quad & Hip Flexor Release', area: 'quads', kind: 'flexibility', minutes: 5, kneeFriendly: false,
    description: 'Stretch the front of the thighs and hips.',
    steps: [
      { name: 'Standing quad stretch', durationSec: 40, perSide: true, cue: 'Knees together, tuck pelvis.' },
      { name: 'Couch stretch (modified)', durationSec: 40, perSide: true, cue: 'Only as deep as comfortable; skip if kneeling hurts.' },
    ],
  },
  {
    id: 'shoulder-mobility', name: 'Shoulder Mobility', area: 'shoulders', kind: 'mobility', minutes: 7, kneeFriendly: true,
    description: 'Prepare shoulders for pressing and pulling.',
    steps: [
      { name: 'Band pull-apart', reps: 15, cue: 'Squeeze shoulder blades.' },
      { name: 'Wall slides', reps: 10, cue: 'Forearms on the wall, slide up keeping ribs down.' },
      { name: 'Sleeper stretch (gentle)', durationSec: 30, perSide: true, cue: 'Mild stretch only.' },
      { name: 'Band dislocates', reps: 10, cue: 'Wide grip; never force.' },
    ],
  },
  {
    id: 'thoracic-mobility', name: 'Thoracic Spine Mobility', area: 'thoracic', kind: 'mobility', minutes: 6, kneeFriendly: true,
    description: 'Upper-back rotation and extension for posture and overhead work.',
    steps: [
      { name: 'Open books', reps: 8, perSide: true, cue: 'Lie on your side, rotate the top arm open.' },
      { name: 'Cat–camel', reps: 10, cue: 'Move slowly through the whole spine.' },
      { name: 'Thread the needle', reps: 6, perSide: true, cue: 'Reach under, then rotate open.' },
    ],
  },
  {
    id: 'calves-mobility', name: 'Calf Stretch Series', area: 'calves', kind: 'flexibility', minutes: 4, kneeFriendly: true,
    description: 'Straight- and bent-knee calf stretches.',
    steps: [
      { name: 'Wall calf stretch (straight knee)', durationSec: 40, perSide: true, cue: 'Heel down.' },
      { name: 'Wall calf stretch (bent knee)', durationSec: 40, perSide: true, cue: 'Sink the knee forward.' },
    ],
  },
  {
    id: 'neck-upper-back-mobility', name: 'Neck & Upper Back Relief', area: 'neck', kind: 'mobility', minutes: 5, kneeFriendly: true,
    description: 'Gentle movement for desk-day stiffness.',
    steps: [
      { name: 'Chin tucks', reps: 10, cue: 'Glide the head back, keep eyes level.' },
      { name: 'Neck side bend', durationSec: 20, perSide: true, cue: 'Ear toward shoulder, gentle.' },
      { name: 'Shoulder rolls', reps: 10, cue: 'Big slow circles backward.' },
      { name: 'Upper trap stretch', durationSec: 20, perSide: true, cue: 'Hand under thigh, lean away gently.' },
    ],
  },
  {
    id: 'desk-mobility', name: 'Desk Mobility Break', area: 'general', kind: 'mobility', minutes: 5, kneeFriendly: true,
    description: 'Release tension without leaving your desk.',
    steps: [
      { name: 'Seated spinal twist', durationSec: 20, perSide: true, cue: 'Sit tall, rotate gently.' },
      { name: 'Wrist flexor & extensor stretch', durationSec: 20, perSide: true, cue: 'Gentle pull on fingers.' },
      { name: 'Seated figure-4', durationSec: 30, perSide: true, cue: 'Ankle on knee, lean forward.' },
      { name: 'Stand and reach overhead', reps: 5, cue: 'Big breath in as you reach.' },
    ],
  },
  {
    id: 'knee-friendly-mobility', name: 'Knee-Friendly Mobility', area: 'knee', kind: 'mobility', minutes: 8, kneeFriendly: true,
    description: 'Comfortable range-of-motion and activation work. Stay within a pain-free range.',
    steps: [
      { name: 'Heel slides', reps: 10, perSide: true, cue: 'Slide only as far as comfortable.' },
      { name: 'Quad sets', reps: 10, perSide: true, cue: 'Hold each squeeze 5 seconds.' },
      { name: 'Seated knee extension', reps: 10, perSide: true, cue: 'Slow and controlled.' },
      { name: 'Ankle pumps', reps: 20, cue: 'Point and flex.' },
      { name: 'Side-lying hip abduction', reps: 10, perSide: true, cue: 'Hips stacked.' },
    ],
  },
  {
    id: 'yoga-flow', name: 'Gentle Yoga Flow', area: 'general', kind: 'flexibility', minutes: 15, kneeFriendly: false,
    description: 'A calming full-body flow.',
    steps: [
      { name: 'Cat–cow', reps: 8, cue: 'Move with the breath.' },
      { name: 'Downward dog (bent knees ok)', durationSec: 45, cue: 'Push the floor away.' },
      { name: 'Low lunge', durationSec: 40, perSide: true, cue: 'Pad the back knee.' },
      { name: 'Child’s pose', durationSec: 60, cue: 'Breathe into your back.' },
      { name: 'Supine twist', durationSec: 40, perSide: true, cue: 'Let gravity do the work.' },
      { name: 'Legs up the wall', durationSec: 120, cue: 'Slow breathing.' },
    ],
  },
];

export const MOBILITY_MAP = new Map(MOBILITY_ROUTINES.map((r) => [r.id, r]));
