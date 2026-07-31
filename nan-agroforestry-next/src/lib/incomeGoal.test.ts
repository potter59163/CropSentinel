import { describe, it, expect } from 'vitest';
import type { CashflowPoint } from '../data/types';
import { incomeGoalStatus } from './incomeGoal';

const cashflow = (nets: number[]): CashflowPoint[] =>
  nets.map((net, i) => ({ year: i + 1, income: 0, cost: 0, net, cumulative: 0 }));

describe('incomeGoalStatus', () => {
  it('meets both when every year clears the target', () => {
    const flow = cashflow([50_000, 90_000, 120_000, 130_000, 140_000, 150_000, 150_000, 150_000, 150_000, 150_000]);
    const s = incomeGoalStatus(100_000, 113_000, flow);
    expect(s.meetsOnAverage).toBe(true);
    expect(s.meetsAtMaturity).toBe(true);
    expect(s.matureAnnual).toBe(150_000);
  });

  it('flags "not yet, but on track" when young years drag the average under target but the mature years clear it', () => {
    // A tree-heavy plan: near-zero for years 1-4 while canopy establishes, then strong.
    const flow = cashflow([0, 0, 5_000, 20_000, 180_000, 190_000, 195_000, 200_000, 200_000, 200_000]);
    const annualAvg = Math.round(flow.reduce((s, c) => s + c.net, 0) / flow.length);
    const s = incomeGoalStatus(150_000, annualAvg, flow);
    expect(s.meetsOnAverage).toBe(false);
    expect(s.meetsAtMaturity).toBe(true);
    expect(s.matureAnnual).toBe(200_000);
  });

  it('flags shortfall at maturity too when the plan never gets there', () => {
    const flow = cashflow([10_000, 20_000, 30_000, 35_000, 40_000, 42_000, 43_000, 44_000, 44_000, 44_000]);
    const annualAvg = Math.round(flow.reduce((s, c) => s + c.net, 0) / flow.length);
    const s = incomeGoalStatus(100_000, annualAvg, flow);
    expect(s.meetsOnAverage).toBe(false);
    expect(s.meetsAtMaturity).toBe(false);
    expect(s.ratioMature).toBeCloseTo(0.44, 2);
  });

  it('computes ratios against the target', () => {
    const flow = cashflow([100_000, 100_000, 100_000]);
    const s = incomeGoalStatus(200_000, 100_000, flow);
    expect(s.ratioAvg).toBeCloseTo(0.5, 5);
    expect(s.ratioMature).toBeCloseTo(0.5, 5);
  });

  it('does not divide by zero when target is somehow 0', () => {
    const s = incomeGoalStatus(0, 50_000, cashflow([50_000]));
    expect(s.ratioAvg).toBe(0);
    expect(s.ratioMature).toBe(0);
  });

  it('averages whatever years exist when the horizon is shorter than the mature window', () => {
    const flow = cashflow([10_000, 30_000]); // fewer than MATURE_WINDOW (3) years
    const s = incomeGoalStatus(15_000, 20_000, flow);
    expect(s.matureAnnual).toBe(20_000);
  });

  it('falls back to annualAvg when there is no cashflow at all', () => {
    const s = incomeGoalStatus(15_000, 15_000, []);
    expect(s.matureAnnual).toBe(15_000);
  });
});
