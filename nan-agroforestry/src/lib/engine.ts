import type { Plant, Layer, FarmInput, SystemPlan, LayerPick, CashflowPoint, Goal } from '../data/types';
import { PLANTS, co2Of } from '../data/plants';
import { disasterFeatureContext, plantSuitability } from './suitability';
import type { Climate } from './climate';
import type { ProtectedArea } from './gistda';
import { clamp, pct } from './format';

const HORIZON = 10;
// vertical land-share per layer (rai-equivalent of monoculture yield in the mixed stand)
const LAYER_SHARE: Record<Layer, number> = { canopy: 0.5, shrub: 0.3, groundcover: 0.4, root: 0.4 };
const MAX_VALUE = Math.max(...PLANTS.map((p) => p.pricePerKg * p.yieldKgPerRai * p.cyclesPerYear));
const MAX_CARBON = Math.max(...PLANTS.map((p) => co2Of(p.id)));

interface Scored {
  plant: Plant;
  suit: number;
  source: 'model' | 'envelope';
  auc?: number;
  confidence: 'high' | 'medium' | 'low' | 'expert';
  value: number;
  waterFit: number;
  riskFit: number;
  carbonFit: number;
}

function waterFit(p: Plant, climate: Climate | null, risk: ProtectedArea | null): number {
  const disaster = disasterFeatureContext(risk);
  if (!climate) return 0.7;
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

function scoreAll(climate: Climate | null, risk: ProtectedArea | null): Record<Layer, Scored[]> {
  const out = { canopy: [], shrub: [], groundcover: [], root: [] } as Record<Layer, Scored[]>;
  for (const p of PLANTS) {
    const s = plantSuitability(p, climate, risk);
    const water = waterFit(p, climate, risk);
    const riskScore = riskFit(p, climate, risk);
    const deploySuit = clamp((s.score * 0.68) + (water * 0.13) + (riskScore * 0.11) + ((co2Of(p.id) / MAX_CARBON) * 0.08), 0, 1);
    out[p.layer].push({
      plant: p,
      suit: deploySuit,
      source: s.source,
      auc: s.auc,
      confidence: s.confidence,
      value: (p.pricePerKg * p.yieldKgPerRai * p.cyclesPerYear) / MAX_VALUE,
      waterFit: water,
      riskFit: riskScore,
      carbonFit: co2Of(p.id) / MAX_CARBON,
    });
  }
  return out;
}

function goalRank(goal: Goal, s: Scored): number {
  const fast = s.plant.perennial ? clamp(1 - (s.plant.yearsToYield - 1) / 9, 0, 1) : 1;
  if (goal === 'fast') return 0.3 * s.suit + 0.32 * fast + 0.16 * s.value + 0.12 * s.waterFit + 0.1 * s.riskFit;
  if (goal === 'profit') return 0.24 * s.suit + 0.48 * s.value + 0.1 * s.waterFit + 0.1 * s.riskFit + 0.08 * s.carbonFit;
  return 0.36 * s.suit + 0.22 * s.value + 0.17 * s.waterFit + 0.13 * s.riskFit + 0.12 * s.carbonFit;
}

const selectedIds = (input: FarmInput, layer: Layer) => input.selectedByLayer?.[layer] ?? [];
const isFarmerPick = (input: FarmInput, id: string, layer: Layer) => selectedIds(input, layer).includes(id);

// per-plant 10-year net cashflow contribution
function plantFlow(p: Plant, shareRai: number, suit: number, understory: boolean, canopyShadeMature: number, canopyMatureYears: number): number[] {
  const net: number[] = [];
  for (let y = 1; y <= HORIZON; y++) {
    let ramp = 1;
    if (p.perennial) ramp = y >= p.yearsToYield ? clamp((y - p.yearsToYield) / Math.max(1, p.yearsToMature - p.yearsToYield), 0, 1) : 0;
    let fade = 1;
    if (understory && canopyShadeMature > 0) {
      const canopyNow = clamp(y / Math.max(1, canopyMatureYears), 0, 1) * canopyShadeMature;
      fade = clamp(1 - Math.max(0, canopyNow - p.shadeTol) * 1.3, 0, 1);
    }
    const active = ramp * fade;
    const revenue = p.yieldKgPerRai * p.pricePerKg * p.cyclesPerYear * shareRai * active * (0.4 + 0.6 * suit);
    let cost = 0;
    if (p.perennial) cost = (p.establishCostPerRai * (y === 1 ? 1 : 0) + p.annualCostPerRai) * shareRai;
    else if (active > 0.05) cost = (p.establishCostPerRai + p.annualCostPerRai) * shareRai;
    net.push(revenue - cost);
  }
  return net;
}

function buildSystem(scored: Record<Layer, Scored[]>, input: FarmInput, goal: Goal, forcedPrimary: Scored): SystemPlan {
  const sizeRai = input.sizeRai;
  const rank = (arr: Scored[]) => [...arr].sort((a, b) => goalRank(goal, b) - goalRank(goal, a));
  const canopyRanked = rank(scored.canopy);
  const primary = forcedPrimary;
  const selectedCanopy = selectedIds(input, 'canopy')
    .map((id) => canopyRanked.find((s) => s.plant.id === id))
    .filter(Boolean) as Scored[];
  const canopyPicks = [...selectedCanopy];
  if (!canopyPicks.some((s) => s.plant.id === primary.plant.id)) canopyPicks.unshift(primary);
  while (canopyPicks.length < 2) {
    const next = canopyRanked.find((s) => !canopyPicks.some((p) => p.plant.id === s.plant.id) && s.suit >= 0.38)
      ?? canopyRanked.find((s) => !canopyPicks.some((p) => p.plant.id === s.plant.id));
    if (!next) break;
    canopyPicks.push(next);
  }

  const pickLayer = (layer: Layer) => {
    const farmer = selectedIds(input, layer)
      .map((id) => scored[layer].find((s) => s.plant.id === id))
      .filter(Boolean) as Scored[];
    if (farmer.length) return farmer;
    const r = rank(scored[layer]).filter((s) => s.suit > 0.2);
    return [(r.length ? r : rank(scored[layer]))[0]].filter(Boolean);
  };
  const shrubs = pickLayer('shrub');
  const grounds = pickLayer('groundcover');
  const roots = pickLayer('root');

  // the canopy that casts the most shade governs when the understory gets shaded
  // (tiebreak: the one that closes its canopy soonest) — prevents a slow-maturing
  // timber tree from being gamed to keep the understory sunny for 10 years
  const dominant = [...canopyPicks].sort((a, b) => b.plant.canopyShade - a.plant.canopyShade || a.plant.yearsToMature - b.plant.yearsToMature)[0];
  const canopyShadeMature = dominant.plant.canopyShade;
  const canopyMatureYears = dominant.plant.yearsToMature;

  const picks: LayerPick[] = [];
  const flows: number[][] = [];
  const addPick = (s: Scored, layer: Layer, layerCount: number, understory: boolean) => {
    const share = LAYER_SHARE[layer] / Math.max(1, layerCount);
    const shareRai = sizeRai * share;
    picks.push({
      layer, plant: s.plant, suitability: s.suit, source: s.source, auc: s.auc, modelConfidence: s.confidence, shareRai,
      pickedBy: isFarmerPick(input, s.plant.id, layer) ? 'farmer' : 'system',
      scoreParts: {
        suitability: s.suit,
        economics: s.value,
        waterFit: s.waterFit,
        riskFit: s.riskFit,
        carbon: s.carbonFit,
      },
    });
    flows.push(plantFlow(s.plant, shareRai, s.suit, understory, understory ? canopyShadeMature : 0, canopyMatureYears));
  };
  canopyPicks.forEach((c) => addPick(c, 'canopy', canopyPicks.length, false));
  shrubs.forEach((s) => addPick(s, 'shrub', shrubs.length, true));
  grounds.forEach((s) => addPick(s, 'groundcover', grounds.length, true));
  roots.forEach((s) => addPick(s, 'root', roots.length, true));

  // combine cashflow
  const cashflow: CashflowPoint[] = [];
  let cum = 0;
  for (let y = 0; y < HORIZON; y++) {
    const net = flows.reduce((s, f) => s + f[y], 0);
    cum += net;
    cashflow.push({ year: y + 1, income: 0, cost: 0, net: Math.round(net), cumulative: Math.round(cum) });
  }
  let paybackYear: number | null = null;
  for (const c of cashflow) if (c.cumulative >= 0) { paybackYear = c.year; break; }

  // carbon sequestration (woody layers store carbon as they grow)
  let carbonPerYear = 0, carbon10 = 0;
  for (const pk of picks) {
    const co2 = co2Of(pk.plant.id) * pk.shareRai;
    carbonPerYear += co2;
    for (let y = 1; y <= HORIZON; y++) {
      const grow = pk.plant.perennial ? clamp(y / pk.plant.yearsToMature, 0, 1) : 1;
      carbon10 += co2 * grow;
    }
  }

  const suitability = picks.reduce((s, p) => s + p.suitability, 0) / picks.length;
  const economics = clamp(cum / 8_000_000, 0, 1);
  const water = picks.reduce((s, p) => s + p.scoreParts.waterFit, 0) / picks.length;
  const disaster = picks.reduce((s, p) => s + p.scoreParts.riskFit, 0) / picks.length;
  const carbonScore = clamp(carbon10 / Math.max(1, sizeRai * 42), 0, 1);
  const farmerTotal = Object.values(input.selectedByLayer ?? {}).reduce((s, ids) => s + ids.length, 0);
  const farmerUsed = picks.filter((p) => p.pickedBy === 'farmer').length;
  const farmerFit = farmerTotal ? farmerUsed / farmerTotal : 0.72;
  const agro = agroforestryFit(picks, cashflow, canopyShadeMature);
  const scoreParts = { agroforestry: agro.score, suitability, economics, waterFit: water, riskFit: disaster, carbon: carbonScore, farmerFit };
  const score = scoreParts.agroforestry * 0.22 + scoreParts.suitability * 0.26 + scoreParts.economics * 0.18 + scoreParts.waterFit * 0.1 + scoreParts.riskFit * 0.11 + scoreParts.carbon * 0.08 + scoreParts.farmerFit * 0.05;

  return {
    picks, canopy: picks.filter((p) => p.layer === 'canopy'),
    cashflow, paybackYear, profit10: Math.round(cum), annualAvg: Math.round(cum / HORIZON),
    suitability, carbonPerYear: Math.round(carbonPerYear * 10) / 10, carbon10: Math.round(carbon10),
    score, scoreParts, agroforestryParts: agro.parts, badge: '', reasons: reasonsFor(picks, paybackYear, scoreParts), warnings: warningsFor(picks, canopyShadeMature, agro.parts),
  };
}

function reasonsFor(picks: LayerPick[], payback: number | null, scoreParts: SystemPlan['scoreParts']): string[] {
  const r: string[] = [];
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

function warningsFor(picks: LayerPick[], canopyShadeMature: number, agro: SystemPlan['agroforestryParts']): string[] {
  const w: string[] = [];
  for (const p of picks) {
    if (p.suitability < 0.45) w.push(`${p.plant.nameTh} เหมาะกับพื้นที่นี้ปานกลาง (${Math.round(p.suitability * 100)}%) — พิจารณาชนิดอื่นเสริม`);
    if (p.modelConfidence === 'low') w.push(`${p.plant.nameTh} มีข้อมูลโมเดลน้อย/ความแม่นยำต่ำ จึงใช้เกณฑ์พื้นที่แทนการจัดอันดับจาก SDM`);
  }
  const sun = picks.find((p) => p.layer !== 'canopy' && p.plant.shadeTol < 0.35);
  if (sun && canopyShadeMature > 0.55) w.push(`${sun.plant.nameTh}ชอบแดด เมื่อเรือนยอดปิด ควรย้ายไปขอบแปลงหรือเปลี่ยนเป็นพืชทนร่มในปีท้ายๆ`);
  if (agro.strata < 0.9) w.push('โครงสร้างวนเกษตรยังไม่ครบชั้น ควรมีไม้ยืนต้นอย่างน้อย 2 ชนิดและพืชคลุมดิน/พืชหัวช่วยปิดหน้าดิน');
  if (agro.shade < 0.62) w.push('ความเข้ากันของร่มเงายังปานกลาง ควรจัดพืชชอบแดดไว้ขอบแปลงหรือใช้ชนิดทนร่มกว่าในระยะเรือนยอดปิด');
  if (agro.soilCover < 0.6) w.push('คะแนนคลุมดิน/บำรุงดินยังต่ำ ควรเพิ่มพืชคลุมดินหรือตระกูลถั่วเพื่อลดการชะล้าง');
  return w;
}

export function buildSystems(input: FarmInput, climate: Climate | null, risk: ProtectedArea | null = null): SystemPlan[] {
  const scored = scoreAll(climate, risk);
  // honour farmer preferences in every stratum while still keeping suitability visible.
  for (const layer of Object.keys(scored) as Layer[]) {
    const ids = selectedIds(input, layer);
    if (ids.length) scored[layer].forEach((s) => { if (ids.includes(s.plant.id)) s.suit = Math.min(1, s.suit + 0.18); });
  }
  // candidate primary canopy species (suitable first), then build a grid of
  // candidate systems over primary × goal, and label 3 by their REAL metrics.
  const baseRank = [...scored.canopy].sort((a, b) => goalRank('balanced', b) - goalRank('balanced', a));
  const decent = baseRank.filter((s) => s.suit >= 0.38);
  const primaries: Scored[] = [];
  for (const s of [...decent, ...baseRank]) { if (primaries.length >= 5) break; if (!primaries.some((p) => p.plant.id === s.plant.id)) primaries.push(s); }

  const cands: SystemPlan[] = [];
  for (const p of primaries) for (const g of ['balanced', 'fast', 'profit'] as Goal[]) cands.push(buildSystem(scored, input, g, p));
  const sig = (s: SystemPlan) => s.picks.map((p) => p.plant.id).sort().join('|');

  // 3 distinct systems, strongest first
  const chosen: SystemPlan[] = [];
  for (const c of [...cands].sort((a, b) => b.score - a.score)) {
    if (chosen.length >= 3) break;
    if (!chosen.some((x) => sig(x) === sig(c))) chosen.push(c);
  }

  // truthful comparative tags *among the 3 shown* (a plan may earn several)
  if (chosen.length) {
    const maxProfit = chosen.reduce((a, b) => (b.profit10 > a.profit10 ? b : a));
    const minPay = chosen.reduce((a, b) => ((b.paybackYear ?? 99) < (a.paybackYear ?? 99) ? b : a));
    const tags = new Map<SystemPlan, string[]>();
    chosen.forEach((c) => tags.set(c, []));
    tags.get(chosen[0])!.push('⭐ แนะนำ');
    tags.get(maxProfit)!.push('💰 กำไรรวมสูงสุด');
    tags.get(minPay)!.push('⚡ คืนทุนเร็วสุด');
    chosen.forEach((c) => { c.badge = (tags.get(c)!.length ? tags.get(c)! : ['ทางเลือก']).join(' · '); });
  }
  return chosen;
}
