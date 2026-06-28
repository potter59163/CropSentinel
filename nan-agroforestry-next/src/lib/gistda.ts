// GISTDA — real natural-resource layers (public ArcGIS REST, CORS-enabled).
// Service: "ข้อมูลทรัพยากรธรรมชาติ" — national park & wildlife-sanctuary boundaries.
// We ask: is the farmer's plot inside / near a protected forest? This drives both
// legality (you may not clear/plant inside a park) and restoration value (agroforestry
// in the buffer zone protects the forest edge).
import { fetchGistdaDisaster } from './gistdaDisaster';

const BASE =
  'https://gistdaportal.gistda.or.th/arcgis/rest/services/' +
  encodeURIComponent('ข้อมูลทรัพยากรธรรมชาติ') +
  '/MapServer';

const LAYERS = [
  { id: 1, type: 'อุทยานแห่งชาติ' },
  { id: 2, type: 'เขตรักษาพันธุ์สัตว์ป่า' },
];

const RIVER_LAYER_ID = 0;
const RIVER_DISTANCES_M = [100, 250, 500, 1000, 3000];

export interface ProtectedArea {
  inside: boolean;
  near: boolean;
  type?: string;
  name?: string;
  changwat?: string;
  riverNear: boolean;
  riverDistanceM?: number;
  riverOrder?: number;
  riverTambon?: string;
  riverAmphoe?: string;
  fireHotspots: number;
  fireNearby: number;
  fireProtected: number;
  fireMaxConfidence?: number;
  fireDate?: number;
  disasterStatus?: 'live' | 'missing-key' | 'unavailable' | 'bad-request';
  disasterSource?: string;
  disasterUpdatedAt?: string;
  disasterRadiusKm?: number;
  disasterFire7dNan?: number;
  disasterFire7dNear?: number;
  disasterBurnScarNear?: number;
  disasterBurnFreqNear?: number;
  disasterFlood7dNan?: number;
  disasterFlood7dNear?: number;
  disasterFloodFreqNear?: number;
  disasterDroughtLayers?: string[];
  disasterWarnings?: string[];
  source: string;
}
type DisasterStatus = NonNullable<ProtectedArea['disasterStatus']>;

const attr = (a: Record<string, any>, key: string) => a[key] ?? a[key.toLowerCase()] ?? a[key.toUpperCase()];

async function queryLayer(id: number, lat: number, lng: number, distance = 0, outFields = 'DESC_TH,CHANGWAT_T,Area_rai'): Promise<any[]> {
  const p = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'false',
    f: 'json',
  });
  if (distance) { p.set('distance', String(distance)); p.set('units', 'esriSRUnit_Meter'); }
  const r = await fetch(`${BASE}/${id}/query?${p}`, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`GISTDA HTTP ${r.status}`);
  return (await r.json()).features ?? [];
}

async function checkRiver(lat: number, lng: number) {
  for (const distance of RIVER_DISTANCES_M) {
    const f = await queryLayer(RIVER_LAYER_ID, lat, lng, distance, 'STR_ORDER,TAMBON_T,AMPHOE_T,CHANGWAT_T');
    if (f.length) {
      const a = f[0].attributes ?? {};
      return {
        riverNear: true,
        riverDistanceM: distance,
        riverOrder: Number(attr(a, 'STR_ORDER')) || undefined,
        riverTambon: attr(a, 'TAMBON_T'),
        riverAmphoe: attr(a, 'AMPHOE_T'),
      };
    }
  }
  return { riverNear: false };
}

