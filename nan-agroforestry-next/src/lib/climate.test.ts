import { describe, it, expect } from 'vitest';
import { seasonContext, formatMonthRange, MONTH_TH, type Climate } from './climate';

// Real NASA POWER monthly rainfall (mm/month) for two Nan plots, as returned by the live
// API. Both show the same sharp monsoon: dry Nov-Mar, rains from May, ~5 wet months.
const BO_KLUEA = [13, 5, 29, 74, 139, 129, 200, 235, 166, 60, 17, 11]; // 950 m
const PUA = [16, 6, 30, 85, 168, 140, 215, 262, 199, 77, 22, 13];      // 420 m

const climate = (monthlyPrec?: number[]): Climate => ({
  t2m: 23.1, prec: 1076, drym: 5, pseas: 62, trange: 22,
  solar: 18, rh: 79, gwet: 0.65, elev: 950, monthlyPrec,
});

describe('seasonContext — planting window from the plot own rainfall', () => {
  it('finds the monsoon onset for a real Nan highland plot', () => {
    const s = seasonContext(climate(BO_KLUEA))!;
    expect(s.onsetMonth).toBe(4); // พ.ค. / May
    expect(MONTH_TH[s.onsetMonth!]).toBe('พ.ค.');
    expect(s.plantingWindow.map((m) => MONTH_TH[m])).toEqual(['พ.ค.', 'มิ.ย.']);
  });

  it('agrees across two plots at very different elevations', () => {
    expect(seasonContext(climate(PUA))!.onsetMonth).toBe(seasonContext(climate(BO_KLUEA))!.onsetMonth);
  });

  it('classifies wet and dry months on the mm thresholds', () => {
    const s = seasonContext(climate(BO_KLUEA))!;
    expect(s.wetMonths.map((m) => MONTH_TH[m])).toEqual(['พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.']);
    expect(s.dryMonths.map((m) => MONTH_TH[m])).toEqual(['ม.ค.', 'ก.พ.', 'มี.ค.', 'พ.ย.', 'ธ.ค.']);
  });

  it('flags year-1 irrigation when the dry season is long', () => {
    // 5 dry months in Nan means a seedling planted at onset still faces a long drought in
    // its first year — the single most common cause of establishment failure.
    expect(seasonContext(climate(BO_KLUEA))!.needsYear1Irrigation).toBe(true);
  });

  it('does not flag irrigation for an evenly wet plot', () => {
    const even = new Array(12).fill(150);
    const s = seasonContext(climate(even))!;
    expect(s.dryMonths).toEqual([]);
    expect(s.needsYear1Irrigation).toBe(false);
  });

  it('ignores a single freak wet month in the dry season', () => {
    // One wet month must not be read as the onset of the rains; the rule requires two
    // consecutive wet months, otherwise the app would tell a farmer to plant into a drought.
    const spike = [10, 250, 10, 10, 140, 160, 200, 210, 150, 40, 10, 10];
    const s = seasonContext(climate(spike))!;
    expect(MONTH_TH[s.onsetMonth!]).toBe('พ.ค.'); // not ก.พ., despite ก.พ. having 250 mm
  });

  it('reports no onset when rainfall is flat, rather than inventing one', () => {
    const flat = new Array(12).fill(70); // never reaches the 100 mm wet threshold
    const s = seasonContext(climate(flat))!;
    expect(s.onsetMonth).toBeNull();
    expect(s.plantingWindow).toEqual([]);
  });

  // The offline path matters: planRunner substitutes NaN weather when NASA POWER fails, and
  // guessing a planting month from missing data would be worse than saying nothing.
  it('returns null when monthly rainfall is unavailable', () => {
    expect(seasonContext(climate(undefined))).toBeNull();
    expect(seasonContext(null)).toBeNull();
  });

  it('returns null on a malformed or NaN-filled month array', () => {
    expect(seasonContext(climate([1, 2, 3]))).toBeNull();
    expect(seasonContext(climate(new Array(12).fill(NaN)))).toBeNull();
  });
});

describe('formatMonthRange — the dry season crosses December', () => {
  it('describes Nan dry months as พ.ย.–มี.ค., not ม.ค.–ธ.ค.', () => {
    // The real bug this fixes: dryMonths for a Nan plot is [0,1,2,10,11]; printing
    // first–last gave "ม.ค.–ธ.ค." — a whole year — in farmer-facing text.
    const dry = seasonContext(climate(BO_KLUEA))!.dryMonths;
    expect(dry).toEqual([0, 1, 2, 10, 11]);
    expect(formatMonthRange(dry)).toBe('พ.ย.–มี.ค.');
  });

  it('handles a run that does not wrap', () => {
    expect(formatMonthRange([4, 5, 6, 7, 8])).toBe('พ.ค.–ก.ย.');
  });

  it('handles a single month', () => {
    expect(formatMonthRange([2])).toBe('มี.ค.');
  });

  it('lists non-contiguous months instead of implying one range', () => {
    // Two separate dry spells must not be collapsed into a single misleading span.
    expect(formatMonthRange([1, 5, 9])).toBe('ก.พ., มิ.ย., ต.ค.');
  });

  it('says ทั้งปี when every month qualifies', () => {
    expect(formatMonthRange([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe('ทั้งปี');
  });

  it('returns empty for no months', () => {
    expect(formatMonthRange([])).toBe('');
  });
});
