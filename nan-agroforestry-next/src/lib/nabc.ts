/**
 * ศูนย์ข้อมูลเกษตรแห่งชาติ (NABC/สศก.) AgriAPI — https://agriapi.nabc.go.th
 *
 * Free, keyless, JSON. Two endpoints matter here:
 *   /api/production/by-commod?commod=X&api_type=3   province-level yield (kg/rai)
 *   /api/monthly-prices/commod?commod=X             monthly farm-gate price (฿/kg)
 *
 * WHAT THIS CAN AND CANNOT DO — established by calling it, not by reading about it.
 *
 * It CANNOT improve the yield figures of any of the app's 55 plantable species. Province-level
 * yield exists for ข้าวโพดเลี้ยงสัตว์, ข้าว, มันสำปะหลัง, and rows-without-yield for ยางพารา,
 * ทุเรียน and ปาล์มน้ำมัน. Of those, maize, cassava and rubber are only PREVIOUS land uses in
 * this app, not things a farmer plants; and the rice series is ข้าวนาปี/นาปรัง (paddy), not the
 * ข้าวไร่ (upland rice) the app carries. ลำไย, กาแฟ, ลิ้นจี่, มะม่วง, ถั่วลิสง, สับปะรด, เงาะ,
 * พริกไทย and มะพร้าว all return zero rows at province level.
 *
 * What it CAN do is make the baseline real, which is arguably worth more. The app's entire
 * premise is converting maize land, but until now it never said what that maize was actually
 * earning — so a farmer had no honest reference point for a ten-year agroforestry projection.
 * With real Nan yield (693 kg/rai against a national ~790, so a national figure overstates a
 * Nan harvest by about 14%) the comparison stops being a guess.
 *
 * Provenance is mixed and must be labelled that way:
 *   yield  — Nan province, from this API. The only genuinely local number in the chain.
 *   price  — NATIONAL. Every price record carries province_code TH00; no sub-national price
 *            series is published anywhere. A village buying point pays less.
 *   cost   — OAE cost workbook, stamped ธันวาคม 2563. Roughly five and a half years old.
 */

const BASE = 'https://agriapi.nabc.go.th';
const NAN_PROVINCE_CODE = 'TH55';
const MAIZE = 'ข้าวโพดเลี้ยงสัตว์';

/** สศก. cost workbook (article/487), ข้าวโพดเลี้ยงสัตว์, ธันวาคม 2563. ฿/rai/yr. */
export const MAIZE_COST_PER_RAI_OAE = 4351.8;

interface ProductionRow {
  year_crop: string;
  province_code: string;
  province_name: string;
  subcommod: string;
  area_plant: number | null;
  yield_plant: number | null;
}

interface PriceRow {
  year_th: number;
  month: string;
  value: string | null;
  unit: string;
}

export interface MaizeBaseline {
  /** kg/rai, Nan province. */
  yieldKgPerRai: number;
  yieldYear: string;
  /** rai planted in Nan that crop year — the conversion trend, straight from the source. */
  areaRai: number;
  /** Earliest year available, for the area trend. */
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
}

async function getJson(path: string, revalidateSeconds: number): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    // Yield updates annually and price monthly, so a long cache is correct and keeps the app
    // off a government API on every plan run.
    next: { revalidate: revalidateSeconds },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`NABC ${path} -> ${res.status}`);
  return res.json();
}

function rowsOf(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? data : [];
}

/**
 * The maize a Nan farmer is converting away from, in real numbers.
 *
 * Returns null on any failure — a missing baseline is a missing section, never a guessed one.
 * The whole point is that this number is real; substituting a national fallback and not saying
 * so would be worse than showing nothing.
 */
export async function fetchMaizeBaseline(): Promise<MaizeBaseline | null> {
  try {
    const [prodPayload, pricePayload] = await Promise.all([
      // Annual data; 24 h is already generous.
      getJson(`/api/production/by-commod?commod=${encodeURIComponent(MAIZE)}&api_type=3&limit=1000`, 86400),
      getJson(`/api/monthly-prices/commod?commod=${encodeURIComponent(MAIZE)}&limit=24`, 43200),
    ]);

    const nanRows = (rowsOf(prodPayload) as ProductionRow[])
      .filter((r) => r?.province_code === NAN_PROVINCE_CODE
        // "รวมรุ่น" is the combined figure across planting rounds; the per-round rows would
        // undercount a farmer's annual harvest.
        && typeof r.subcommod === 'string' && r.subcommod.includes('รวมรุ่น')
        && typeof r.yield_plant === 'number' && r.yield_plant > 0)
      .sort((a, b) => String(b.year_crop).localeCompare(String(a.year_crop)));
    if (!nanRows.length) return null;
    const latest = nanRows[0];
    const earliest = nanRows[nanRows.length - 1];

    const priceRow = (rowsOf(pricePayload) as PriceRow[])
      .find((r) => r?.value != null && Number.isFinite(Number(r.value)) && Number(r.value) > 0);
    if (!priceRow) return null;

    const pricePerKg = Number(priceRow.value);
    const yieldKgPerRai = latest.yield_plant as number;
    const netPerRaiYear = Math.round(yieldKgPerRai * pricePerKg - MAIZE_COST_PER_RAI_OAE);

    return {
      yieldKgPerRai,
      yieldYear: latest.year_crop,
      areaRai: latest.area_plant ?? 0,
      areaEarliestRai: earliest !== latest ? (earliest.area_plant ?? undefined) : undefined,
      areaEarliestYear: earliest !== latest ? earliest.year_crop : undefined,
      pricePerKg,
      priceYear: priceRow.year_th,
      priceMonth: priceRow.month,
      costPerRai: MAIZE_COST_PER_RAI_OAE,
      netPerRaiYear,
    };
  } catch {
    return null;
  }
}

/** Ten-year net from continuing to grow maize on this plot, at today's numbers. */
export function maizeTenYear(baseline: MaizeBaseline, sizeRai: number): number {
  return Math.round(baseline.netPerRaiYear * Math.max(0, sizeRai) * 10);
}
