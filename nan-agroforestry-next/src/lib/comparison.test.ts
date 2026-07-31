import { describe, it, expect } from 'vitest';
import type { FarmInput, SystemPlan } from '../data/types';
import {
  assumptionFingerprint, plotIdentity, comparabilityIssues,
  diffPicks, metricDeltas, metricsOf, snapshotPlan, deltaDirection, verdictOf,
} from './comparison';

const baseInput = (over: Partial<FarmInput> = {}): FarmInput => ({
  sizeRai: 10,
  lat: 19.179,
  lng: 100.907,
  elevationM: 420,
  locationLabel: 'ปัว น่าน',
  goal: 'balanced',
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
  ...over,
} as FarmInput);

const pick = (id: string, layer: string, suit = 0.7) => ({
  layer, plant: { id, nameTh: id }, suitability: suit,
}) as unknown as SystemPlan['picks'][number];

const plan = (ids: string[], over: Partial<SystemPlan> = {}): SystemPlan => ({
  picks: ids.map((id) => pick(id, 'canopy')),
  badge: 'ดีที่สุด',
  profit10: 1_000_000,
  annualAvg: 100_000,
  paybackYear: 5,
  suitability: 0.7,
  carbon10: 40,
  transitionCost: 50_000,
  scoreParts: { agroforestry: 0.8 },
  ...over,
} as unknown as SystemPlan);

describe('plot identity — what must match for two runs to be about the same land', () => {
  it('treats an identical input as the same plot', () => {
    expect(comparabilityIssues(plotIdentity(baseInput()), plotIdentity(baseInput()))).toEqual([]);
  });

  it('flags a moved marker, a resize, a new elevation and a changed goal', () => {
    const a = plotIdentity(baseInput());
    expect(comparabilityIssues(a, plotIdentity(baseInput({ lat: 19.2 })))).toContain('คนละพิกัดแปลง');
    expect(comparabilityIssues(a, plotIdentity(baseInput({ sizeRai: 12 })))[0]).toMatch(/คนละขนาดแปลง/);
    expect(comparabilityIssues(a, plotIdentity(baseInput({ elevationM: 900 })))).toContain('คนละความสูง');
    expect(comparabilityIssues(a, plotIdentity(baseInput({ goal: 'profit' } as Partial<FarmInput>)))).toContain('คนละเป้าหมาย');
  });

  // ~11 m is finer than the marker can be placed and far finer than NASA POWER's 0.25°
  // grid, so sub-4dp jitter must not make two runs look like different plots.
  it('ignores coordinate noise below ~11 m', () => {
    const a = plotIdentity(baseInput({ lat: 19.17900001 }));
    const b = plotIdentity(baseInput({ lat: 19.17900009 }));
    expect(comparabilityIssues(a, b)).toEqual([]);
  });
});

describe('assumption fingerprint — price edits are the biggest confounder of a comparison', () => {
  it('is empty when the farmer overrode nothing', () => {
    expect(assumptionFingerprint({ cropAssumptions: [] })).toBe('');
    expect(assumptionFingerprint({ cropAssumptions: undefined })).toBe('');
  });

  it('changes when a price changes, so the deltas get suppressed', () => {
    const a = plotIdentity(baseInput({ cropAssumptions: [{ plantId: 'durian', pricePerKg: 100 }] }));
    const b = plotIdentity(baseInput({ cropAssumptions: [{ plantId: 'durian', pricePerKg: 140 }] }));
    expect(comparabilityIssues(a, b)).toContain('แก้ราคา/ต้นทุนระหว่างสองรอบ');
  });

  it('is order-independent — reordering the same overrides is not a real change', () => {
    const rows = [{ plantId: 'durian', pricePerKg: 100 }, { plantId: 'longan', pricePerKg: 30 }];
    expect(assumptionFingerprint({ cropAssumptions: rows }))
      .toBe(assumptionFingerprint({ cropAssumptions: [...rows].reverse() }));
  });

  it('ignores metadata that cannot move the cashflow', () => {
    const a = assumptionFingerprint({ cropAssumptions: [{ plantId: 'durian', pricePerKg: 100 }] });
    const b = assumptionFingerprint({
      cropAssumptions: [{ plantId: 'durian', pricePerKg: 100, expertNote: 'ตรวจแล้ว' }],
    });
    expect(a).toBe(b);
  });
});

