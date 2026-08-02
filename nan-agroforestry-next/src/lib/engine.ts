import type { Plant, Layer, FarmInput, SystemPlan, LayerPick, CashflowPoint, Goal, CropAssumption, SoilHealthProxy, ExistingZone } from '../data/types';
import { PLANTS, woodyOf } from '../data/plants';
import { transitionBreakdown } from './landHistory';
import { disasterFeatureContext, plantSuitability } from './suitability';
import type { Climate } from './climate';
import type { ProtectedArea } from './gistda';
import type { SoilContext } from './soil';
import { clamp, pct } from './format';
import { firebreakPlan } from './layout';

const HORIZON = 10;
// vertical land-share per layer (rai-equivalent of monoculture yield in the mixed stand)
/**
 * Fraction of the plot each LAYER occupies, before splitting across the species in it.
 *
 * These sum to 1.25, not 1.0, and that is deliberate: strata stack vertically, so ground
 * cover grows UNDER the canopy rather than competing for the same ground. The sum is the
 * land equivalent ratio (LER) the model assumes — a plot producing 125% of what the same
 * area would yield as single-species blocks.
 *
 * It used to sum to 1.6, which was too generous and showed up the moment a real baseline
 * existed to check it against: a 10 rai plan came out at roughly 24x what the same land
 * earns growing maize, using Nan's own measured maize yield. Published LER for tropical
 * agroforestry generally lands between 1.1 and 1.5, and 1.6 sat above that range while the
 * model ALSO gives every species its full monoculture yield on its share — the two
 * optimisms compounding.
 *
 * The canopy keeps its full 0.5 because canopy trees genuinely occupy the whole plot
 * footprint; the reduction falls on the three understory layers, which is where the overlap
 * assumption was doing the most work.
 *
 * Still not calibrated against measured Nan yields — see docs/METHODOLOGY.md §7.2 and §15.1.
 * A per-species mixture penalty is the remaining known gap.
 */
export const LAYER_SHARE: Record<Layer, number> = { canopy: 0.5, shrub: 0.25, groundcover: 0.25, root: 0.25 };

// Fraction of the HORIZON a crop actually produces income over, using the same
// ramp-up curve as the cashflow model. A slow crop like teak (first yield at
// year 15) returns ~0, so it can no longer top the economic ranking on annual
// potential it never realises inside the 10-year window.
function realizedHorizonFraction(p: Plant): number {
  if (!p.perennial) return 1;
  let sum = 0;
  for (let y = 1; y <= HORIZON; y++) {
    if (y >= p.yearsToYield) sum += clamp((y - p.yearsToYield) / Math.max(1, p.yearsToMature - p.yearsToYield), 0, 1);
  }
  return sum / HORIZON;
}
/**
 * What a species costs to grow for one year on one rai, on the same basis plantFlow charges it.
 *
 * An annual pays its establishment every single year — it is replanted — and pays it once per
 * CYCLE, because a second crop in the same year means a second round of land prep, seed and
 * planting labour. Revenue was already multiplied by cyclesPerYear while cost was not, so a
 * two-cycle crop like ถั่วลิสง or พริก booked two harvests against one crop's expenses.
 */
const annualCostOf = (p: Plant) => (p.perennial
  ? p.annualCostPerRai + p.establishCostPerRai / HORIZON
  : (p.establishCostPerRai + p.annualCostPerRai) * Math.max(1, p.cyclesPerYear));

/**
 * Realised NET value per rai per year — revenue minus cost, not revenue alone.
 *
 * This was gross revenue, which made the ranking blind to what a crop costs to grow. It only
 * stayed invisible because the cost data was uniformly too low: correcting ginger to its real
 * ~45,700 ฿/rai/yr turned it loss-making at every site while the ranking went on selecting it
 * into the root layer of every plan, and at 1,200 m the top recommendation flipped to
 * ทองหลางป่า — a service tree with no market at all — because losing its revenue edge cost the
 * avocado plan more than a zero-income species loses by earning nothing.
 *
 * A ranking that cannot see cost will recommend a crop that loses money, and this tool exists
 * to stop a farmer losing a season.
 */
const realizedValue = (p: Plant) =>
  (p.pricePerKg * p.yieldKgPerRai * p.cyclesPerYear - annualCostOf(p)) * realizedHorizonFraction(p);
// Min-max rather than divide-by-max, because net value goes negative — service species have a
// cost and no market by design, and a raw ratio would flip the sign of their whole score term.
const VALUE_HI = Math.max(...PLANTS.map(realizedValue));
const VALUE_LO = Math.min(...PLANTS.map(realizedValue));
const valueScore = (p: Plant) => clamp((realizedValue(p) - VALUE_LO) / Math.max(1, VALUE_HI - VALUE_LO), 0, 1);
const MAX_WOODY = Math.max(...PLANTS.map((p) => woodyOf(p.id)));

interface Scored {
  plant: Plant;
  suit: number;
  source: 'model' | 'envelope';
  auc?: number;
  confidence: 'high' | 'medium' | 'low' | 'expert';
  value: number;
  waterFit: number;
  riskFit: number;
  woodyFit: number;
  soilFit: number;
  realized: number; // fraction of the 10-yr horizon the crop actually yields over
}

// Real soil (SoilGrids) as an expert agronomic adjustment — drainage vs the
// plant's water need, acidity, and fertility. Neutral (0.82) when soil is
// unavailable so plots without coverage are not penalised.
function soilFit(p: Plant, soil: SoilContext | null): number {
  if (!soil) return 0.82;
  let s = 0.85;
  if (soil.drainage === 'poor') {
    // waterlogged clay: drowns drought-loving/low-water crops, rots tubers
    s += p.water === 'high' ? 0.1 : p.water === 'med' ? 0 : -0.18;
    if (p.layer === 'root' && p.water !== 'high') s -= 0.06;
  } else if (soil.drainage === 'good') {
    // freely drained/sandy: dries fast, favours low-water species
    s += p.water === 'low' ? 0.08 : p.water === 'med' ? 0.02 : -0.06;
  } else {
    s += 0.04; // loam ≈ ideal for most
  }
  if (soil.acidity === 'strong') s -= 0.08;
  else if (soil.acidity === 'neutral') s += 0.03;
  s += (soil.fertility - 0.5) * 0.16; // heavier feeders gain on rich soil
  return clamp(s, 0.4, 1);
}

