import type { FarmInput } from '../data/types';
import { buildSystems } from './engine';
import { fetchClimate } from './climate';
import { checkProtected } from './gistda';
import { satContext } from './satellite';

export async function runPlan(input: FarmInput) {
  const lat = input.lat ?? 18.78;
  const lng = input.lng ?? 100.78;
  const warnings: string[] = [];
  const [climate, protectedArea] = await Promise.all([
    fetchClimate(lat, lng, input.elevationM).catch((error) => {
      warnings.push(`NASA POWER/Open-Meteo climate unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }),
    checkProtected(lat, lng).catch((error) => {
      warnings.push(`GISTDA unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }),
  ]);
  const satellite = satContext(lat, lng);
  const systems = buildSystems(input, climate, protectedArea);
  return { systems, climate, protectedArea, satellite, warnings };
}
