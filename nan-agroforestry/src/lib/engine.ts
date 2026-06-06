import type { Plant, Layer, FarmInput, SystemPlan, LayerPick, CashflowPoint, Goal } from '../data/types';
import { PLANTS, co2Of } from '../data/plants';
import { plantSuitability } from './suitability';
import type { Climate } from './climate';
import { clamp } from './format';

const HORIZON = 10;
// vertical land-share per layer (rai-equivalent of monoculture yield in the mixed stand)
const LAYER_SHARE: Record<Layer, number> = { canopy: 0.5, shrub: 0.3, groundcover: 0.4, root: 0.4 };

interface Scored { plant: Plant; suit: number; source: 'model' | 'envelope'; auc?: number; value: number }

function scoreAll(climate: Climate | null): Record<Layer, Scored[]> {
  const maxValue = Math.max(...PLANTS.map((p) => p.pricePerKg * p.yieldKgPerRai));
  const out = { canopy: [], shrub: [], groundcover: [], root: [] } as Record<Layer, Scored[]>;
  for (const p of PLANTS) {
    const s = plantSuitability(p, climate);
    out[p.layer].push({ plant: p, suit: s.score, source: s.source, auc: s.auc, value: (p.pricePerKg * p.yieldKgPerRai) / maxValue });
  }
  return out;
}

function goalRank(goal: Goal, s: Scored): number {
  const fast = s.plant.perennial ? clamp(1 - (s.plant.yearsToYield - 1) / 9, 0, 1) : 1;
  if (goal === 'fast') return 0.45 * s.suit + 0.35 * fast + 0.2 * s.value;
  if (goal === 'profit') return 0.32 * s.suit + 0.68 * s.value;
  return 0.55 * s.suit + 0.45 * s.value;
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
      layer, plant: s.plant, suitability: s.suit, source: s.source, auc: s.auc, shareRai,
      pickedBy: isFarmerPick(input, s.plant.id, layer) ? 'farmer' : 'system',
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
  const score = suitability * 0.45 + clamp(cum / 8_000_000, 0, 1) * 0.35 + goalRank(goal, primary) * 0.2;

  return {
    picks, canopy: picks.filter((p) => p.layer === 'canopy'),
    cashflow, paybackYear, profit10: Math.round(cum), annualAvg: Math.round(cum / HORIZON),
    suitability, carbonPerYear: Math.round(carbonPerYear * 10) / 10, carbon10: Math.round(carbon10),
    score, badge: '', reasons: reasonsFor(picks, paybackYear), warnings: warningsFor(picks, canopyShadeMature),
  };
}

function reasonsFor(picks: LayerPick[], payback: number | null): string[] {
  const r: string[] = [];
  const canopy = picks.filter((p) => p.layer === 'canopy').map((p) => p.plant.nameTh).join(' + ');
  const layerCount = new Set(picks.map((p) => p.layer)).size;
  r.push(`โครงสร้าง ${layerCount} ชั้น (${picks.length} ชนิด): เรือนยอด ${canopy}` +
    picks.filter((p) => p.layer !== 'canopy').map((p) => ` · ${p.plant.nameTh}`).join(''));
  const shadeLover = picks.find((p) => p.layer !== 'canopy' && p.plant.shadeTol >= 0.55);
  if (shadeLover) r.push(`${shadeLover.plant.nameTh}ทนร่มเงา ปลูกใต้เรือนยอดได้ดีระยะยาว`);
  if (picks.some((p) => p.plant.nFixing)) r.push('มีพืชตระกูลถั่วคลุมดิน ตรึงไนโตรเจนบำรุงดินทั้งระบบ');
  if (picks.some((p) => p.plant.id === 'banana' || !p.plant.perennial)) r.push('มีชั้นที่ให้รายได้เร็วตั้งแต่ปีแรก ขณะรอไม้ยืนต้นโต');
  const farmer = picks.filter((p) => p.pickedBy === 'farmer');
  if (farmer.length) r.push(`นำพืชที่คุณเลือกเข้าแผนจริง ${farmer.length} ชนิด: ${farmer.map((p) => p.plant.nameTh).join(', ')}`);
  const modelTrees = picks.filter((p) => p.layer === 'canopy' && p.source === 'model');
  if (modelTrees.length) r.push(`ความเหมาะสมไม้ยืนต้นจากโมเดล SDM (ฝึกด้วยข้อมูลจริง GBIF + NASA)`);
  if (payback) r.push(`คืนทุนประมาณปีที่ ${payback}`);
  return r;
}

function warningsFor(picks: LayerPick[], canopyShadeMature: number): string[] {
  const w: string[] = [];
  for (const p of picks) {
    if (p.suitability < 0.45) w.push(`${p.plant.nameTh} เหมาะกับพื้นที่นี้ปานกลาง (${Math.round(p.suitability * 100)}%) — พิจารณาชนิดอื่นเสริม`);
  }
  const sun = picks.find((p) => p.layer !== 'canopy' && p.plant.shadeTol < 0.35);
  if (sun && canopyShadeMature > 0.55) w.push(`${sun.plant.nameTh}ชอบแดด เมื่อเรือนยอดปิด ควรย้ายไปขอบแปลงหรือเปลี่ยนเป็นพืชทนร่มในปีท้ายๆ`);
  return w;
}

export function buildSystems(input: FarmInput, climate: Climate | null): SystemPlan[] {
  const scored = scoreAll(climate);
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