export function waterFit(p: Plant, climate: Climate | null, risk: ProtectedArea | null): number {
  const disaster = disasterFeatureContext(risk);
  // NaN weather features (climate-outage fallback carries a real elevation but
  // NaN weather) must stay NEUTRAL — otherwise every NaN comparison below is
  // false, silently asserting "no water stress" and manufacturing a water-fit
  // edge for med-water crops from data we don't have. Mirrors suitability.ts.
  if (!climate || !Number.isFinite(climate.t2m)) return 0.7;
  const dryStress = climate.drym >= 5 || climate.gwet < 0.46 || climate.rh < 68 || disaster.drought_layers >= 2;
  const wetStress = climate.prec > 1600 || climate.gwet > 0.62 || disaster.flood_freq_near >= Math.log1p(10);
  if (dryStress) {
    if (p.water === 'low') return 1;
    if (p.water === 'med') return 0.76;
    return 0.46;
  }
  if (wetStress) {
    if (p.water === 'high') return 1;
    if (p.water === 'med') return 0.84;
    return 0.62;
  }
  if (p.water === 'med') return 0.92;
  return 0.78;
}

function riskFit(p: Plant, climate: Climate | null, risk: ProtectedArea | null): number {
  const d = disasterFeatureContext(risk);
  let score = 0.82;
  if (d.fire7d_near > 0 || d.burn_freq_near >= Math.log1p(20)) {
    score += p.water === 'low' ? 0.08 : p.water === 'med' ? 0.03 : -0.06;
    score += p.perennial ? 0.05 : -0.02;
    score += p.nFixing ? 0.04 : 0;
  }
  if (d.flood7d_near > 0 || d.flood_freq_near >= Math.log1p(20)) {
    score += p.water === 'high' ? 0.1 : p.water === 'med' ? 0.04 : -0.08;
    score += p.layer === 'groundcover' ? 0.03 : 0;
  }
  if ((climate?.drym ?? 0) >= 5 || d.drought_layers >= 2) {
    score += p.water === 'low' ? 0.08 : p.water === 'med' ? 0.02 : -0.1;
  }
  return clamp(score, 0.35, 1);
}

function elevationFit(p: Plant, climate: Climate | null): number {
  if (!climate) return 1;
  const elev = climate.elev;
  if (elev >= p.elevMin && elev <= p.elevMax) return 1;
  const distance = elev < p.elevMin ? p.elevMin - elev : elev - p.elevMax;
  return clamp(1 - distance / 450, 0.05, 1);
}

function agronomicCap(p: Plant, climate: Climate | null): number {
  return 0.35 + elevationFit(p, climate) * 0.65;
}

function agroforestryFit(picks: LayerPick[], cashflow: CashflowPoint[], canopyShadeMature: number) {
  const layers = new Set(picks.map((p) => p.layer));
  const canopy = picks.filter((p) => p.layer === 'canopy');
  const understory = picks.filter((p) => p.layer !== 'canopy');
  const strata = clamp((layers.size / 4) * 0.65 + (canopy.length >= 2 ? 0.35 : 0), 0, 1);
  const diversity = clamp((new Set(picks.map((p) => p.plant.category)).size / 6) * 0.55 + (new Set(picks.map((p) => p.plant.id)).size / 7) * 0.45, 0, 1);
  const shade = understory.length
    ? understory.reduce((sum, p) => sum + clamp(1 - Math.max(0, canopyShadeMature * 0.72 - p.plant.shadeTol) / 0.7, 0, 1), 0) / understory.length
    : 0.45;
  const hasGround = picks.some((p) => p.layer === 'groundcover');
  const hasRoot = picks.some((p) => p.layer === 'root');
  const hasNFix = picks.some((p) => p.plant.nFixing);
  const woodyShare = picks.filter((p) => p.plant.perennial).reduce((sum, p) => sum + p.shareRai, 0) / Math.max(1, picks.reduce((sum, p) => sum + p.shareRai, 0));
  const soilCover = clamp((hasGround ? 0.38 : 0) + (hasRoot ? 0.16 : 0) + (hasNFix ? 0.24 : 0) + woodyShare * 0.22, 0, 1);
  const positiveYears = cashflow.filter((p) => p.net > 0).length / HORIZON;
  const hasQuickCrop = picks.some((p) => !p.plant.perennial || p.plant.yearsToYield <= 2);
  const hasLongCrop = picks.some((p) => p.plant.perennial && p.plant.yearsToMature >= 6);
  const incomeContinuity = clamp(positiveYears * 0.55 + (hasQuickCrop ? 0.25 : 0) + (hasLongCrop ? 0.2 : 0), 0, 1);
  const riskBuffer = clamp(
    picks.reduce((sum, p) => sum + p.scoreParts.riskFit, 0) / Math.max(1, picks.length) * 0.5 +
    picks.reduce((sum, p) => sum + p.scoreParts.waterFit, 0) / Math.max(1, picks.length) * 0.25 +
    soilCover * 0.25,
    0,
    1,
  );
  const score = strata * 0.22 + diversity * 0.18 + shade * 0.16 + soilCover * 0.18 + incomeContinuity * 0.12 + riskBuffer * 0.14;
  return {
    score,
    parts: { strata, diversity, shade, soilCover, incomeContinuity, riskBuffer },
  };
}

