import nanSoilGroup from '../data/ldd/nan_soilgroup.json';
import type { Acidity, Drainage } from './soil';

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

interface SoilGroupFeature {
  type: 'Feature';
  properties: {
    soilgroup?: string;
    tex_top?: string;
    tex_low?: string;
    pH_top?: string;
    pH_low?: string;
    fer_top?: string;
    amphoe_t?: string;
    tam_nam_t?: string;
    prov_nam_t?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: Polygon | MultiPolygon;
  } | null;
}

interface SoilGroupCollection {
  type: 'FeatureCollection';
  features: SoilGroupFeature[];
}

export interface LddSoilGroupContext {
  soilGroup: string;
  soilGroupLabel: string;
  textureTopCode: string;
  textureTopTh: string;
  textureLowCode: string;
  textureLowTh: string;
  phTopRange: string;
  phLowRange: string;
  phEstimate: number | null;
  acidity: Acidity;
  acidityTh: string;
  fertilityCode: string;
  fertilityTh: string;
  fertility: number;
  drainage: Drainage;
  drainageTh: string;
  limitations: string[];
  tambon?: string;
  amphoe?: string;
  province?: string;
  source: string;
  scale: string;
}

const data = nanSoilGroup as SoilGroupCollection;

const TEXTURE_TH: Record<string, string> = {
  c: 'ดินเหนียว',
  cl: 'ดินร่วนเหนียว',
  gcl: 'ดินร่วนเหนียวปนกรวด',
  gsl: 'ดินร่วนปนทรายปนกรวด',
  l: 'ดินร่วน',
  ls: 'ดินทรายปนร่วน',
  scl: 'ดินร่วนเหนียวปนทราย',
  sic: 'ดินเหนียวปนทรายแป้ง',
  sicl: 'ดินร่วนเหนียวปนทรายแป้ง',
  sil: 'ดินร่วนปนทรายแป้ง',
  sl: 'ดินร่วนปนทราย',
  vgc: 'ดินเหนียวปนกรวดมาก',
  vgscl: 'ดินร่วนเหนียวปนทรายและกรวดมาก',
  vgsl: 'ดินร่วนปนทรายและกรวดมาก',
  zSC: 'พื้นที่ลาดชันเชิงซ้อน',
  zW: 'พื้นที่น้ำ',
  Cr: 'ชั้นหินผุ',
  R: 'ชั้นหินแข็ง',
};

function textureLabel(code = '') {
  if (!code) return 'ไม่ระบุ';
  return code.split('/').map((part) => TEXTURE_TH[part] ?? part).join(' / ');
}

function fertility(code = '') {
  if (code === 'L') return { th: 'ต่ำ', score: 0.35 };
  if (code === 'M') return { th: 'ปานกลาง', score: 0.55 };
  if (code === 'H') return { th: 'ดี', score: 0.75 };
  return { th: 'ไม่ระบุ', score: 0.48 };
}

function phMid(range = '') {
  const nums = range.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  if (nums.length === 1) return nums[0];
  return null;
}

function acidityFromPh(ph: number | null): { acidity: Acidity; acidityTh: string } {
  if (ph == null) return { acidity: 'slight', acidityTh: 'ไม่ระบุ pH ชัดเจน' };
  if (ph < 5.0) return { acidity: 'strong', acidityTh: 'กรดจัด' };
  if (ph < 5.5) return { acidity: 'moderate', acidityTh: 'กรดปานกลาง' };
  if (ph < 6.6) return { acidity: 'slight', acidityTh: 'กรดเล็กน้อย' };
  return { acidity: 'neutral', acidityTh: 'เป็นกลาง/ด่าง' };
}

