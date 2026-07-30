import type { CropAssumption, FarmInput } from '../data/types';
import { buildSystems } from './engine';
import { fetchClimate } from './climate';
import { checkProtected } from './gistda';
import { satContext } from './satellite';
import { lookupLddSoilGroup } from './ldd';
import { fetchSoil, mergeLddSoil } from './soil';
import { getCropPriceOverrides } from './cropPrices';
import { sanitizeAssumptions } from './planSchema';

// Layers admin-set prices under the farmer's own advanced overrides (if any),
// which still win field-by-field — an explicit per-plan number a farmer typed
// in beats the site-wide default.
export function withPriceOverrides(input: FarmInput, overrides: Record<string, { pricePerKg: number }>): FarmInput {
  if (!Object.keys(overrides).length) return input;
  const byId = new Map<string, CropAssumption>();
  for (const [plantId, o] of Object.entries(overrides)) byId.set(plantId, { plantId, pricePerKg: o.pricePerKg });
  for (const a of input.cropAssumptions ?? []) {
    const merged: CropAssumption = { ...(byId.get(a.plantId) ?? { plantId: a.plantId }) };
    for (const [key, value] of Object.entries(a)) {
      if (value !== undefined) (merged as unknown as Record<string, unknown>)[key] = value;
    }
    byId.set(a.plantId, merged);
  }
  return { ...input, cropAssumptions: Array.from(byId.values()) };
}

export async function runPlan(rawInput: FarmInput) {
  // Authoritative copy of the share-link guard: an override may only apply to a plant the
  // user actually selected, so a hand-rolled POST cannot inject economics for plants the
  // UI never shows. See sanitizeAssumptions for the full rationale.
  const input = sanitizeAssumptions(rawInput);
  const lat = input.lat ?? 18.78;
  const lng = input.lng ?? 100.78;
  const warnings: string[] = [];
  const lddSoilGroup = lookupLddSoilGroup(lat, lng);
  const [climate, protectedArea, soilGrids, priceOverrides] = await Promise.all([
    fetchClimate(lat, lng, input.elevationM).catch((error) => {
      warnings.push(`NASA POWER/Open-Meteo climate unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      // Keep the plot's REAL elevation so elevation-based filtering still works;
      // NaN weather features make plantSuitability fall through to the honest
      // envelope (low confidence) instead of running the SDM on imputed medians.
      return { t2m: NaN, prec: NaN, drym: NaN, pseas: NaN, trange: NaN, solar: NaN, rh: NaN, gwet: NaN, elev: input.elevationM };
    }),
    checkProtected(lat, lng).catch((error) => {
      warnings.push(`GISTDA unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }),
    fetchSoil(lat, lng).catch((error) => {
      warnings.push(`SoilGrids unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }),
    getCropPriceOverrides(),
  ]);
  const soil = mergeLddSoil(soilGrids, lddSoilGroup);
  if (!lddSoilGroup) warnings.push('ไม่พบ polygon กลุ่มชุดดิน LDD สำหรับพิกัดนี้ · ระบบใช้ SoilGrids/คะแนนกลางแทน');
  if (!soilGrids) warnings.push('ไม่พบข้อมูลดิน SoilGrids สำหรับพิกัดนี้ · ระบบใช้ LDD หรือคะแนนดินกลางแทน');
  const satellite = satContext(lat, lng);
  const effectiveInput = withPriceOverrides(input, priceOverrides);
  const systems = buildSystems(effectiveInput, climate, protectedArea, soil);
  return { systems, climate, protectedArea, satellite, soil, lddSoilGroup, warnings };
}