function scoreAll(climate: Climate | null, risk: ProtectedArea | null, soil: SoilContext | null): Record<Layer, Scored[]> {
  const out = { canopy: [], shrub: [], groundcover: [], root: [] } as Record<Layer, Scored[]>;
  for (const p of PLANTS) {
    const s = plantSuitability(p, climate, risk, soil);
    const water = waterFit(p, climate, risk);
    const riskScore = riskFit(p, climate, risk);
    const soilScore = soilFit(p, soil);
    // SDM is 62% of the blend so it stays the dominant signal, but water/soil/
    // risk can now nudge the score both ways (not just downward) — good soil no
    // longer fails to help a species the SDM rates only middling.
    const rawSuit = clamp((s.score * 0.62) + (water * 0.12) + (riskScore * 0.1) + (soilScore * 0.1) + ((woodyOf(p.id) / MAX_WOODY) * 0.06), 0, 1);
    // hard agronomic guardrails still apply: a severe elevation or drainage/
    // acidity mismatch keeps a crop from ever looking "great" on this plot.
    const soilCap = 0.55 + soilScore * 0.45;
    const deploySuit = Math.min(rawSuit, agronomicCap(p, climate), soilCap);
    out[p.layer].push({
      plant: p,
      suit: deploySuit,
      source: s.source,
      auc: s.auc,
      confidence: s.confidence,
      value: valueScore(p),
      waterFit: water,
      riskFit: riskScore,
      woodyFit: woodyOf(p.id) / MAX_WOODY,
      soilFit: soilScore,
      realized: realizedHorizonFraction(p),
    });
  }
  return out;
}

function goalRank(goal: Goal, s: Scored): number {
  const fast = s.plant.perennial ? clamp(1 - (s.plant.yearsToYield - 1) / 9, 0, 1) : 1;
  let base: number;
  if (goal === 'fast') base = 0.3 * s.suit + 0.32 * fast + 0.16 * s.value + 0.12 * s.waterFit + 0.1 * s.riskFit;
  else if (goal === 'profit') base = 0.24 * s.suit + 0.48 * s.value + 0.1 * s.waterFit + 0.1 * s.riskFit + 0.08 * s.woodyFit;
  else base = 0.36 * s.suit + 0.22 * s.value + 0.17 * s.waterFit + 0.13 * s.riskFit + 0.12 * s.woodyFit;
  // Every goal lives inside the 10-yr horizon, so a crop that yields little/
  // nothing in that window (e.g. teak, first cut ~year 15) shouldn't be auto-
  // ranked as a primary. Farmer-selected plants are forced in elsewhere and
  // bypass this ranking, so this only discounts *system* picks.
  return base * (0.4 + 0.6 * s.realized);
}

const selectedIds = (input: FarmInput, layer: Layer) => input.selectedByLayer?.[layer] ?? [];
const isFarmerPick = (input: FarmInput, id: string, layer: Layer) => selectedIds(input, layer).includes(id);
const assumptionFor = (input: FarmInput, plantId: string): CropAssumption | undefined =>
  input.cropAssumptions?.find((a) => a.plantId === plantId);

function normalizedExistingZones(input: FarmInput): ExistingZone[] {
  const zones = (input.existingZones ?? [])
    .filter((z) => z.cropId && Number.isFinite(z.areaRai) && z.areaRai > 0)
    .map((z) => ({ ...z, areaRai: Math.min(z.areaRai, input.sizeRai) }));
  if (zones.length) return zones;
  if (input.currentCropId) {
    return [{ id: 'legacy-current-crop', cropId: input.currentCropId, areaRai: input.sizeRai }];
  }
  return [];
}

/**
 * Land history now drives species and advice, not just a cost line — see lib/landHistory.ts.
 * The old version mapped each prior use to ONE unsourced number and did nothing else, so a
 * plot coming off fifteen years of maize and a freshly cleared one produced identical advice.
 */
function transitionContext(input: FarmInput) {
  const zones = normalizedExistingZones(input);
  const zoneArea = zones.reduce((sum, z) => sum + z.areaRai, 0);
  const breakdown = transitionBreakdown(zones);

  const notes: string[] = [];
  if (zones.length) {
    // "ถางพื้นที่ 0 บาท" would read as free. A null clearing cost means we could find no
    // published Thai figure for it, which is a different statement entirely.
    const parts = [breakdown.clearingNeedsQuote
      ? `ถางพื้นที่ ${breakdown.clearing > 0 ? `${breakdown.clearing.toLocaleString('en-US')} บาท + ` : ''}ค่าโค่นยางยังประเมินไม่ได้ (ต้องให้ผู้รับเหมาตีราคา)`
      : `ถางพื้นที่ ${breakdown.clearing.toLocaleString('en-US')} บาท`];
    parts.push(`ปรับปรุงดิน ${breakdown.soilRepair.toLocaleString('en-US')} บาท`);
    notes.push(`พื้นที่เดิม ${zones.map((z) => `${z.cropId} ${z.areaRai.toLocaleString('en-US')} ไร่`).join(' · ')} — ${parts.join(' · ')}`);
  } else {
    notes.push('ยังไม่ได้ระบุการใช้พื้นที่เดิม จึงยังไม่บวกต้นทุนเปลี่ยนผ่านเฉพาะแปลง');
  }
  notes.push(...breakdown.year0Actions.map((a) => `ปีที่ 0: ${a}`));
  if (zones.length && Math.abs(zoneArea - input.sizeRai) > Math.max(0.5, input.sizeRai * 0.15)) {
    notes.push(`พื้นที่รวมของโซนเดิม ${zoneArea.toLocaleString('en-US')} ไร่ ไม่เท่ากับขนาดแปลง ${input.sizeRai.toLocaleString('en-US')} ไร่ ควรตรวจตัวเลขก่อนใช้จริง`);
  }
  return { zones, zoneArea, cost: breakdown.total, breakdown, notes };
}

function applyAssumption(p: Plant, assumption?: CropAssumption): Plant {
  if (!assumption) return p;
  const survival = assumption.survivalRate == null ? 1 : clamp(assumption.survivalRate, 0.1, 1.2);
  return {
    ...p,
    pricePerKg: assumption.pricePerKg ?? p.pricePerKg,
    yieldKgPerRai: (assumption.yieldKgPerRai ?? p.yieldKgPerRai) * survival,
    establishCostPerRai: assumption.establishCostPerRai ?? p.establishCostPerRai,
    annualCostPerRai: assumption.annualCostPerRai ?? p.annualCostPerRai,
    cyclesPerYear: assumption.cyclesPerYear ?? p.cyclesPerYear,
  };
}

