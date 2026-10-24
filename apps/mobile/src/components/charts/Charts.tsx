import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';

export function ProgressRing({ value, max, size = 140, stroke = 12, label, sublabel }: { value: number; max: number; size?: number; stroke?: number; label: string; sublabel?: string }) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label}${sublabel ? `, ${sublabel}` : ''}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.gradientStart} />
            <Stop offset="0.5" stopColor={c.gradientMid} />
            <Stop offset="1" stopColor={c.gradientEnd} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceRaised} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="title" style={{ fontSize: size > 120 ? 26 : 18 }}>{label}</Text>
      {sublabel ? <Text variant="caption" tone="muted">{sublabel}</Text> : null}
    </View>
  );
}

export interface ChartPoint {
  x: string;
  y: number;
}

/** Simple, accessible line chart. Shows an empty message instead of inventing data. */
export function LineChart({ data, height = 160, unit = '', emptyMessage = 'Not enough data yet.' }: { data: ChartPoint[]; height?: number; unit?: string; emptyMessage?: string }) {
  const { c } = useTheme();
  const width = 320;
  if (data.length < 2) return <Text variant="caption" tone="muted" style={{ paddingVertical: 24, textAlign: 'center' }}>{emptyMessage}</Text>;
  const ys = data.map((d) => d.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const px = (i: number) => 28 + (i / (data.length - 1)) * (width - 40);
  const py = (y: number) => 10 + (1 - (y - lo) / (hi - lo)) * (height - 34);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(d.y).toFixed(1)}`).join(' ');
  const area = `${path} L${px(data.length - 1)},${height - 24} L${px(0)},${height - 24} Z`;
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const labelEvery = Math.ceil(data.length / 5);
  return (
    <View accessible accessibilityLabel={`Chart from ${data[0]!.x} (${data[0]!.y}${unit}) to ${data[data.length - 1]!.x} (${data[data.length - 1]!.y}${unit}), ${data.length} points`}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.primary} stopOpacity={0.35} />
            <Stop offset="1" stopColor={c.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ticks.map((t, i) => (
          <Line key={i} x1={28} x2={width - 8} y1={py(t)} y2={py(t)} stroke={c.chartGrid} strokeDasharray="3 4" />
        ))}
        {ticks.map((t, i) => (
          <SvgText key={`t${i}`} x={0} y={py(t) + 4} fontSize={9} fill={c.textSubtle}>{Math.round(t * 10) / 10}</SvgText>
        ))}
        <Path d={area} fill="url(#area)" />
        <Path d={path} stroke={c.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {data.map((d, i) => (
          <Circle key={i} cx={px(i)} cy={py(d.y)} r={3} fill={c.primary} />
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <SvgText key={`x${i}`} x={px(i)} y={height - 8} fontSize={9} fill={c.textSubtle} textAnchor="middle">{d.x.slice(5)}</SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}

export function BarChart({ data, height = 140, target, unit = '' }: { data: ChartPoint[]; height?: number; target?: number; unit?: string }) {
  const { c } = useTheme();
  const width = 320;
  const max = Math.max(target ?? 0, ...data.map((d) => d.y), 1);
  const bw = (width - 20) / data.length;
  const py = (y: number) => 8 + (1 - y / max) * (height - 30);
  return (
    <View accessible accessibilityLabel={`Bar chart: ${data.map((d) => `${d.x} ${d.y}${unit}`).join(', ')}`}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {target ? <Line x1={10} x2={width - 10} y1={py(target)} y2={py(target)} stroke={c.accent} strokeDasharray="4 4" /> : null}
        {data.map((d, i) => (
          <Rect key={i} x={10 + i * bw + bw * 0.18} y={py(d.y)} width={bw * 0.64} height={Math.max(0, height - 22 - py(d.y))} rx={5} fill={d.y > 0 ? c.primary : c.surfaceRaised} />
        ))}
        {data.map((d, i) => (
          <SvgText key={`l${i}`} x={10 + i * bw + bw / 2} y={height - 6} fontSize={9} fill={c.textSubtle} textAnchor="middle">{d.x}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

export function MacroBar({ label, value, target, unit = 'g', color }: { label: string; value: number; target: number; unit?: string; color?: string }) {
  const { c, radius } = useTheme();
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${label} ${Math.round(value)} of ${target} ${unit}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" tone="muted">{Math.round(value)} / {target} {unit}</Text>
      </View>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: c.surfaceRaised, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color ?? c.primary, borderRadius: radius.pill }} />
      </View>
    </View>
  );
}
