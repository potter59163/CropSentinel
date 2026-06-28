import type { FarmInput } from '../data/types';
import type { SoilData } from './soilAnalysis';
import { buildSystems } from './engine';
import { fetchClimate } from './climate';
import { checkProtected } from './gistda';
import { satContext } from './satellite';

export async function runPlan(input: FarmInput, soilData?: SoilData | null) {
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
  
  // Use soil data to enhance system recommendations if available
  const enrichedInput = soilData ? {
    ...input,
    _soilContext: {
      soilType: soilData.soilType,
      ph: soilData.ph,
      suitableCrops: soilData.suitableCrops
    }
  } : input;
  
  const systems = buildSystems(enrichedInput as any, climate, protectedArea);
  return { systems, climate, protectedArea, satellite, soilData, warnings };
}