/**
 * Yield an understory species achieves in mixture, as a fraction of its monoculture yield
 * per unit area — the competition the model otherwise has no term for at all.
 *
 * yieldKgPerRai is a MONOCULTURE figure. Applying it in full to a species' share of a mixed
 * plot assumes a plant between and beneath trees performs exactly as it would in a pure
 * stand, which it does not: it competes for water, nutrients and rooting volume, the trees
 * physically occupy part of its ground, and a farmer managing four layers cannot give any one
 * of them the attention a monocrop gets. None of that is light, so none of it is captured by
 * `fade` — which in any case only bites once the canopy starts closing, leaving the first
 * years entirely unpenalised.
 *
 * Applied only to non-canopy layers. The canopy is the dominant stratum and is not the one
 * being suppressed.
 *
 * 0.7 IS A JUDGEMENT, NOT A MEASURED VALUE, and it is the weakest number in this file. It
 * sits inside the 0.5-0.8 range typically reported for the partial LER of an intercrop
 * component, but the search for a Thai measurement specific to shaded highland systems did
 * not return one — see docs/METHODOLOGY.md §16 for what was found and §17 for what was not.
 * It should be replaced with a calibrated figure as soon as field data exists.
 */
export const MIXTURE_YIELD_FACTOR = 0.7;

// per-plant 10-year net cashflow contribution
function plantFlow(p: Plant, shareRai: number, suit: number, understory: boolean, canopyShadeMature: number, canopyMatureYears: number, priceMultiplier = 1): number[] {
  const net: number[] = [];
  for (let y = 1; y <= HORIZON; y++) {
    let ramp = 1;
    if (p.perennial) ramp = y >= p.yearsToYield ? clamp((y - p.yearsToYield) / Math.max(1, p.yearsToMature - p.yearsToYield), 0, 1) : 0;
    let fade = 1;
    if (understory && canopyShadeMature > 0) {
      const canopyNow = clamp(y / Math.max(1, canopyMatureYears), 0, 1) * canopyShadeMature;
      fade = clamp(1 - Math.max(0, canopyNow - p.shadeTol) * 1.3, 0, 1);
    }
    // Competition that is not light, and that applies from year 1 rather than at canopy
    // closure. See MIXTURE_YIELD_FACTOR.
    const mixture = understory ? MIXTURE_YIELD_FACTOR : 1;
    const active = ramp * fade * mixture;
    const revenue = p.yieldKgPerRai * (p.pricePerKg * priceMultiplier) * p.cyclesPerYear * shareRai * active * (0.4 + 0.6 * suit);
    let cost = 0;
    if (p.perennial) cost = (p.establishCostPerRai * (y === 1 ? 1 : 0) + p.annualCostPerRai) * shareRai;
    // An annual is replanted every year, and a second cycle in the same year is a second round
    // of land prep, seed and planting labour. Revenue above is already multiplied by
    // cyclesPerYear; leaving cost at one cycle booked two harvests against one crop's expenses.
    else if (active > 0.05) cost = (p.establishCostPerRai + p.annualCostPerRai) * Math.max(1, p.cyclesPerYear) * shareRai;
    net.push(revenue - cost);
  }
  return net;
}

function cashflowFromPicks(picks: LayerPick[], canopyShadeMature: number, canopyMatureYears: number, priceMultiplier = 1, transitionCost = 0): CashflowPoint[] {
  const flows = picks.map((p) =>
    plantFlow(p.plant, p.shareRai, p.suitability, p.layer !== 'canopy', p.layer !== 'canopy' ? canopyShadeMature : 0, canopyMatureYears, priceMultiplier)
  );
  const cashflow: CashflowPoint[] = [];
  let cum = 0;
  for (let y = 0; y < HORIZON; y++) {
    const setupCost = y === 0 ? transitionCost : 0;
    const net = flows.reduce((s, f) => s + f[y], 0) - setupCost;
    cum += net;
    cashflow.push({ year: y + 1, income: 0, cost: Math.round(setupCost), net: Math.round(net), cumulative: Math.round(cum) });
  }
  return cashflow;
}

function payback(cashflow: CashflowPoint[]) {
  for (const c of cashflow) if (c.cumulative >= 0) return c.year;
  return null;
}

