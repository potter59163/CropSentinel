import type { FarmInput, SystemPlan } from '../data/types';

/**
 * Pin a result and compare it against a later run.
 *
 * The question this answers is the one farmers actually ask after the first result:
 * "I got a plan with A+B+C, but what happens if I swap C for D?" Before this, answering it
 * meant re-running and trying to remember the old numbers.
 *
 * The whole design rests on one rule: TWO PLANS ARE ONLY COMPARABLE IF THEY WERE COMPUTED
 * FOR THE SAME PLOT UNDER THE SAME ASSUMPTIONS. A ฿180,000 difference means "D earns more
 * than C" only when nothing else moved. If the plot, the size, the goal, or the farmer's
 * price overrides changed in between, the difference is a mix of causes and presenting it
 * as a plant comparison would be a lie a farmer could act on. So comparability is computed
 * explicitly, returned as a list of reasons, and the UI suppresses the deltas when it is
 * broken rather than quietly showing numbers that do not mean what they look like.
 */

/** Everything that must match for two runs to be about the same piece of land. */
export interface PlotIdentity {
  lat: number | null;
  lng: number | null;
  sizeRai: number | null;
  elevationM: number | null;
  locationLabel: string;
  goal: string;
  /** Fingerprint of the farmer's cost/price overrides — see assumptionFingerprint. */
  assumptions: string;
}

export interface PinnedPick {
  layer: string;
  plantId: string;
  nameTh: string;
  suitability: number;
}

export interface PinnedPlan {
  /** Stable id so React keys and "unpin" survive re-renders. */
  id: string;
  savedAt: string;
  /** Which of the three offered plans this was, at the time it was pinned. */
  rank: number;
  badge: string;
  plot: PlotIdentity;
  picks: PinnedPick[];
  metrics: PlanMetrics;
}

export interface PlanMetrics {
  profit10: number;
  annualAvg: number;
  paybackYear: number | null;
  suitability: number;
  woodyStructure: number;
  transitionCost: number;
  agroforestry: number;
}

const round4 = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;

/**
 * A compact, order-independent digest of the farmer's per-crop overrides.
 *
 * Overrides are the single biggest lever on profit10 — a farmer who edits the durian price
 * between two runs can swing the comparison further than the plant swap does. Only the
 * fields that feed the cashflow are included; validationStatus and expertNote are metadata
 * and must not make two otherwise-identical runs look incomparable.
 */
export function assumptionFingerprint(input: Pick<FarmInput, 'cropAssumptions'>): string {
  const rows = input.cropAssumptions ?? [];
  if (!rows.length) return '';
  return rows
    .map((a) => [
      a.plantId, a.plantsPerRai, a.totalPlants, a.shareRai, a.pricePerKg, a.yieldKgPerRai,
      a.establishCostPerRai, a.annualCostPerRai, a.cyclesPerYear, a.survivalRate,
    ].map((v) => (v === undefined || v === null ? '' : String(v))).join(':'))
    .sort()
    .join('|');
}

export function plotIdentity(input: FarmInput): PlotIdentity {
  return {
    // 4 dp is ~11 m — finer than the plot marker can be placed, and finer than any
    // upstream raster (NASA POWER is 0.25°), so it will not report spurious differences.
    lat: round4(input.lat),
    lng: round4(input.lng),
    sizeRai: round4(input.sizeRai),
    elevationM: round4(input.elevationM),
    locationLabel: input.locationLabel ?? '',
    goal: String(input.goal ?? ''),
    assumptions: assumptionFingerprint(input),
  };
}

export function metricsOf(sys: SystemPlan): PlanMetrics {
  return {
    profit10: sys.profit10,
    annualAvg: sys.annualAvg,
    paybackYear: sys.paybackYear,
    suitability: sys.suitability,
    woodyStructure: sys.scoreParts.woodyStructure,
    transitionCost: sys.transitionCost,
    agroforestry: sys.scoreParts.agroforestry,
  };
}

export function snapshotPlan(sys: SystemPlan, input: FarmInput, rank: number, id: string): PinnedPlan {
  return {
    id,
    savedAt: new Date().toISOString(),
    rank,
    badge: sys.badge ?? '',
    plot: plotIdentity(input),
    picks: sys.picks.map((p) => ({
      layer: p.layer,
      plantId: p.plant.id,
      nameTh: p.plant.nameTh,
      suitability: p.suitability,
    })),
    metrics: metricsOf(sys),
  };
}

/** Why two runs cannot be compared, in farmer-readable Thai. Empty = comparable. */
export function comparabilityIssues(a: PlotIdentity, b: PlotIdentity): string[] {
  const issues: string[] = [];
  if (a.lat !== b.lat || a.lng !== b.lng) issues.push('คนละพิกัดแปลง');
  if (a.sizeRai !== b.sizeRai) issues.push(`คนละขนาดแปลง (${a.sizeRai ?? '—'} ไร่ vs ${b.sizeRai ?? '—'} ไร่)`);
  if (a.elevationM !== b.elevationM) issues.push('คนละความสูง');
  if (a.goal !== b.goal) issues.push('คนละเป้าหมาย');
  if (a.assumptions !== b.assumptions) issues.push('แก้ราคา/ต้นทุนระหว่างสองรอบ');
  return issues;
}

