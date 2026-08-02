import snapshot from '../data/nabc_maize.json';

/**
 * The maize a Nan farmer is converting away from, in real numbers.
 *
 * Data comes from a COMMITTED SNAPSHOT (src/data/nabc_maize.json), refreshed by running
 * scripts/fetch-nabc.mjs, not from a request at plan time.
 *
 * The app originally called https://agriapi.nabc.go.th on every plan run. That works from a
 * laptop in Thailand — 0.5s, HTTP 200, 380 KB — and returns nothing from a Vercel function, so
 * the entire maize comparison silently disappeared in production and only a local-versus-
 * production diff caught it. Most likely the API does not serve Vercel's egress; either way
 * the runtime path could not be relied on for the one genuinely Nan-specific number in the
 * whole tool.
 *
 * A snapshot is the right shape anyway. Province yield is published once a year, so fetching
 * it per request was always waste. The monthly price does age, which is why fetchedAt and the
 * data's own period are both carried through and both shown — a visibly dated number is
 * honest in a way a silently missing section is not.
 *
 * PROVENANCE, which is mixed and must stay labelled:
 *   yield — Nan province (TH55). The only genuinely local number in the chain. Nan runs
 *           ~693 kg/rai against a national ~790, so a national figure would overstate a Nan
 *           harvest by about 14%.
 *   price — NATIONAL. Every price record the API returns carries province_code TH00; no
 *           sub-national series is published anywhere. A village buying point pays less.
 *   cost  — OAE cost workbook, stamped ธันวาคม 2563, so about five and a half years old.
 */

/**
 * สศก. ต้นทุนการผลิตข้าวโพดเลี้ยงสัตว์, ปีเพาะปลูก 2567/68. ฿/rai/yr.
 *
 * From "สารสนเทศเศรษฐกิจการเกษตรรายสินค้า ปี 2567" p.17: 7,280 ฿/tonne against a national
 * 737 kg/rai. Replaces the ธันวาคม 2563 workbook figure of 4,351.80, which was five and a half
 * years old and 23% lower.
 *
 * Deliberately NOT computed as ฿/tonne x the Nan yield (7,280 x 0.693 = 5,045). Per-rai spend
 * is the transferable quantity; a per-tonne cost already has national yield baked into it, so
 * that multiplication would quietly claim a Nan farmer spends less per rai because they harvest
 * less — the opposite of what a below-average yield means.
 *
 * This is a FULL ECONOMIC COST in OAE's sense: it prices family labour at the local wage and
 * imputes land rent. It has to be, because the agroforestry side is now on the same basis, and
 * the whole point of this card is a like-for-like comparison. A Nan-specific alternative exists
 * — 6,850.96 ฿/rai measured across 78 maize households in บ้านปางปุก อ.สองแคว (CRRU 2564), 57%
 * above the national figure — but it is one village, so it is cited on screen as a local upper
 * reference rather than used as the default.
 */
export const MAIZE_COST_PER_RAI_OAE = 5365;
/** The measured Nan figure, shown beside the national one rather than replacing it. */
export const MAIZE_COST_PER_RAI_NAN_STUDY = 6851;

export interface MaizeBaseline {
  /** kg/rai, Nan province. */
  yieldKgPerRai: number;
  yieldYear: string;
  /** rai planted in Nan that crop year — the conversion trend, straight from the source. */
  areaRai: number;
  areaEarliestRai?: number;
  areaEarliestYear?: string;
  /** ฿/kg, NATIONAL — no sub-national price series exists. */
  pricePerKg: number;
  priceYear: number;
  priceMonth: string;
  /** ฿/rai/yr, สศก. ธันวาคม 2563. */
  costPerRai: number;
  /** Net ฿/rai/yr on these three numbers. */
  netPerRaiYear: number;
  /** When the snapshot was taken, so a farmer can judge how stale the price is. */
  fetchedAt: string;
}

function build(): MaizeBaseline | null {
  const s = snapshot as Record<string, unknown>;
  const yieldKgPerRai = Number(s.yieldKgPerRai);
  const pricePerKg = Number(s.pricePerKg);
  // A malformed or half-written snapshot must not become a confident wrong number on screen.
  if (!Number.isFinite(yieldKgPerRai) || yieldKgPerRai <= 0) return null;
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return null;

  return {
    yieldKgPerRai,
    yieldYear: String(s.yieldYear ?? ''),
    areaRai: Number(s.areaRai) || 0,
    areaEarliestRai: typeof s.areaEarliestRai === 'number' ? s.areaEarliestRai : undefined,
    areaEarliestYear: typeof s.areaEarliestYear === 'string' ? s.areaEarliestYear : undefined,
    pricePerKg,
    priceYear: Number(s.priceYear) || 0,
    priceMonth: String(s.priceMonth ?? ''),
    costPerRai: MAIZE_COST_PER_RAI_OAE,
    netPerRaiYear: Math.round(yieldKgPerRai * pricePerKg - MAIZE_COST_PER_RAI_OAE),
    fetchedAt: String(s.fetchedAt ?? ''),
  };
}

const BASELINE = build();

/**
 * Kept async so planRunner's Promise.all and its callers are unchanged, and so a future
 * live-with-snapshot-fallback strategy would not need a signature change.
 */
export async function fetchMaizeBaseline(): Promise<MaizeBaseline | null> {
  return BASELINE;
}

/** Ten-year net from continuing to grow maize on this plot, at snapshot numbers. */
export function maizeTenYear(baseline: MaizeBaseline, sizeRai: number): number {
  return Math.round(baseline.netPerRaiYear * Math.max(0, sizeRai) * 10);
}