function soilHealthProxy(picks: LayerPick[], climate: Climate | null, risk: ProtectedArea | null, soil: SoilContext | null): SoilHealthProxy {
  const cover = picks.some((p) => p.layer === 'groundcover') ? 0.28 : 0;
  const root = picks.some((p) => p.layer === 'root') ? 0.08 : 0;
  const nFix = picks.some((p) => p.plant.nFixing) ? 0.16 : 0;
  const perennial = picks.filter((p) => p.plant.perennial).length / Math.max(1, picks.length);
  const dryPenalty = (climate?.drym ?? 0) >= 5 ? 0.1 : 0;
  const firePenalty = Math.max(risk?.fireNearby ?? 0, risk?.disasterFire7dNear ?? 0) > 0 ? 0.08 : 0;
  const floodPenalty = Math.max(risk?.disasterFlood7dNear ?? 0, risk?.disasterFloodFreqNear ?? 0) > 0 ? 0.06 : 0;
  // when real soil is available it anchors the baseline; the system design (cover,
  // n-fixing, perennials) then adds or subtracts from that measured starting point.
  const base = soil ? 0.3 + soil.fertility * 0.34 : 0.42;
  const score = clamp(base + cover + root + nFix + perennial * 0.18 - dryPenalty - firePenalty - floodPenalty, 0, 1);
  return {
    score,
    label: score >= 0.68 ? 'ดี' : score >= 0.48 ? 'ปานกลาง' : 'เสี่ยงเสื่อม',
    signals: [
      soil ? `ดินเชิงพื้นที่: ${soil.ldd ? `${soil.ldd.soilGroupLabel} · ` : ''}${soil.texture} · pH ${soil.ph} (${soil.acidityTh})${soil.sdmFeatureSource === 'soilgrids' ? ` · อินทรียวัตถุ ${soil.organicCarbonPct}%` : ' · อินทรียวัตถุ: ยังไม่มีผลตรวจ'} · ${soil.drainageTh}` : '',
      soil?.ldd?.limitations.length ? `ข้อจำกัด LDD: ${soil.ldd.limitations.join(' / ')}` : '',
      soil && soil.acidity === 'strong' ? 'ดินกรดจัด ควรใส่ปูนโดโลไมต์/ปูนขาวปรับ pH ก่อนปลูกไม้ผลที่ไวต่อกรด' : '',
      soil && soil.sdmFeatureSource === 'soilgrids' && soil.organicCarbonPct < 1 ? 'อินทรียวัตถุต่ำ ควรเพิ่มปุ๋ยอินทรีย์/พืชคลุมดินเร่งฟื้นดิน' : '',
      cover ? 'มีพืชคลุมดินช่วยลดการชะล้าง' : 'ยังควรเพิ่มพืชคลุมดิน',
      nFix ? 'มีพืชตรึงไนโตรเจนช่วยบำรุงดิน' : 'ยังไม่มีพืชตระกูลถั่วบำรุงดิน',
      perennial >= 0.45 ? 'สัดส่วนไม้ยืนต้นช่วยเพิ่มอินทรียวัตถุระยะยาว' : 'ไม้ยืนต้นยังน้อยเมื่อเทียบกับพืชล้มลุก',
      dryPenalty ? 'ฤดูแล้งยาว ต้องเน้นคลุมดินและอินทรียวัตถุ' : '',
      firePenalty ? 'มีความเสี่ยงไฟใกล้แปลง ดินอาจสูญเสียอินทรียวัตถุ' : '',
      floodPenalty ? 'มีความเสี่ยงน้ำท่วม/น้ำท่วมซ้ำซาก ต้องจัดโซนระบายน้ำ' : '',
    ].filter(Boolean),
    limitations: [
      soil
        ? `ดินจาก ${soil.source} เป็นค่าประมาณเชิงพื้นที่/แผนที่ชุดดิน ควรยืนยันด้วยชุดตรวจดินจริง (pH, NPK, อินทรียวัตถุ) ก่อนลงทุนจริง`
        : 'ยังไม่มีข้อมูลดินจริง · เป็น proxy จากภูมิอากาศ/ภัยพิบัติ ไม่ใช่ผลตรวจ pH, NPK',
    ],
  };
}

/**
 * Rai a farmer can actually plant, after the firebreak takes its cut.
 *
 * Exported so the result screen can show the deduction rather than leave the totals looking
 * unexplained — a plan that silently plans 6.8 of 10 rai is as confusing as one that plans 10.
 */
export function plantableRai(input: FarmInput): number {
  const size = Number.isFinite(input.sizeRai) ? input.sizeRai : 0;
  if (size <= 0) return 0;
  const fire = firebreakPlan(size, input.neighbourFuel ?? 'unknown');
  // firebreakPlan already caps its own area at 90% of the plot, so this cannot reach zero.
  return Math.max(0, size - fire.areaCostRai);
}

