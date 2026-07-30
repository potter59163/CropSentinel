// Inference for the trained SDM (logistic, rich real features) + envelope fallback.
import model from '../data/sdm_model.json';
import type { Climate } from './climate';
import type { Plant } from '../data/types';
import type { ProtectedArea } from './gistda';
import type { SoilContext } from './soil';

interface GbmTree {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[];
}
interface SpeciesModel {
  w: number[];
  b: number;
  auc: number;
  aucGBM?: number;
  aucLogitSpatial?: number;
  preferred?: 'logit' | 'gbm';
  gbm?: { learningRate: number; init: number; trees: GbmTree[] };
  n: number;
}
const M = model as unknown as {
  version?: number;
  base: string[]; sq: string[]; features: string[];
  mean: number[]; std: number[]; median: number[];
  species: Record<string, SpeciesModel>;
};
const AUC_MIN = 0.65; // below this the SDM is too weak for production ranking
// Ceiling on the elevation-envelope fallback. Knowing only that a plot's elevation sits
// inside a species' published range is far weaker evidence than a fitted model over
// bioclim + soil features, yet envelope() returns exactly 1.0 for any in-range plot.
// Uncapped, a climate outage made every species score a perfect 1.0 and produced plans
// that looked 50-95% MORE profitable than the same plot computed with live data
// (suitability feeds revenue directly in engine.plantFlow). A farmer must never be shown
// a more attractive plan because the network failed.
const ENVELOPE_CEILING = 0.72;
const READY = Array.isArray(M.base) && Array.isArray(M.median) && !!M.species; // guards schema transitions
type SuitConfidence = 'high' | 'medium' | 'low' | 'expert';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function envelope(plant: Plant, elev: number): number {
  if (elev >= plant.elevMin && elev <= plant.elevMax) return 1;
  const d = elev < plant.elevMin ? plant.elevMin - elev : elev - plant.elevMax;
  return clamp(1 - d / 450, 0.05, 1);
}

function applyAgronomicGuardrail(score: number, plant: Plant, elev: number): number {
  const elevFit = envelope(plant, elev);
  const blended = score * 0.78 + elevFit * 0.22;
  const agronomicCap = 0.35 + elevFit * 0.65;
  return clamp(Math.min(blended, agronomicCap), 0.05, 1);
}

// build the model's feature vector from a plot's climate (impute missing with training median)
export function disasterFeatureContext(risk: ProtectedArea | null) {
  const layers = risk?.disasterDroughtLayers?.length ?? 0;
  return {
    fire7d_near: Math.log1p(Math.max(risk?.disasterFire7dNear ?? risk?.fireNearby ?? 0, 0)),
    burn_freq_near: Math.log1p(Math.max(risk?.disasterBurnFreqNear ?? 0, 0)),
    flood7d_near: Math.log1p(Math.max(risk?.disasterFlood7dNear ?? 0, 0)),
    flood_freq_near: Math.log1p(Math.max(risk?.disasterFloodFreqNear ?? 0, 0)),
    drought_layers: layers,
  };
}

// Soil features in the SAME physical units the model was trained on (SoilGrids).
export function soilFeatureContext(soil: SoilContext | null) {
  const drainageIdx = soil?.drainage === 'good' ? 0.82 : soil?.drainage === 'moderate' ? 0.55 : soil?.drainage === 'poor' ? 0.25 : undefined;
  const acidityIdx = soil?.acidity === 'neutral' ? 0.88 : soil?.acidity === 'slight' ? 0.74 : soil?.acidity === 'moderate' ? 0.48 : soil?.acidity === 'strong' ? 0.22 : undefined;
  const fertilityIdx = soil ? soil.fertility : undefined;
  if (soil?.sdmFeatureSource !== 'soilgrids') {
    return {
      soil_ph: undefined,
      soil_clay: undefined,
      soil_sand: undefined,
      soil_oc: undefined,
      soil_cec: undefined,
      soil_drainage_idx: drainageIdx,
      soil_acidity_idx: acidityIdx,
      soil_fertility_idx: fertilityIdx,
    };
  }
  return {
    soil_ph: soil?.ph,
    soil_clay: soil?.clayPct,
    soil_sand: soil?.sandPct,
    soil_oc: soil?.organicCarbonPct,
    soil_cec: soil?.cec,
    soil_drainage_idx: drainageIdx,
    soil_acidity_idx: acidityIdx,
    soil_fertility_idx: fertilityIdx,
  };
}

