import type { CashflowPoint } from '../data/types';

/**
 * Was the "เป้าหมายรายได้ต่อปี" a farmer typed in ever actually reachable?
 *
 * The input has existed since the wizard was built (InputForm.tsx, step 3) and the schema
 * validates it, but nothing downstream ever read it — a farmer could type ฿180,000 and the
 * plan would never say whether it delivered that or fell short. This is the missing other
 * half.
 *
 * One number is not enough to answer honestly. `annualAvg` (profit10 / 10) blends young,
 * unproductive years in with mature ones — a system dominated by trees that take 5 years to
 * bear fruit can show a low blended average while, once established, comfortably clearing
 * the goal every year. So this reports BOTH: the blended average (comparable to the
 * headline "เฉลี่ย/ปี" KPI already on screen) and a mature-year figure (the average of the
 * last 3 years of the 10-year horizon, i.e. once the system has settled into steady state),
 * so "not there yet" and "never going to get there" don't get told as the same story.
 */
export interface IncomeGoalStatus {
  target: number;
  annualAvg: number;
  matureAnnual: number;
  /** annualAvg / target. Not clamped — over goal reads as >100%. */
  ratioAvg: number;
  /** matureAnnual / target. */
  ratioMature: number;
  meetsOnAverage: boolean;
  meetsAtMaturity: boolean;
}

const MATURE_WINDOW = 3;

export function incomeGoalStatus(target: number, annualAvg: number, cashflow: CashflowPoint[]): IncomeGoalStatus {
  const tail = cashflow.slice(-MATURE_WINDOW);
  const matureAnnual = tail.length
    ? Math.round(tail.reduce((sum, c) => sum + c.net, 0) / tail.length)
    : annualAvg;
  return {
    target,
    annualAvg,
    matureAnnual,
    ratioAvg: target > 0 ? annualAvg / target : 0,
    ratioMature: target > 0 ? matureAnnual / target : 0,
    meetsOnAverage: annualAvg >= target,
    meetsAtMaturity: matureAnnual >= target,
  };
}