function buildSystem(scored: Record<Layer, Scored[]>, input: FarmInput, goal: Goal, forcedPrimary: Scored, climate: Climate | null, risk: ProtectedArea | null, soil: SoilContext | null): SystemPlan {
  /**
   * Plant the land that is left after the firebreak, not the whole title deed.
   *
   * The result screen told a farmer, in one panel, that the break "กินพื้นที่ราว 3.2 ไร่ จาก
   * 10 ไร่ · เป็นพื้นที่ที่เสียไปเพื่อกันไฟ ไม่ใช่พื้นที่ปลูก" — and in the panel above it,
   * booked income on all 10. Two answers about the same ground, on one screen, and the error
   * ran the profitable way. Anyone checking could multiply the break area by the plan's
   * baht-per-rai and show the ten-year figure was overstated for every plot in the 5-15 rai
   * band this tool is built for.
   *
   * Same firebreakPlan the layout panel renders, so the two cannot drift apart again.
   */
  const sizeRai = plantableRai(input);
  const transition = transitionContext(input);
  /**
   * Land history demotes species the soil cannot yet carry — an avocado into freshly cleared
   * or degraded ground is a plausible-looking recommendation with a high chance of dying in
   * year one. Demote, do not delete: a farmer who explicitly picks a gated species still gets
   * it (selectedIds bypasses this ranking entirely), they just are not steered into it.
   */
  const gated = new Set(transition.breakdown.gatedSpecies);
  const rank = (arr: Scored[]) => [...arr].sort((a, b) => {
    const pa = gated.has(a.plant.id) ? 1 : 0;
    const pb = gated.has(b.plant.id) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return goalRank(goal, b) - goalRank(goal, a);
  });
  const canopyRanked = rank(scored.canopy);
  const primary = forcedPrimary;
  const selectedCanopy = selectedIds(input, 'canopy')
    .map((id) => canopyRanked.find((s) => s.plant.id === id))
    .filter(Boolean) as Scored[];
  const canopyPicks = [...selectedCanopy];
  if (!canopyPicks.some((s) => s.plant.id === primary.plant.id)) canopyPicks.unshift(primary);
  const notPicked = (s: Scored) => !canopyPicks.some((p) => p.plant.id === s.plant.id);
  /**
   * A nurse / soil-service tree is a legitimate part of the canopy but must not BE the
   * canopy. Expanding to 51 species added several — กระถินยักษ์ (fodder, ~6,600 ฿/rai/yr),
   * แคบ้าน (~2,400), ทองหลางป่า (0, no market at all) — and because they are drought-hardy
   * with wide elevation bands they score well on suitability and water fit, which is most of
   * goalRank. On a 400 m plot the top two canopy slots both went to fodder trees while
   * ส้มสีทอง (~30,600) and ขนุน (~24,000) sat unused. Rather than re-weight goalRank and
   * disturb behaviour that was validated for the original 21, cap it structurally: at most
   * ONE low-income species in the canopy, so the farmer always gets a earning tree up top.
   * A species the farmer picks explicitly bypasses this entirely.
   */
  const LOW_INCOME_PER_RAI_YR = 10_000;
  const lowIncome = (s: Scored) =>
    s.plant.pricePerKg * s.plant.yieldKgPerRai * s.plant.cyclesPerYear < LOW_INCOME_PER_RAI_YR;
  const canopyLowIncomeCount = () => canopyPicks.filter(lowIncome).length;
  while (canopyPicks.length < 2) {
    const room = canopyLowIncomeCount() < 1;
    const ok = (s: Scored) => notPicked(s) && (room || !lowIncome(s));
    // prefer a productive, suitable second canopy; fall back progressively so we
    // always reach 2, but never reach for a non-yielding timber tree first.
    const next = canopyRanked.find((s) => ok(s) && s.suit >= 0.38 && s.realized >= 0.2)
      ?? canopyRanked.find((s) => ok(s) && s.realized >= 0.2)
      ?? canopyRanked.find((s) => ok(s) && s.suit >= 0.38)
      ?? canopyRanked.find(ok)
      ?? canopyRanked.find(notPicked);
    if (!next) break;
    canopyPicks.push(next);
  }

  const pickLayer = (layer: Layer, preferNFix = false) => {
    const farmer = selectedIds(input, layer)
      .map((id) => scored[layer].find((s) => s.plant.id === id))
      .filter(Boolean) as Scored[];
    if (farmer.length) return farmer;
    const r = rank(scored[layer]).filter((s) => s.suit > 0.2);
    const pool = r.length ? r : rank(scored[layer]);
    // Every agroforestry system should carry at least one nitrogen fixer — that is most of
    // why multi-strata rebuilds soil without bought fertiliser. But goalRank is driven by
    // realised revenue, and the strongest fixers (ทองหลางป่า, ถั่วพร้า, ถั่วฮามาต้า, หญ้าแฝก)
    // are SERVICE plants priced at 0 because they have no market, so they sort last and
    // could never be reached. Rather than invent a price to game the ranking, give the
    // ground-cover slot an explicit preference when nothing else in the plan fixes nitrogen.
    if (preferNFix) {
      const fixer = pool.find((s) => s.plant.nFixing && s.suit > 0.2);
      if (fixer) return [fixer];
    }
    return [pool[0]].filter(Boolean);
  };
  const shrubs = pickLayer('shrub');
  const planHasNFix = [...canopyPicks, ...shrubs].some((s) => s.plant.nFixing);
  const grounds = pickLayer('groundcover', !planHasNFix);
  const roots = pickLayer('root');

  // the canopy that casts the most shade governs when the understory gets shaded
  // (tiebreak: the one that closes its canopy soonest) — prevents a slow-maturing
  // timber tree from being gamed to keep the understory sunny for 10 years
  const dominant = [...canopyPicks].sort((a, b) => b.plant.canopyShade - a.plant.canopyShade || a.plant.yearsToMature - b.plant.yearsToMature)[0];
  const canopyShadeMature = dominant.plant.canopyShade;
  const canopyMatureYears = dominant.plant.yearsToMature;

  const picks: LayerPick[] = [];
  const addPick = (s: Scored, layer: Layer, layerCount: number, understory: boolean) => {
    const assumption = assumptionFor(input, s.plant.id);
    const share = assumption?.shareRai != null ? assumption.shareRai / Math.max(1, sizeRai) : LAYER_SHARE[layer] / Math.max(1, layerCount);
    const shareRai = sizeRai * share;
    const plant = applyAssumption(s.plant, assumption);
    picks.push({
      layer, plant, suitability: s.suit, source: s.source, auc: s.auc, modelConfidence: s.confidence, shareRai,
      pickedBy: isFarmerPick(input, s.plant.id, layer) ? 'farmer' : 'system',
      plantsPerRai: assumption?.plantsPerRai,
      totalPlants: assumption?.totalPlants,
      validationStatus: assumption?.validationStatus ?? 'model_suggested',
      expertNote: assumption?.expertNote,
      scoreParts: {
        suitability: s.suit,
        economics: s.value,
        waterFit: s.waterFit,
        riskFit: s.riskFit,
        woodyStructure: s.woodyFit,
      },
    });
  };
  canopyPicks.forEach((c) => addPick(c, 'canopy', canopyPicks.length, false));
  shrubs.forEach((s) => addPick(s, 'shrub', shrubs.length, true));
  grounds.forEach((s) => addPick(s, 'groundcover', grounds.length, true));
  roots.forEach((s) => addPick(s, 'root', roots.length, true));

  const cashflow = cashflowFromPicks(picks, canopyShadeMature, canopyMatureYears, 1, transition.cost);
  const paybackYear = payback(cashflow);
  const cum = cashflow.at(-1)?.cumulative ?? 0;
  const sensitivity = [
    { id: 'down30' as const, label: 'ราคาลด 30%', priceMultiplier: 0.7 },
    { id: 'base' as const, label: 'ราคาฐาน', priceMultiplier: 1 },
    { id: 'up30' as const, label: 'ราคาเพิ่ม 30%', priceMultiplier: 1.3 },
  ].map((s) => {
    const flow = cashflowFromPicks(picks, canopyShadeMature, canopyMatureYears, s.priceMultiplier, transition.cost);
    const profit10 = flow.at(-1)?.cumulative ?? 0;
    return { ...s, cashflow: flow, profit10, annualAvg: Math.round(profit10 / HORIZON), paybackYear: payback(flow) };
  });

  // How much permanent woody structure the system builds up over the horizon, area-weighted
  // and ramped by how mature each perennial gets within 10 years. Used only as a relative
  // score — see WOODY_STRUCTURE_INDEX for why absolute tCO2e figures were removed.
  let woodyAccum = 0;
  for (const pk of picks) {
    const w = woodyOf(pk.plant.id) * pk.shareRai;
    for (let y = 1; y <= HORIZON; y++) {
      const grow = pk.plant.perennial ? clamp(y / pk.plant.yearsToMature, 0, 1) : 1;
      woodyAccum += w * grow;
    }
  }

  const suitability = picks.reduce((s, p) => s + p.suitability, 0) / picks.length;
  // per-rai so small and large plots are scored on the same footing (matches how
  // woodyScore below already normalises by area). ~800k baht/rai over 10 yr = "excellent".
  const economics = clamp(cum / Math.max(1, sizeRai * 800_000), 0, 1);
  const water = picks.reduce((s, p) => s + p.scoreParts.waterFit, 0) / picks.length;
  const disaster = picks.reduce((s, p) => s + p.scoreParts.riskFit, 0) / picks.length;
  const woodyScore = clamp(woodyAccum / Math.max(1, sizeRai * 6.5), 0, 1);
  const farmerTotal = Object.values(input.selectedByLayer ?? {}).reduce((s, ids) => s + ids.length, 0);
  const farmerUsed = picks.filter((p) => p.pickedBy === 'farmer').length;
  const farmerFit = farmerTotal ? farmerUsed / farmerTotal : 0.72;
  const agro = agroforestryFit(picks, cashflow, canopyShadeMature);
  const scoreParts = { agroforestry: agro.score, suitability, economics, waterFit: water, riskFit: disaster, woodyStructure: woodyScore, farmerFit };
  const score = scoreParts.agroforestry * 0.22 + scoreParts.suitability * 0.26 + scoreParts.economics * 0.18 + scoreParts.waterFit * 0.1 + scoreParts.riskFit * 0.11 + scoreParts.woodyStructure * 0.08 + scoreParts.farmerFit * 0.05;

  return {
    picks, canopy: picks.filter((p) => p.layer === 'canopy'),
    cashflow, paybackYear, profit10: Math.round(cum), annualAvg: Math.round(cum / HORIZON),
    suitability,
    productProfit10: Math.round(cum),
    transitionCost: transition.cost,
    transitionNotes: transition.notes,
    score, scoreParts, agroforestryParts: agro.parts, badge: '', reasons: reasonsFor(picks, paybackYear, scoreParts, soil, transition.notes), warnings: warningsFor(picks, canopyShadeMature, agro.parts, soil, transition),
    sensitivity,
    soilHealth: soilHealthProxy(picks, climate, risk, soil),
  };
}