describe('species diff — the ABC vs ABD question', () => {
  it('reports exactly the swapped species', () => {
    const d = diffPicks(
      [pick('a', 'canopy'), pick('b', 'shrub'), pick('c', 'root')].map((p) => ({
        layer: p.layer, plantId: p.plant.id, nameTh: p.plant.nameTh, suitability: p.suitability,
      })),
      [pick('a', 'canopy'), pick('b', 'shrub'), pick('d', 'root')].map((p) => ({
        layer: p.layer, plantId: p.plant.id, nameTh: p.plant.nameTh, suitability: p.suitability,
      })),
    );
    expect(d.added.map((p) => p.plantId)).toEqual(['d']);
    expect(d.removed.map((p) => p.plantId)).toEqual(['c']);
    expect(d.kept.map((p) => p.plantId)).toEqual(['a', 'b']);
    expect(d.identical).toBe(false);
  });

  it('calls an unchanged set identical regardless of order', () => {
    const mk = (ids: string[]) => ids.map((id) => ({ layer: 'canopy', plantId: id, nameTh: id, suitability: 0.7 }));
    expect(diffPicks(mk(['a', 'b', 'c']), mk(['c', 'a', 'b'])).identical).toBe(true);
  });
});

describe('metric deltas', () => {
  it('signs each metric in the direction that is actually better', () => {
    const before = metricsOf(plan(['a'], { profit10: 1_000_000, paybackYear: 7 }));
    const after = metricsOf(plan(['a'], { profit10: 1_200_000, paybackYear: 5 }));
    const d = metricDeltas(before, after);
    const profit = d.find((x) => x.key === 'profit10')!;
    const payback = d.find((x) => x.key === 'paybackYear')!;
    expect(profit.delta).toBe(200_000);
    expect(profit.higherIsBetter).toBe(true);
    // Paying back 2 years sooner is a NEGATIVE delta but a better outcome — the UI
    // colours from higherIsBetter, so getting this wrong would paint good news red.
    expect(payback.delta).toBe(-2);
    expect(payback.higherIsBetter).toBe(false);
  });

  // "Never pays back within 10 years" is a real, distinct answer. Treating it as 0 would
  // report a plan that never breaks even as paying back 5 years sooner than one that does.
  it('refuses to subtract when a plan never pays back', () => {
    const never = metricsOf(plan(['a'], { paybackYear: null }));
    const does = metricsOf(plan(['a'], { paybackYear: 5 }));
    expect(metricDeltas(never, does).find((x) => x.key === 'paybackYear')!.delta).toBeNull();
    expect(metricDeltas(does, never).find((x) => x.key === 'paybackYear')!.delta).toBeNull();
  });

  // Observed live: two plans whose agroforestry score differed by 0.0004 printed a red
  // "−0%" beside two identical 92% values — a decline reported where none is visible.
  it('calls a difference too small to display flat, not a decline', () => {
    const a = metricsOf(plan(['a'], { scoreParts: { agroforestry: 0.9204 } } as Partial<SystemPlan>));
    const b = metricsOf(plan(['a'], { scoreParts: { agroforestry: 0.9200 } } as Partial<SystemPlan>));
    const d = metricDeltas(a, b).find((x) => x.key === 'agroforestry')!;
    expect(d.delta).toBeLessThan(0);           // the raw delta is still honest
    expect(deltaDirection(d)).toBe('flat');    // but it must not be painted as worse
  });

  it('still reports a difference large enough to show', () => {
    const a = metricsOf(plan(['a'], { scoreParts: { agroforestry: 0.92 } } as Partial<SystemPlan>));
    const b = metricsOf(plan(['a'], { scoreParts: { agroforestry: 0.89 } } as Partial<SystemPlan>));
    expect(deltaDirection(metricDeltas(a, b).find((x) => x.key === 'agroforestry')!)).toBe('down');
  });

  it('treats a null delta as flat rather than crashing the colouring', () => {
    const d = metricDeltas(metricsOf(plan(['a'], { paybackYear: null })), metricsOf(plan(['a'])));
    expect(deltaDirection(d.find((x) => x.key === 'paybackYear')!)).toBe('flat');
  });

  it('covers every metric shown in the table', () => {
    const keys = metricDeltas(metricsOf(plan(['a'])), metricsOf(plan(['a']))).map((d) => d.key);
    expect(keys).toEqual([
      'profit10', 'annualAvg', 'paybackYear', 'transitionCost',
      'suitability', 'agroforestry', 'carbon10',
    ]);
  });
});