function drainageFromTexture(code = '', soilGroup = ''): { drainage: Drainage; drainageTh: string } {
  if (code.includes('zW')) return { drainage: 'poor', drainageTh: 'พื้นที่น้ำ/เสี่ยงแฉะ' };
  if (code.includes('zSC') || soilGroup === '62') return { drainage: 'good', drainageTh: 'พื้นที่ลาดชัน ระบายน้ำเร็ว เสี่ยงชะล้าง' };
  if (/(vg|g|sl|ls)/.test(code)) return { drainage: 'good', drainageTh: 'ระบายน้ำค่อนข้างเร็ว' };
  if (/(c|cl|sicl|sic)/.test(code)) return { drainage: 'moderate', drainageTh: 'ระบายน้ำปานกลางถึงช้า' };
  return { drainage: 'moderate', drainageTh: 'ระบายน้ำปานกลาง' };
}

function bboxOfGeometry(geometry: SoilGroupFeature['geometry']) {
  if (!geometry) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates as Polygon]
    : geometry.coordinates as MultiPolygon;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return [minX, minY, maxX, maxY] as const;
}

function pointInRing(point: Position, ring: Ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Position, polygon: Polygon) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function pointInGeometry(point: Position, geometry: SoilGroupFeature['geometry']) {
  if (!geometry) return false;
  const bbox = bboxOfGeometry(geometry);
  if (!bbox) return false;
  const [x, y] = point;
  if (x < bbox[0] || x > bbox[2] || y < bbox[1] || y > bbox[3]) return false;
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates as Polygon]
    : geometry.coordinates as MultiPolygon;
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function limitations(props: SoilGroupFeature['properties'], drainageTh: string, acidityTh: string) {
  const out: string[] = [];
  const group = props.soilgroup ?? '';
  const top = props.tex_top ?? '';
  if (group === '62' || top.includes('zSC')) out.push('พื้นที่ลาดชันเชิงซ้อน ต้องเน้นคลุมดิน ทำแนวชะลอน้ำ และลดการไถเปิดหน้าดิน');
  if (top.includes('zW')) out.push('พื้นที่น้ำ/พื้นที่ชุ่มน้ำ ไม่ควรออกแบบเป็นแปลงปลูกทั่วไป');
  if (drainageTh.includes('เร็ว')) out.push('ดินระบายน้ำเร็ว ควรเพิ่มอินทรียวัตถุและคลุมดินเพื่อลดแห้งแล้ง');
  if (acidityTh.includes('กรด')) out.push('ดินเป็นกรด ควรตรวจ pH ภาคสนามก่อนปลูกไม้ผลที่ไวต่อกรด');
  return out;
}

function toContext(feature: SoilGroupFeature): LddSoilGroupContext {
  const props = feature.properties;
  const group = props.soilgroup ?? 'ไม่ระบุ';
  const ph = phMid(props.pH_top);
  const acid = acidityFromPh(ph);
  const fert = fertility(props.fer_top);
  const drain = drainageFromTexture(props.tex_top, group);
  return {
    soilGroup: group,
    soilGroupLabel: group.startsWith('z') ? group : `กลุ่มชุดดิน ${group}`,
    textureTopCode: props.tex_top ?? '',
    textureTopTh: textureLabel(props.tex_top),
    textureLowCode: props.tex_low ?? '',
    textureLowTh: textureLabel(props.tex_low),
    phTopRange: props.pH_top ?? 'ไม่ระบุ',
    phLowRange: props.pH_low ?? 'ไม่ระบุ',
    phEstimate: ph,
    ...acid,
    fertilityCode: props.fer_top ?? '',
    fertilityTh: fert.th,
    fertility: fert.score,
    ...drain,
    limitations: limitations(props, drain.drainageTh, acid.acidityTh),
    tambon: props.tam_nam_t,
    amphoe: props.amphoe_t,
    province: props.prov_nam_t,
    source: 'LDD กลุ่มชุดดิน จ.น่าน 1:25,000',
    scale: '1:25,000',
  };
}

export function lookupLddSoilGroup(lat: number, lng: number): LddSoilGroupContext | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const point: Position = [lng, lat];
  const feature = data.features.find((f) => pointInGeometry(point, f.geometry));
  return feature ? toContext(feature) : null;
}
