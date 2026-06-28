// Real plot soil context from SoilGrids (ISRIC, 250 m global grid).
// This was impossible in the old Vite build (SoilGrids blocks browser CORS), but
// the Next.js server can fetch it freely — so soil is back as a real agronomic layer.
// It is NOT fed into the trained SDM (that needs a retrain); it acts as an
// expert-style guardrail/adjustment on top of the model, like the elevation cap.
import { clamp } from './format';

const SOILGRIDS = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
// rooting-zone topsoil; both depths are averaged for a single agronomic read
const DEPTHS = ['0-5cm', '5-15cm'];
const PROPS = ['phh2o', 'soc', 'nitrogen', 'sand', 'silt', 'clay', 'cec'] as const;

export type Drainage = 'poor' | 'moderate' | 'good';
export type Acidity = 'strong' | 'moderate' | 'slight' | 'neutral';

export interface SoilContext {
  ph: number;               // 0..14
  organicCarbonPct: number; // %
  nitrogenPct: number;      // %
  clayPct: number;
  sandPct: number;
  siltPct: number;
  cec: number;              // mmol(c)/kg
  texture: string;          // Thai label
  textureEn: string;
  drainage: Drainage;
  drainageTh: string;
  acidity: Acidity;
  acidityTh: string;
  fertility: number;        // 0..1 derived
  fertilityTh: string;
  depthLabel: string;
  source: string;
}

// SoilGrids returns integers in "mapped units"; divide to reach physical units.
const TO_PHYSICAL: Record<string, (v: number) => number> = {
  phh2o: (v) => v / 10,    // pH*10 → pH
  soc: (v) => v / 100,     // dg/kg → %
  nitrogen: (v) => v / 1000, // cg/kg → %
  sand: (v) => v / 10,     // g/kg → %
  silt: (v) => v / 10,
  clay: (v) => v / 10,
  cec: (v) => v,           // mmol(c)/kg
};

const tfetch = (url: string, ms = 12000) =>
  fetch(url, { signal: AbortSignal.timeout(ms), next: { revalidate: 60 * 60 * 24 * 30 } });

// Simplified USDA texture triangle (covers the classes that occur in Nan).
function classifyTexture(sand: number, silt: number, clay: number): { en: string; th: string } {
  if (clay >= 40) {
    if (silt >= 40) return { en: 'silty clay', th: 'ดินเหนียวปนทรายแป้ง' };
    if (sand >= 45) return { en: 'sandy clay', th: 'ดินเหนียวปนทราย' };
    return { en: 'clay', th: 'ดินเหนียว' };
  }
  if (clay >= 27) {
    if (sand >= 45) return { en: 'sandy clay loam', th: 'ดินร่วนเหนียวปนทราย' };
    if (sand <= 20) return { en: 'silty clay loam', th: 'ดินร่วนเหนียวปนทรายแป้ง' };
    return { en: 'clay loam', th: 'ดินร่วนเหนียว' };
  }
  if (silt >= 80 && clay < 12) return { en: 'silt', th: 'ดินทรายแป้ง' };
  if (silt >= 50 && clay < 27) return { en: 'silt loam', th: 'ดินร่วนปนทรายแป้ง' };
  if (clay >= 7 && sand <= 52 && silt >= 28) return { en: 'loam', th: 'ดินร่วน' };
  if (sand >= 85) return { en: 'sand', th: 'ดินทราย' };
  if (sand >= 70) return { en: 'loamy sand', th: 'ดินทรายปนร่วน' };
  return { en: 'sandy loam', th: 'ดินร่วนปนทราย' };
}

function classifyDrainage(sand: number, clay: number): { d: Drainage; th: string } {
  if (clay >= 35) return { d: 'poor', th: 'ระบายน้ำช้า (เสี่ยงแฉะ)' };
  if (sand >= 65) return { d: 'good', th: 'ระบายน้ำเร็ว (แห้งง่าย)' };
  if (clay >= 27) return { d: 'moderate', th: 'ระบายน้ำปานกลาง' };
  return { d: 'good', th: 'ระบายน้ำดี' };
}

function classifyAcidity(ph: number): { a: Acidity; th: string } {
  if (ph < 5.0) return { a: 'strong', th: 'กรดจัด' };
  if (ph < 5.5) return { a: 'moderate', th: 'กรดปานกลาง' };
  if (ph < 6.6) return { a: 'slight', th: 'กรดเล็กน้อย' };
  return { a: 'neutral', th: 'เป็นกลาง/ด่าง' };
}

function fertilityScore(ocPct: number, cec: number, ph: number) {
  const oc = clamp(ocPct / 3, 0, 1);        // ~3% organic carbon = excellent
  const c = clamp(cec / 250, 0, 1);          // CEC 250 mmol(c)/kg = high
  const p = clamp(1 - Math.abs(ph - 6.3) / 2, 0, 1); // ideal pH ≈ 6.3
  return clamp(oc * 0.45 + c * 0.3 + p * 0.25, 0, 1);
}

export async function fetchSoil(lat: number, lng: number): Promise<SoilContext | null> {
  const url = new URL(SOILGRIDS);
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('lat', String(lat));
  PROPS.forEach((p) => url.searchParams.append('property', p));
  DEPTHS.forEach((d) => url.searchParams.append('depth', d));
  url.searchParams.set('value', 'mean');

  let body: any;
  try {
    const res = await tfetch(url.toString());
    if (!res.ok) return null;
    body = await res.json();
  } catch {
    return null;
  }

  const layers: any[] = body?.properties?.layers ?? [];
  const physical: Partial<Record<string, number>> = {};
  for (const layer of layers) {
    const name: string = layer?.name;
    const conv = TO_PHYSICAL[name];
    if (!conv) continue;
    const means = (layer?.depths ?? [])
      .map((d: any) => d?.values?.mean)
      .filter((v: any) => typeof v === 'number');
    if (!means.length) continue;
    const avg = means.reduce((a: number, b: number) => a + b, 0) / means.length;
    physical[name] = conv(avg);
  }

  const ph = physical.phh2o;
  const sand = physical.sand;
  const silt = physical.silt;
  const clay = physical.clay;
  if (ph == null || sand == null || silt == null || clay == null) return null;

  const ocPct = physical.soc ?? 0;
  const cec = physical.cec ?? 0;
  const texture = classifyTexture(sand, silt, clay);
  const drainage = classifyDrainage(sand, clay);
  const acidity = classifyAcidity(ph);
  const fertility = fertilityScore(ocPct, cec, ph);

  return {
    ph: Math.round(ph * 10) / 10,
    organicCarbonPct: Math.round(ocPct * 100) / 100,
    nitrogenPct: Math.round((physical.nitrogen ?? 0) * 1000) / 1000,
    clayPct: Math.round(clay),
    sandPct: Math.round(sand),
    siltPct: Math.round(silt),
    cec: Math.round(cec),
    texture: texture.th,
    textureEn: texture.en,
    drainage: drainage.d,
    drainageTh: drainage.th,
    acidity: acidity.a,
    acidityTh: acidity.th,
    fertility: Math.round(fertility * 100) / 100,
    fertilityTh: fertility >= 0.66 ? 'ดี' : fertility >= 0.45 ? 'ปานกลาง' : 'ต่ำ',
    depthLabel: '0–15 ซม. (เฉลี่ย)',
    source: 'SoilGrids (ISRIC) 250 m',
  };
}
