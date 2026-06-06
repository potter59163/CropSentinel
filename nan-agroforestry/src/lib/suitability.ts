// Inference for the trained SDM (logistic, rich real features) + envelope fallback.
import model from '../data/sdm_model.json';
import type { Climate } from './climate';
import type { Plant } from '../data/types';

interface SpeciesModel { w: number[]; b: number; auc: number; aucGBM?: number; n: number }
const M = model as unknown as {
  base: string[]; sq: string[]; features: string[];
  mean: number[]; std: number[]; median: number[];
  species: Record<string, SpeciesModel>;
};
const AUC_MIN = 0.55; // below this the SDM is unreliable → expert envelope
const READY = Array.isArray(M.base) && Array.isArray(M.median) && !!M.species; // guards schema transitions

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function envelope(plant: Plant, elev: number): number {
  if (elev >= plant.elevMin && elev <= plant.elevMax) return 1;
  const d = elev < plant.elevMin ? plant.elevMin - elev : elev - plant.elevMax;
  return clamp(1 - d / 450, 0.05, 1);
}

// build the model's feature vector from a plot's climate (impute missing with training median)
function vector(c: Climate): number[] {
  const base = M.base.map((n, i) => {
    const v = (c as any)[n] as number;
    return Number.isFinite(v) ? v : M.median[i];
  });
  const sq = M.sq.map((n) => base[M.base.indexOf(n)] ** 2);
  return [...base, ...sq];
}

export interface Suit { score: number; source: 'model' | 'envelope'; auc?: number }

export function plantSuitability(plant: Plant, c: Climate | null): Suit {
  const sp = READY && plant.sdmId ? M.species[plant.sdmId] : undefined;
  if (sp && sp.auc >= AUC_MIN && c) {
    const x = vector(c);
    let lin = sp.b;
    for (let i = 0; i < x.length; i++) lin += sp.w[i] * ((x[i] - M.mean[i]) / (M.std[i] || 1));
    return { score: 1 / (1 + Math.exp(-lin)), source: 'model', auc: sp.auc };
  }
  return { score: envelope(plant, c?.elev ?? plant.elevMin), source: 'envelope' };
}

export const modelMeta = () => {
  const sp = Object.values(M.species).filter((s) => s.auc >= AUC_MIN);
  return { count: sp.length, avgAuc: sp.reduce((s, v) => s + v.auc, 0) / Math.max(1, sp.length) };
};
