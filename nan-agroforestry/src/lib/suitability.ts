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
const AUC_MIN = 0.65; // below this the SDM is too weak for production ranking
const READY = Array.isArray(M.base) && Array.isArray(M.median) && !!M.species; // guards schema transitions
type SuitConfidence = 'high' | 'medium' | 'low' | 'expert';

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

const confidence = (auc?: number): SuitConfidence => {
  if (!auc) return 'expert';
  if (auc >= 0.82) return 'high';
  if (auc >= AUC_MIN) return 'medium';
  return 'low';
};

export interface Suit { score: number; source: 'model' | 'envelope'; auc?: number; confidence: SuitConfidence }

export function plantSuitability(plant: Plant, c: Climate | null): Suit {
  const sp = READY && plant.sdmId ? M.species[plant.sdmId] : undefined;
  if (sp && sp.auc >= AUC_MIN && c) {
    const x = vector(c);
    let lin = sp.b;
    for (let i = 0; i < x.length; i++) lin += sp.w[i] * ((x[i] - M.mean[i]) / (M.std[i] || 1));
    return { score: 1 / (1 + Math.exp(-lin)), source: 'model', auc: sp.auc, confidence: confidence(sp.auc) };
  }
  return { score: envelope(plant, c?.elev ?? plant.elevMin), source: 'envelope', auc: sp?.auc, confidence: sp ? 'low' : 'expert' };
}

export const modelMeta = () => {
  const all = Object.values(M.species);
  const sp = all.filter((s) => s.auc >= AUC_MIN);
  const weak = all.filter((s) => s.auc < AUC_MIN);
  return {
    count: sp.length,
    avgAuc: sp.reduce((s, v) => s + v.auc, 0) / Math.max(1, sp.length),
    minAuc: sp.reduce((m, v) => Math.min(m, v.auc), 1),
    weakCount: weak.length,
    weakMaxAuc: weak.reduce((m, v) => Math.max(m, v.auc), 0),
  };
};
