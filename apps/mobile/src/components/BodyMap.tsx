import { View } from 'react-native';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';
import type { Muscle } from '@forma/shared';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';

/**
 * Stylised front/back muscle map. Regions are tappable. Colour shows recent
 * logged training volume or the user's selection — never "injured" or
 * "recovered", which a diagram cannot know.
 */
type Shape = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number } | { kind: 'path'; d: string };
type Region = { muscle: Muscle; shapes: Shape[] };

const mirror = (s: Shape): Shape => {
  if (s.kind === 'ellipse') return { ...s, cx: 200 - s.cx };
  if (s.kind === 'rect') return { ...s, x: 200 - s.x - s.w };
  return s;
};
const pair = (muscle: Muscle, ...shapes: Shape[]): Region => ({ muscle, shapes: [...shapes, ...shapes.map(mirror)] });

const FRONT: Region[] = [
  pair('frontDelts', { kind: 'ellipse', cx: 62, cy: 92, rx: 13, ry: 15 }),
  pair('sideDelts', { kind: 'ellipse', cx: 50, cy: 98, rx: 7, ry: 13 }),
  { muscle: 'upperChest', shapes: [{ kind: 'rect', x: 74, y: 82, w: 25, h: 14, r: 6 }, { kind: 'rect', x: 101, y: 82, w: 25, h: 14, r: 6 }] },
  { muscle: 'chest', shapes: [{ kind: 'rect', x: 74, y: 97, w: 25, h: 24, r: 8 }, { kind: 'rect', x: 101, y: 97, w: 25, h: 24, r: 8 }] },
  pair('biceps', { kind: 'ellipse', cx: 50, cy: 130, rx: 9, ry: 19 }),
  pair('forearms', { kind: 'ellipse', cx: 44, cy: 175, rx: 8, ry: 22 }),
  { muscle: 'abs', shapes: [0, 1, 2].flatMap((i) => [{ kind: 'rect', x: 86, y: 126 + i * 19, w: 13, h: 16, r: 4 } as Shape, { kind: 'rect', x: 101, y: 126 + i * 19, w: 13, h: 16, r: 4 } as Shape]) },
  pair('obliques', { kind: 'rect', x: 72, y: 128, w: 12, h: 44, r: 6 }),
  pair('adductors', { kind: 'rect', x: 90, y: 200, w: 9, h: 40, r: 4 }),
  pair('quads', { kind: 'ellipse', cx: 76, cy: 240, rx: 14, ry: 42 }),
  pair('calves', { kind: 'ellipse', cx: 76, cy: 330, rx: 9, ry: 28 }),
  pair('hipAbductors', { kind: 'ellipse', cx: 64, cy: 196, rx: 6, ry: 14 }),
  { muscle: 'neck', shapes: [{ kind: 'rect', x: 92, y: 58, w: 16, h: 16, r: 5 }] },
];

const BACK: Region[] = [
  { muscle: 'traps', shapes: [{ kind: 'path', d: 'M80 70 L100 62 L120 70 L126 92 L100 108 L74 92 Z' }] },
  pair('rearDelts', { kind: 'ellipse', cx: 60, cy: 94, rx: 13, ry: 14 }),
  { muscle: 'upperBack', shapes: [{ kind: 'rect', x: 80, y: 100, w: 40, h: 26, r: 8 }] },
  pair('lats', { kind: 'path', d: 'M74 102 L80 104 L84 150 L72 160 L66 120 Z' }),
  pair('triceps', { kind: 'ellipse', cx: 50, cy: 130, rx: 9, ry: 19 }),
  pair('forearms', { kind: 'ellipse', cx: 44, cy: 175, rx: 8, ry: 22 }),
  { muscle: 'lowerBack', shapes: [{ kind: 'rect', x: 86, y: 140, w: 28, h: 36, r: 8 }] },
  pair('glutes', { kind: 'ellipse', cx: 84, cy: 196, rx: 16, ry: 18 }),
  pair('hamstrings', { kind: 'ellipse', cx: 78, cy: 252, rx: 13, ry: 36 }),
  pair('calves', { kind: 'ellipse', cx: 76, cy: 326, rx: 11, ry: 28 }),
];

const SILHOUETTE =
  'M100 20 C112 20 120 30 120 44 C120 56 113 64 108 66 L108 72 C128 76 140 80 146 92 C152 108 152 140 154 160 C156 184 160 200 160 206 L150 208 C146 190 140 168 138 150 L134 186 C136 206 134 238 128 272 C124 300 124 330 120 360 L108 362 C106 330 104 296 102 262 L100 230 L98 262 C96 296 94 330 92 362 L80 360 C76 330 76 300 72 272 C66 238 64 206 66 186 L62 150 C60 168 54 190 50 208 L40 206 C40 200 44 184 46 160 C48 140 48 108 54 92 C60 80 72 76 92 72 L92 66 C87 64 80 56 80 44 C80 30 88 20 100 20 Z';

export function BodyMap({ side, intensity, selected, onSelect }: { side: 'front' | 'back'; intensity: Partial<Record<Muscle, number>>; selected?: Muscle; onSelect: (m: Muscle) => void }) {
  const { c } = useTheme();
  const regions = side === 'front' ? FRONT : BACK;
  const fill = (m: Muscle) => {
    if (m === selected) return c.accent;
    const v = intensity[m] ?? 0;
    return v <= 0 ? c.surfaceRaised : c.primary;
  };
  const opacity = (m: Muscle) => (m === selected ? 1 : (intensity[m] ?? 0) > 0 ? 0.35 + Math.min(0.65, (intensity[m] ?? 0) * 0.65) : 1);
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={220} height={396} viewBox="0 0 200 380" accessibilityLabel={`${side} muscle map`}>
        <Path d={SILHOUETTE} fill={c.surfaceSunken} stroke={c.border} strokeWidth={1.5} />
        {regions.map((r) => (
          <G key={`${side}-${r.muscle}`} onPress={() => onSelect(r.muscle)} accessibilityLabel={r.muscle}>
            {r.shapes.map((s, i) =>
              s.kind === 'ellipse' ? (
                <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill(r.muscle)} fillOpacity={opacity(r.muscle)} stroke={c.border} strokeWidth={0.8} />
              ) : s.kind === 'rect' ? (
                <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} fill={fill(r.muscle)} fillOpacity={opacity(r.muscle)} stroke={c.border} strokeWidth={0.8} />
              ) : (
                <Path key={i} d={s.d} fill={fill(r.muscle)} fillOpacity={opacity(r.muscle)} stroke={c.border} strokeWidth={0.8} />
              ),
            )}
          </G>
        ))}
      </Svg>
      <Text variant="caption" tone="subtle">Tap a muscle group</Text>
    </View>
  );
}

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest', upperChest: 'Upper chest', frontDelts: 'Front delts', sideDelts: 'Side delts', rearDelts: 'Rear delts',
  traps: 'Traps', upperBack: 'Upper back', lats: 'Lats', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abdominals', obliques: 'Obliques', lowerBack: 'Lower back', glutes: 'Glutes', hipAbductors: 'Hip abductors',
  adductors: 'Adductors', quads: 'Quadriceps', hamstrings: 'Hamstrings', calves: 'Calves', neck: 'Neck',
};

export const FRONT_MUSCLES = new Set(FRONT.map((r) => r.muscle));
export const BACK_MUSCLES = new Set(BACK.map((r) => r.muscle));