function reasonsFor(picks: LayerPick[], payback: number | null, scoreParts: SystemPlan['scoreParts'], soil: SoilContext | null, transitionNotes: string[]): string[] {
  const r: string[] = [];
  if (soil) r.push(`ดินจริง (${soil.source}): ${soil.texture} · pH ${soil.ph} · ${soil.drainageTh} · ความอุดมสมบูรณ์ ${soil.fertilityTh} · ใช้ปรับอันดับพืชตามการระบายน้ำ/ความเป็นกรด`);
  r.push(transitionNotes[0]);
  const canopy = picks.filter((p) => p.layer === 'canopy').map((p) => p.plant.nameTh).join(' + ');
  const layerCount = new Set(picks.map((p) => p.layer)).size;
  r.push(`โครงสร้าง ${layerCount} ชั้น (${picks.length} ชนิด): เรือนยอด ${canopy}` +
    picks.filter((p) => p.layer !== 'canopy').map((p) => ` · ${p.plant.nameTh}`).join(''));
  r.push(`คะแนนระบบวนเกษตร ${pct(scoreParts.agroforestry)} · เหมาะสมพืช ${pct(scoreParts.suitability)} · เศรษฐกิจ ${pct(scoreParts.economics)} · GISTDA risk ${pct(scoreParts.riskFit)}`);
  const shadeLover = picks.find((p) => p.layer !== 'canopy' && p.plant.shadeTol >= 0.55);
  if (shadeLover) r.push(`${shadeLover.plant.nameTh}ทนร่มเงา ปลูกใต้เรือนยอดได้ดีระยะยาว`);
  if (picks.some((p) => p.plant.nFixing)) r.push('มีพืชตระกูลถั่วคลุมดิน ตรึงไนโตรเจนบำรุงดินทั้งระบบ');
  if (picks.some((p) => p.plant.id === 'banana' || !p.plant.perennial)) r.push('มีชั้นที่ให้รายได้เร็วตั้งแต่ปีแรก ขณะรอไม้ยืนต้นโต');
  const farmer = picks.filter((p) => p.pickedBy === 'farmer');
  if (farmer.length) r.push(`นำพืชที่คุณเลือกเข้าแผนจริง ${farmer.length} ชนิด: ${farmer.map((p) => p.plant.nameTh).join(', ')}`);
  const modelTrees = picks.filter((p) => p.layer === 'canopy' && p.source === 'model');
  if (modelTrees.length) {
    const auc = modelTrees.map((p) => p.auc ?? 0).filter(Boolean);
    r.push(`ไม้ยืนต้นใช้ SDM ${modelTrees.length} ชนิด · AUC ${Math.min(...auc).toFixed(2)}-${Math.max(...auc).toFixed(2)} จาก GBIF + NASA POWER`);
  }
  if (payback) r.push(`คืนทุนประมาณปีที่ ${payback}`);
  return r;
}

