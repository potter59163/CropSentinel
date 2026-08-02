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
// Applied as a SCALE, not a hard cap. Math.min() flattened every in-range species to exactly
// 0.72 and destroyed the gradient envelope() computes — which mattered little at 21 species
// but is fatal at 51, where 30 have no trained SDM and rank purely on this number. Scaling
// keeps the same ceiling (a perfect envelope fit still tops out at 0.72, so an offline plan
// can never outshine a modelled one) while preserving the ordering within it.
const ENVELOPE_CEILING = 0.72;
const READY = Array.isArray(M.base) && Array.isArray(M.median) && !!M.species; // guards schema transitions
type SuitConfidence = 'high' | 'medium' | 'low' | 'expert';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Elevation fit, 0..1.
 *
 * This used to return a flat 1 anywhere inside [elevMin, elevMax]. That was tolerable when
 * only a handful of species lacked a trained SDM, but the catalogue grew from 21 to 51 and
 * 30 of those have no GBIF-trained model, so they all fell back to the envelope — and every
 * one of them scored an identical ENVELOPE_CEILING (0.72). Suitability stopped discriminating
 * entirely for most of the list, ranking collapsed onto the remaining terms, and ties were
 * settled by array order: a fodder tree came out ahead of ส้มสีทอง on a 400 m plot purely
 * because it was declared first.
 *
 * Inside the band the score now peaks at the middle of the species' range and eases toward
 * the edges, bottoming at 0.82 exactly at elevMin/elevMax. That is a deliberately gentle
 * gradient — the band edges are real agronomic limits, not a preference — but it is enough
 * to order species by how well the plot actually sits within their range instead of by
 * declaration order. Outside the band the original linear decay is unchanged.
 */
function envelope(plant: Plant, elev: number): number {
  if (elev >= plant.elevMin && elev <= plant.elevMax) {
    const span = plant.elevMax - plant.elevMin;
    if (span <= 0) return 1;
    // 0 at the centre of the band, 1 at either edge
    const offCentre = Math.abs(elev - (plant.elevMin + plant.elevMax) / 2) / (span / 2);
    return clamp(1 - 0.18 * offCentre * offCentre, 0.82, 1);
  }
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

// Features the SDM has a weight for but never meaningfully saw vary during training, so a
// real runtime value lands far outside the distribution the weight was fitted on.
//
// Measured over the 4,245 training cells: flood7d_near is 0 in ALL of them (its std is a
// forced 1.0), fire7d_near is nonzero in 13, burn_freq_near in 22, flood_freq_near in 70,
// and drought_layers is a binary 0/3 that is 3 exactly when the GISTDA scan reached the
// cell — a data-coverage flag, not a drought measurement. Yet drought_layers carries the
// largest disaster weight in the shipped logit (mean |w| 0.880).
//
// Because logitPredict standardizes by (x - mean) / std, a live fire7d_near of log1p(9)≈2.30
// becomes (2.30 - 0.0062) / 0.0964 ≈ 24 SD. That single term swamps the linear predictor and
// pins the sigmoid at 1.0. Measured end to end at one 1,200 m Nan plot, toggling live GISTDA
// values moved suitability by mean 0.347 / max 0.777 — taro 0.223 -> 1.000, galangal
// 0.250 -> 1.000 — and since engine.plantFlow scales revenue by (0.4 + 0.6 * suit) that is
// up to an ~87% swing in a farmer's projected 10-year income, caused by data coverage.
//
// Serving therefore has to match training: pass the training median for these, which is what
// training effectively saw. This is NOT discarding the risk data — engine.ts still reads the
// live GISTDA values through disasterFeatureContext for its rule-based riskFit score, which
// is where they belong. Listed by name rather than detected by std, because flood7d_near's
// std is masked to 1.0 by the exporter. On a model that drops these columns (v4) the set
// simply never matches and this is a no-op.
const DEGENERATE_IN_TRAINING = new Set([
  'fire7d_near', 'burn_freq_near', 'flood7d_near', 'flood_freq_near', 'drought_layers',
]);

function vector(c: Climate, risk: ProtectedArea | null, soil: SoilContext | null): number[] {
  const disaster = disasterFeatureContext(risk);
  const soilf = soilFeatureContext(soil);
  const base = M.base.map((n, i) => {
    if (DEGENERATE_IN_TRAINING.has(n)) return M.median[i];
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
    score: envelope(plant, c?.elev ?? plant.elevMin) * ENVELOPE_CEILING,
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
    validation: (M as { validation?: string }).validation ?? null,
  };
};

/**
 * How well the model discriminates each crop, and — the part that matters for honesty —
 * WHY it does badly on some of them.
 *
 * Per-species AUC correlates negatively with how wide the crop's elevation tolerance is
 * (r = -0.516) and negatively with sample size (r = -0.372). The weak crops are the
 * cosmopolitan ones: ginger tolerates 300-1200 m, pumpkin and lemongrass 0-1200 m. A crop
 * that genuinely grows almost anywhere cannot be separated from background by climate, so a
 * low score for it is the CORRECT answer, not a defect to be optimised away. Reported so an
 * officer can say which recommendations rest on a fitted model and which rest on the
 * elevation envelope plus the agronomic rules in engine.ts.
 */
export function speciesReliability() {
  const rows = Object.entries(M.species).map(([sdmId, s]) => ({
    sdmId,
    auc: s.auc,
    n: s.n,
    tier: (s.auc >= 0.82 ? 'strong' : s.auc >= AUC_MIN ? 'usable' : 'envelope') as
      'strong' | 'usable' | 'envelope',
  }));
  rows.sort((a, b) => b.auc - a.auc);
  return rows;
}
