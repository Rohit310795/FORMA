import { daysBetween } from '../dates';

export interface Point {
  dayKey: string;
  value: number;
}

export interface TrendSummary {
  first?: Point;
  last?: Point;
  change?: number;
  periodDays?: number;
  /** Plain-language description of the period compared. Avoids causal claims. */
  description: string;
}

/** Compares the first and last measurement inside the window. */
export function trend(points: Point[], today: string, windowDays: number, unitLabel: string): TrendSummary {
  const inWindow = points
    .filter((p) => {
      const d = daysBetween(p.dayKey, today);
      return d >= 0 && d < windowDays;
    })
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  if (inWindow.length < 2) {
    return { first: inWindow[0], last: inWindow[0], description: 'Log at least two entries in this period to see a change.' };
  }
  const first = inWindow[0]!;
  const last = inWindow[inWindow.length - 1]!;
  const change = Math.round((last.value - first.value) * 10) / 10;
  const periodDays = daysBetween(first.dayKey, last.dayKey);
  const dir = change === 0 ? 'no change' : change > 0 ? `up ${Math.abs(change)} ${unitLabel}` : `down ${Math.abs(change)} ${unitLabel}`;
  return {
    first,
    last,
    change,
    periodDays,
    description: `${dir} between ${first.dayKey} and ${last.dayKey} (${periodDays} days, ${inWindow.length} entries). Day-to-day values fluctuate; look at the overall direction.`,
  };
}

/** 7-point trailing moving average to smooth noisy daily weights. */
export function movingAverage(points: Point[], size = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  return sorted.map((p, i) => {
    const slice = sorted.slice(Math.max(0, i - size + 1), i + 1);
    return { dayKey: p.dayKey, value: Math.round((slice.reduce((s, x) => s + x.value, 0) / slice.length) * 10) / 10 };
  });
}

/** Share of days in the window where the logged total landed within ±tolerance of target. */
export function adherence(dailyTotals: Map<string, number>, target: number, days: string[], tolerance = 0.1) {
  const logged = days.filter((d) => dailyTotals.has(d));
  const within = logged.filter((d) => Math.abs((dailyTotals.get(d)! - target) / target) <= tolerance);
  return { loggedDays: logged.length, withinDays: within.length, totalDays: days.length };
}