function vector(c: Climate, risk: ProtectedArea | null, soil: SoilContext | null): number[] {
  const disaster = disasterFeatureContext(risk);
  const soilf = soilFeatureContext(soil);
  const base = M.base.map((n, i) => {
    const v = ((c as any)[n] ?? (disaster as any)[n] ?? (soilf as any)[n]) as number;
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

function sigmoid(v: number) {
  return 1 / (1 + Math.exp(-v));
}

function logitPredict(sp: SpeciesModel, x: number[]) {
  let lin = sp.b;
  for (let i = 0; i < x.length; i++) lin += sp.w[i] * ((x[i] - M.mean[i]) / (M.std[i] || 1));
  return sigmoid(lin);
}

function treeValue(tree: GbmTree, x: number[]) {
  let node = 0;
  while (tree.children_left[node] !== -1 && tree.children_right[node] !== -1) {
    node = x[tree.feature[node]] <= tree.threshold[node] ? tree.children_left[node] : tree.children_right[node];
  }
  return tree.value[node] ?? 0;
}

function gbmPredict(sp: SpeciesModel, x: number[]) {
  if (!sp.gbm) return logitPredict(sp, x);
  let raw = sp.gbm.init;
  for (const tree of sp.gbm.trees) raw += sp.gbm.learningRate * treeValue(tree, x);
  return sigmoid(raw);
}

export function plantSuitability(plant: Plant, c: Climate | null, risk: ProtectedArea | null = null, soil: SoilContext | null = null): Suit {
  const sp = READY && plant.sdmId ? M.species[plant.sdmId] : undefined;
  // Require real weather features (not just a non-null climate) — an
  // elevation-only fallback carries NaN features, and running the SDM on those
  // would silently impute training medians and mislabel it source:'model'.
  if (sp && sp.auc >= AUC_MIN && c && Number.isFinite(c.t2m)) {
    const x = vector(c, risk, soil);
    const score = sp.preferred === 'gbm' && sp.gbm ? gbmPredict(sp, x) : logitPredict(sp, x);
    return { score: applyAgronomicGuardrail(score, plant, c.elev), source: 'model', auc: sp.auc, confidence: confidence(sp.auc) };
  }
  // NOTE `c?.elev ?? plant.elevMin`: falling back to the species' OWN elevMin scores every
  // plant at its personal optimum, which is why a caller passing climate=null got an
  // identical perfect plan for every plot. Callers without live weather must still pass a
  // climate object carrying the plot's real elevation (see planRunner) — this default is a
  // last resort only, and the ceiling below keeps it from masquerading as a strong result.
  return {
    score: Math.min(envelope(plant, c?.elev ?? plant.elevMin), ENVELOPE_CEILING),
    source: 'envelope',
    auc: sp?.auc,
    confidence: sp ? 'low' : 'expert',
  };
}

export const modelMeta = () => {
  const all = Object.values(M.species);
  const sp = all.filter((s) => s.auc >= AUC_MIN);
  const weak = all.filter((s) => s.auc < AUC_MIN);
  return {
    count: sp.length,
    version: M.version ?? null,
    featureCount: M.features?.length ?? 0,
    avgAuc: sp.reduce((s, v) => s + v.auc, 0) / Math.max(1, sp.length),
    minAuc: sp.reduce((m, v) => Math.min(m, v.auc), 1),
    weakCount: weak.length,
    weakMaxAuc: weak.reduce((m, v) => Math.max(m, v.auc), 0),
  };
};
