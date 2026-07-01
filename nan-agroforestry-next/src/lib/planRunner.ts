import type { FarmInput } from '../data/types';
import { buildSystems } from './engine';
import { fetchClimate } from './climate';
import { checkProtected } from './gistda';
import { satContext } from './satellite';
import { lookupLddSoilGroup } from './ldd';
import { fetchSoil, mergeLddSoil } from './soil';

export async function runPlan(input: FarmInput) {
  const lat = input.lat ?? 18.78;
  const lng = input.lng ?? 100.78;
  const warnings: string[] = [];
  const lddSoilGroup = lookupLddSoilGroup(lat, lng);
  const [climate, protectedArea, soilGrids] = await Promise.all([
    fetchClimate(lat, lng, input.elevationM).catch((error) => {
      warnings.push(`NASA POWER/Open-Meteo climate unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }),
    checkProtected(lat, lng).catch((error) => {
      warnings.push(`GISTDA unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }),
    fetchSoil(lat, lng).catch((error) => {
      warnings.push(`SoilGrids unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }),
  ]);
  const soil = mergeLddSoil(soilGrids, lddSoilGroup);
  if (!lddSoilGroup) warnings.push('ไม่พบ polygon กลุ่มชุดดิน LDD สำหรับพิกัดนี้ — ระบบใช้ SoilGrids/คะแนนกลางแทน');
  if (!soilGrids) warnings.push('ไม่พบข้อมูลดิน SoilGrids สำหรับพิกัดนี้ — ระบบใช้ LDD หรือคะแนนดินกลางแทน');
  const satellite = satContext(lat, lng);
  const systems = buildSystems(input, climate, protectedArea, soil);
  return { systems, climate, protectedArea, satellite, soil, lddSoilGroup, warnings };
}