async function queryFire(service: string, params: Record<string, string>): Promise<any[]> {
  const p = new URLSearchParams({
    f: 'json',
    returnGeometry: 'false',
    outFields: '*',
    ...params,
  });
  const r = await fetch(`https://gistdaportal.gistda.or.th/data/rest/services/${service}/MapServer/0/query?${p}`, {
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error(`GISTDA fire HTTP ${r.status}`);
  return (await r.json()).features ?? [];
}

async function checkFire(lat: number, lng: number) {
  const [modis, nppNearby] = await Promise.all([
    queryFire('FR_Fire/hotspot_daily', { where: "pv_tn='น่าน'" }).catch(() => []),
    queryFire('FR_Fire/hotspot_npp_daily', {
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '50000',
      units: 'esriSRUnit_Meter',
    }).catch(() => []),
  ]);
  const attrs = [...modis, ...nppNearby].map((f) => f.attributes ?? {});
  const confidence = attrs
    .map((a) => Number(attr(a, 'confident')))
    .filter((v) => Number.isFinite(v));
  const dates = attrs
    .map((a) => Number(attr(a, 'datetime') ?? attr(a, 'date')))
    .filter((v) => Number.isFinite(v));
  return {
    fireHotspots: modis.length,
    fireNearby: nppNearby.length,
    fireProtected: attrs.filter((a) => String(attr(a, 'lu_name') ?? '').includes('ป่า')).length,
    fireMaxConfidence: confidence.length ? Math.max(...confidence) : undefined,
    fireDate: dates.length ? Math.max(...dates) : undefined,
  };
}

async function checkDisaster(lat: number, lng: number) {
  if (typeof window === 'undefined') {
    const body = await fetchGistdaDisaster(lat, lng, 25);
    return normalizeDisaster(body);
  }
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: '25',
  });
  const r = await fetch(`/api/gistda-disaster?${params}`, { signal: AbortSignal.timeout(14000) });
  if (!r.ok) throw new Error(`GISTDA Disaster proxy HTTP ${r.status}`);
  const body = await r.json();
  return normalizeDisaster(body);
}

function normalizeDisaster(body: any) {
  const status = ['live', 'missing-key', 'unavailable', 'bad-request'].includes(body.status)
    ? body.status as DisasterStatus
    : 'unavailable';
  return {
    disasterStatus: status,
    disasterSource: body.source,
    disasterUpdatedAt: body.updatedAt,
    disasterRadiusKm: body.radiusKm,
    disasterFire7dNan: Number(body.fire?.hotspots7dNan ?? 0),
    disasterFire7dNear: Number(body.fire?.hotspots7dNearby ?? 0),
    disasterBurnScarNear: Number(body.fire?.burnScarNearby ?? 0),
    disasterBurnFreqNear: Number(body.fire?.burnFreqNearby ?? 0),
    disasterFlood7dNan: Number(body.flood?.flood7dNan ?? 0),
    disasterFlood7dNear: Number(body.flood?.flood7dNearby ?? 0),
    disasterFloodFreqNear: Number(body.flood?.floodFreqNearby ?? 0),
    disasterDroughtLayers: Array.isArray(body.drought?.availableLayers) ? body.drought.availableLayers : [],
    disasterWarnings: Array.isArray(body.warnings) ? body.warnings : [],
  };
}

export async function checkProtected(lat: number, lng: number): Promise<ProtectedArea> {
  const src = 'GISTDA · ข้อมูลทรัพยากรธรรมชาติ';
  const [river, fire, disaster] = await Promise.all([
    checkRiver(lat, lng).catch(() => ({ riverNear: false })),
    checkFire(lat, lng).catch(() => ({ fireHotspots: 0, fireNearby: 0, fireProtected: 0 })),
    checkDisaster(lat, lng).catch(() => ({
      disasterStatus: 'unavailable' as DisasterStatus,
      disasterFire7dNan: 0,
      disasterFire7dNear: 0,
      disasterBurnScarNear: 0,
      disasterBurnFreqNear: 0,
      disasterFlood7dNan: 0,
      disasterFlood7dNear: 0,
      disasterFloodFreqNear: 0,
      disasterDroughtLayers: [],
      disasterWarnings: [],
    })),
  ]);

  // inside a protected area?
  for (const L of LAYERS) {
    const f = await queryLayer(L.id, lat, lng);
    if (f.length) {
      const a = f[0].attributes ?? {};
      return {
        inside: true, near: true, type: L.type, name: attr(a, 'DESC_TH'), changwat: attr(a, 'CHANGWAT_T'),
        ...river, ...fire, ...disaster, source: src,
      };
    }
  }
  // within ~3 km of one?
  for (const L of LAYERS) {
    const f = await queryLayer(L.id, lat, lng, 3000);
    if (f.length) {
      const a = f[0].attributes ?? {};
      return {
        inside: false, near: true, type: L.type, name: attr(a, 'DESC_TH'), changwat: attr(a, 'CHANGWAT_T'),
        ...river, ...fire, ...disaster, source: src,
      };
    }
  }
  return { inside: false, near: false, ...river, ...fire, ...disaster, source: src };
}
