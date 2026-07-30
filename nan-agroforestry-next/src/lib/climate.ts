// Real plot features for the SDM — same set the model was trained on.
// NASA POWER monthly climatology (→ bioclim) + DEM elevation. Free, no key, CORS-OK.
// Soil is NOT part of this feature set, but the old reason recorded here — "SoilGrids is
// CORS-blocked in-browser so it can't be served at inference" — is obsolete: this is a
// Next.js app and planRunner fetches SoilGrids + LDD server-side on every request. The
// current reason is measured, not architectural: under a region-matched, nested protocol,
// adding the five raw soil columns moves mean blocked AUC by about -0.003 to -0.005, i.e.
// nothing. See ml/MODEL-FINDINGS.md. Soil still does real work as the agronomic guardrail
// in engine.ts (drainage/pH gating), just not as an SDM predictor at this grid size.
export interface Climate {
  t2m: number; prec: number; drym: number; pseas: number; trange: number;
  solar: number; rh: number; gwet: number; elev: number;
  // The 12 monthly rainfall totals (mm) this plot's annual figures were derived from.
  // Already fetched from NASA POWER and previously discarded after aggregation — kept now
  // because WHEN it rains decides whether a seedling lives, and the annual total cannot
  // express that. Empty when the climate fetch failed, so callers must check length.
  monthlyPrec?: number[];
}

// Seasonal planting guidance derived from this plot's own monthly rainfall.
// Deliberately NOT per-species: each crop has its own optimal window, and inventing 21 of
// them would be exactly the false precision this project has been removing. What the data
// does support is the establishment rule that applies to every perennial seedling — get it
// in the ground at the onset of the rains so roots form before the dry season.
export interface SeasonContext {
  onsetMonth: number | null;      // 0-11, first of two consecutive months >= WET_MM
  wetMonths: number[];            // 0-11 indices with >= WET_MM
  dryMonths: number[];            // 0-11 indices with < DRY_MM
  plantingWindow: number[];       // 0-11, the onset month and the one after it
  needsYear1Irrigation: boolean;  // long dry season => seedlings need carried water
}

const WET_MM = 100;
const DRY_MM = 50;

export function seasonContext(c: Climate | null): SeasonContext | null {
  const mm = c?.monthlyPrec;
  if (!mm || mm.length !== 12 || !mm.every((v) => Number.isFinite(v))) return null;
  // Require two consecutive wet months so a single freak wet month in the dry season
  // cannot be read as the onset of the rains.
  let onsetMonth: number | null = null;
  for (let i = 0; i < 12; i++) {
    if (mm[i] >= WET_MM && mm[(i + 1) % 12] >= WET_MM) { onsetMonth = i; break; }
  }
  const wetMonths = mm.map((v, i) => (v >= WET_MM ? i : -1)).filter((i) => i >= 0);
  const dryMonths = mm.map((v, i) => (v < DRY_MM ? i : -1)).filter((i) => i >= 0);
  return {
    onsetMonth,
    wetMonths,
    dryMonths,
    plantingWindow: onsetMonth === null ? [] : [onsetMonth, (onsetMonth + 1) % 12],
    needsYear1Irrigation: dryMonths.length >= 4,
  };
}

export const MONTH_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/**
 * Format a set of month indices as a Thai range, handling the year wrap.
 *
 * Nan's dry season runs พ.ย.–มี.ค., i.e. indices [0,1,2,10,11]. Naively printing
 * `first–last` yields "ม.ค.–ธ.ค." — a whole year — which told the farmer the plot is dry
 * all year round. The months have to be rotated so a contiguous run that crosses December
 * is described as the single season it actually is.
 */
export function formatMonthRange(months: number[]): string {
  if (!months.length) return '';
  const set = new Set(months);
  if (set.size === 12) return 'ทั้งปี';
  // Start at a month whose predecessor is absent — that is the true beginning of the run.
  const start = months.find((m) => !set.has((m + 11) % 12));
  if (start === undefined) return months.map((m) => MONTH_TH[m]).join(', ');
  const ordered: number[] = [];
  for (let i = 0, m = start; i < 12 && set.has(m); i++, m = (m + 1) % 12) ordered.push(m);
  // Non-contiguous (e.g. two separate dry spells) — list them rather than imply a range.
  if (ordered.length !== set.size) return months.map((m) => MONTH_TH[m]).join(', ');
  return ordered.length === 1
    ? MONTH_TH[ordered[0]]
    : `${MONTH_TH[ordered[0]]}–${MONTH_TH[ordered[ordered.length - 1]]}`;
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const tfetch = (url: string, ms = 9000) => fetch(url, { signal: AbortSignal.timeout(ms) });

async function powerFeatures(lat: number, lng: number) {
  const url =
    'https://power.larc.nasa.gov/api/temporal/climatology/point' +
    '?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,GWETROOT,T2M_MAX,T2M_MIN' +
    `&community=AG&longitude=${lng}&latitude=${lat}&format=JSON`;
  const p = (await (await tfetch(url)).json()).properties.parameter;
  const mm = MON.map((m) => p.PRECTOTCORR[m] * 30); // mm/month
  const mean = mm.reduce((a, b) => a + b, 0) / 12;
  const sd = Math.sqrt(mm.reduce((s, x) => s + (x - mean) ** 2, 0) / 12);
  return {
    t2m: p.T2M.ANN,
    prec: mm.reduce((a, b) => a + b, 0),
    drym: mm.filter((x) => x < 50).length,
    pseas: (sd / (mean + 1)) * 100,
    trange: p.T2M_MAX.ANN - p.T2M_MIN.ANN,
    solar: p.ALLSKY_SFC_SW_DWN.ANN,
    rh: p.RH2M.ANN,
    gwet: p.GWETROOT.ANN,
    monthlyPrec: mm,
  };
}

// Deliberately does NOT swallow the POWER error. If we returned NaN features
// here, the SDM would silently impute the training median and still report
// source:'model' at full confidence — i.e. rank crops as if we had real climate
// when we have none. Throwing lets planRunner catch it, surface a warning, and
// fall back to the honest elevation-only envelope (source:'envelope', low
// confidence). Callers that hit this directly must handle the rejection.
export async function fetchClimate(lat: number, lng: number, elevationM: number): Promise<Climate> {
  const pw = await powerFeatures(lat, lng);
  return { ...pw, elev: elevationM };
}