describe('verdict — the one-line answer above the table', () => {
  const v = (a: Partial<SystemPlan>, b: Partial<SystemPlan>) =>
    verdictOf(metricDeltas(metricsOf(plan(['x'], a)), metricsOf(plan(['x'], b))));

  it('calls two identical plans a tie', () => {
    expect(v({}, {}).kind).toBe('tie');
  });

  it('names a winner only when it wins or ties on everything', () => {
    const better = v({ profit10: 1_000_000 }, { profit10: 1_400_000 });
    expect(better.kind).toBe('current-better');
    expect(better.gains.map((g) => g.key)).toContain('profit10');
    expect(better.losses).toHaveLength(0);

    expect(v({ profit10: 1_400_000 }, { profit10: 1_000_000 }).kind).toBe('pinned-better');
  });

  // The most common real result, and the one the tool must NOT collapse into a winner:
  // more money for less suitability is a judgement only the farmer can make.
  it('refuses to name a winner when the plans trade off', () => {
    const t = v(
      { profit10: 1_000_000, suitability: 0.70 },
      { profit10: 1_400_000, suitability: 0.61 },
    );
    expect(t.kind).toBe('tradeoff');
    expect(t.gains.map((g) => g.key)).toContain('profit10');
    expect(t.losses.map((l) => l.key)).toContain('suitability');
  });

  it('does not let an invisible difference create a fake tradeoff', () => {
    const t = v(
      { profit10: 1_000_000, suitability: 0.7000 },
      { profit10: 1_400_000, suitability: 0.6999 },
    );
    expect(t.kind).toBe('current-better');
    expect(t.losses).toHaveLength(0);
  });

  it('reads payback the right way round — sooner is a gain', () => {
    const g = v({ paybackYear: 7 }, { paybackYear: 4 });
    expect(g.kind).toBe('current-better');
    expect(g.gains.map((x) => x.key)).toContain('paybackYear');
  });

  it('reads a cheaper start-up cost as a gain, not a loss', () => {
    const g = v({ transitionCost: 90_000 }, { transitionCost: 50_000 });
    expect(g.kind).toBe('current-better');
    expect(g.gains.map((x) => x.key)).toContain('transitionCost');
  });
});

describe('snapshot', () => {
  it('captures the plot it was computed for, so a later run can be checked against it', () => {
    const snap = snapshotPlan(plan(['a', 'b']), baseInput(), 1, 'pin-1');
    expect(snap.rank).toBe(1);
    expect(snap.picks.map((p) => p.plantId)).toEqual(['a', 'b']);
    expect(snap.plot.sizeRai).toBe(10);
    expect(snap.metrics.profit10).toBe(1_000_000);
    // A snapshot taken on one plot must be recognised as incomparable to another.
    expect(comparabilityIssues(snap.plot, plotIdentity(baseInput({ sizeRai: 25 })))).toHaveLength(1);
  });
});