function warningsFor(picks: LayerPick[], canopyShadeMature: number, agro: SystemPlan['agroforestryParts'], soil: SoilContext | null, transition?: ReturnType<typeof transitionContext>): string[] {
  const w: string[] = [];
  if (transition?.notes[1]) w.push(transition.notes[1]);
  for (const p of picks) {
    if (p.suitability < 0.45) w.push(`${p.plant.nameTh} เหมาะกับพื้นที่นี้ปานกลาง (${Math.round(p.suitability * 100)}%) · พิจารณาชนิดอื่นเสริม`);
    if (p.modelConfidence === 'low') w.push(`${p.plant.nameTh} มีข้อมูลโมเดลน้อย/ความแม่นยำต่ำ จึงใช้เกณฑ์พื้นที่แทนการจัดอันดับจาก SDM`);
    if (soil?.drainage === 'poor' && p.plant.water === 'low') w.push(`${p.plant.nameTh}ชอบดินระบายน้ำดี แต่ดินแปลงนี้ระบายน้ำช้า · ควรยกร่อง/พูนโคนหรือเลี่ยงพื้นที่ลุ่ม`);
  }
  if (soil?.acidity === 'strong') w.push(`ดินกรดจัด (pH ${soil.ph}) · ควรปรับ pH ด้วยปูนก่อนปลูกไม้ผลที่ไวต่อกรด`);
  // 0.4, not 0.35 — see SHADE_TOL_SUN_LOVER in lib/layout.ts. At 0.35 this test excluded
  // ถั่วลิสง (shadeTol exactly 0.35), so the warning missed the exact case the advisory
  // meeting raised: peanuts shaded out by teak.
  const sun = picks.find((p) => p.layer !== 'canopy' && p.plant.shadeTol < 0.4);
  if (sun && canopyShadeMature > 0.55) w.push(`${sun.plant.nameTh}ชอบแดด เมื่อเรือนยอดปิด ควรย้ายไปขอบแปลงหรือเปลี่ยนเป็นพืชทนร่มในปีท้ายๆ`);
  if (agro.strata < 0.9) w.push('โครงสร้างวนเกษตรยังไม่ครบชั้น ควรมีไม้ยืนต้นอย่างน้อย 2 ชนิดและพืชคลุมดิน/พืชหัวช่วยปิดหน้าดิน');
  if (agro.shade < 0.62) w.push('ความเข้ากันของร่มเงายังปานกลาง ควรจัดพืชชอบแดดไว้ขอบแปลงหรือใช้ชนิดทนร่มกว่าในระยะเรือนยอดปิด');
  if (agro.soilCover < 0.6) w.push('คะแนนคลุมดิน/บำรุงดินยังต่ำ ควรเพิ่มพืชคลุมดินหรือตระกูลถั่วเพื่อลดการชะล้าง');

  // Land-history warnings. At most one per prior use by construction (landHistory.ts keeps
  // a single `warning` per profile), because the meeting asked not to pile on complexity.
  const b = transition?.breakdown;
  if (b) {
    w.push(...b.warnings);
    if (b.flags.herbicideWatch) {
      w.push('ถ้าปีนี้ยังพ่นยาคุมหญ้าข้าวโพดอยู่ ให้เลื่อนพืชคลุมดินใบกว้างและถั่วออกไป 1 ฤดูฝน '
        + '· ไม้ยืนต้นและพืชหัวที่ปลูกลงหลุมไม่ได้รับผลกระทบ');
    }
    if (b.flags.standingRubber) {
      w.push('ยังไม่ต้องโค่นยางก็ได้ — ขิง ข่า ขมิ้น กล้วย สับปะรด ถั่วลิสง ปลูกแซมใต้สวนยางได้ '
        + '(กรมวิชาการเกษตร) · ตัวเลขต้นทุน/รายได้ในเอกสารนั้นเป็นของภาคใต้ ควรปรับตามราคาน่าน');
    }
  }
  return w;
}

export function buildSystems(input: FarmInput, climate: Climate | null, risk: ProtectedArea | null = null, soil: SoilContext | null = null): SystemPlan[] {
  const scored = scoreAll(climate, risk, soil);
  // Farmer-selected plants are forced into their layer later; do not inflate
  // suitability here, otherwise an out-of-elevation crop can look falsely safe.
  // candidate primary canopy species (suitable first), then build a grid of
  // candidate systems over primary × goal, and label 3 by their REAL metrics.
  const baseRank = [...scored.canopy].sort((a, b) => goalRank('balanced', b) - goalRank('balanced', a));
  // Only auto-nominate canopy species that actually produce income within the
  // 10-yr horizon; a timber tree like teak (first cut ~year 15) would otherwise
  // get picked as a "free" canopy that shades nothing and quietly zeroes its own
  // yield. Farmers can still force it in via selectedByLayer.
  const productive = baseRank.filter((s) => s.realized >= 0.2);
  const decent = productive.filter((s) => s.suit >= 0.38);
  const primaries: Scored[] = [];
  for (const s of [...decent, ...productive, ...baseRank]) { if (primaries.length >= 5) break; if (!primaries.some((p) => p.plant.id === s.plant.id)) primaries.push(s); }

  const cands: SystemPlan[] = [];
  for (const p of primaries) for (const g of ['balanced', 'fast', 'profit'] as Goal[]) cands.push(buildSystem(scored, input, g, p, climate, risk, soil));
  const sig = (s: SystemPlan) => s.picks.map((p) => p.plant.id).sort().join('|');

  // 3 distinct systems, strongest first
  const chosen: SystemPlan[] = [];
  for (const c of [...cands].sort((a, b) => b.score - a.score)) {
    if (chosen.length >= 3) break;
    if (!chosen.some((x) => sig(x) === sig(c))) chosen.push(c);
  }

  // Put the farmer's stated goal at the top. Until now input.goal was read nowhere in this
  // file — the wizard asked สมดุล / เห็นผลไว / กำไรสูงสุด in step 4 and the three plans came
  // back byte-identical whichever was chosen. The goal does not change WHICH plans are built
  // (they are still the three strongest, labelled by their real measured outcomes), only
  // which one leads and carries "แนะนำ" — so the answer stays honest while the question
  // stops being decorative.
  const goalKey = (s: SystemPlan): number => {
    if (input.goal === 'fast') return -(s.paybackYear ?? 99);
    if (input.goal === 'profit') return s.profit10;
    return s.score;
  };
  chosen.sort((a, b) => goalKey(b) - goalKey(a));

  // truthful comparative tags *among the 3 shown* (a plan may earn several)
  if (chosen.length) {
    const maxProfit = chosen.reduce((a, b) => (b.profit10 > a.profit10 ? b : a));
    const minPay = chosen.reduce((a, b) => ((b.paybackYear ?? 99) < (a.paybackYear ?? 99) ? b : a));
    const tags = new Map<SystemPlan, string[]>();
    chosen.forEach((c) => tags.set(c, []));
    tags.get(chosen[0])!.push('แนะนำ');
    tags.get(maxProfit)!.push('กำไรรวมสูงสุด');
    tags.get(minPay)!.push('คืนทุนเร็วสุด');
    chosen.forEach((c) => { c.badge = (tags.get(c)!.length ? tags.get(c)! : ['ทางเลือก']).join(' · '); });
  }
  return chosen;
}