export interface PlanDiff {
  /** In the new plan but not the pinned one. */
  added: PinnedPick[];
  /** In the pinned plan but not the new one. */
  removed: PinnedPick[];
  /** In both. */
  kept: PinnedPick[];
  /** True when the two plans contain exactly the same species. */
  identical: boolean;
}

export function diffPicks(pinned: PinnedPick[], current: PinnedPick[]): PlanDiff {
  const pinnedIds = new Set(pinned.map((p) => p.plantId));
  const currentIds = new Set(current.map((p) => p.plantId));
  const added = current.filter((p) => !pinnedIds.has(p.plantId));
  const removed = pinned.filter((p) => !currentIds.has(p.plantId));
  const kept = current.filter((p) => pinnedIds.has(p.plantId));
  return { added, removed, kept, identical: added.length === 0 && removed.length === 0 };
}

export interface MetricDelta {
  key: keyof PlanMetrics;
  label: string;
  pinned: number | null;
  current: number | null;
  /** current - pinned; null when either side is missing. */
  delta: number | null;
  /** Whether a larger number is better, so the UI can colour without knowing the metric. */
  higherIsBetter: boolean;
  format: 'baht' | 'year' | 'pct';
}

const METRIC_SPEC: Array<{
  key: keyof PlanMetrics;
  label: string;
  higherIsBetter: boolean;
  format: MetricDelta['format'];
}> = [
  { key: 'profit10', label: 'กำไรสะสม 10 ปี', higherIsBetter: true, format: 'baht' },
  { key: 'annualAvg', label: 'รายได้เฉลี่ยต่อปี', higherIsBetter: true, format: 'baht' },
  // Sooner is better, so this is the one metric where a smaller number wins.
  { key: 'paybackYear', label: 'ปีคืนทุน', higherIsBetter: false, format: 'year' },
  { key: 'transitionCost', label: 'ต้นทุนเริ่มต้น', higherIsBetter: false, format: 'baht' },
  { key: 'suitability', label: 'ความเหมาะสมเฉลี่ย', higherIsBetter: true, format: 'pct' },
  { key: 'agroforestry', label: 'คะแนนวนเกษตร', higherIsBetter: true, format: 'pct' },
  { key: 'woodyStructure', label: 'ความเป็นไม้ยืนยาว', higherIsBetter: true, format: 'pct' },
];

/**
 * Smallest difference each format can actually show. Anything under this rounds away to
 * "0" on screen, so calling it a change would print "−0%" in red and tell a farmer a plan
 * got worse when the two numbers are, as displayed, identical.
 */
const DISPLAY_EPSILON: Record<MetricDelta['format'], number> = {
  baht: 0.5,   // rendered as whole baht
  year: 0.5,   // rendered as a whole year
  pct: 0.005,  // rendered as a whole percent
};

/**
 * Which way a delta points, at the precision the UI will actually print.
 *
 * 'flat' covers both "no delta" and "a delta too small to display", which must look the
 * same on screen — the alternative is a red −0% next to two identical numbers.
 */
export function deltaDirection(d: MetricDelta): 'up' | 'down' | 'flat' {
  if (d.delta === null || Math.abs(d.delta) < DISPLAY_EPSILON[d.format]) return 'flat';
  return (d.delta > 0) === d.higherIsBetter ? 'up' : 'down';
}

export function metricDeltas(pinned: PlanMetrics, current: PlanMetrics): MetricDelta[] {
  return METRIC_SPEC.map((spec) => {
    const p = pinned[spec.key];
    const c = current[spec.key];
    // paybackYear is legitimately null ("never pays back within 10 yr"), which is not a
    // zero and must not subtract into a misleading delta.
    const delta = typeof p === 'number' && typeof c === 'number' && Number.isFinite(p) && Number.isFinite(c)
      ? c - p
      : null;
    return { ...spec, pinned: p ?? null, current: c ?? null, delta };
  });
}

export interface Verdict {
  kind: 'tie' | 'current-better' | 'pinned-better' | 'tradeoff';
  /** Metrics where the plan on screen beats the pinned one. */
  gains: MetricDelta[];
  /** Metrics where the plan on screen is worse. */
  losses: MetricDelta[];
}

/**
 * A one-line answer, because most people will not read a seven-row table.
 *
 * It deliberately REFUSES to name a winner whenever the two plans trade off against each
 * other — more money for less suitability is the single most common result here, and
 * collapsing it to "แผนใหม่ดีกว่า" would be the tool making the farmer's decision for it
 * on an axis the farmer never told it to weight. Only a plan that is better-or-equal on
 * every metric gets called better.
 */
export function verdictOf(deltas: MetricDelta[]): Verdict {
  const gains = deltas.filter((d) => deltaDirection(d) === 'up');
  const losses = deltas.filter((d) => deltaDirection(d) === 'down');
  if (!gains.length && !losses.length) return { kind: 'tie', gains, losses };
  if (gains.length && !losses.length) return { kind: 'current-better', gains, losses };
  if (losses.length && !gains.length) return { kind: 'pinned-better', gains, losses };
  return { kind: 'tradeoff', gains, losses };
}
