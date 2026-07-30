// GISTDA — real natural-resource layers (public ArcGIS REST, CORS-enabled).
// Service: "ข้อมูลทรัพยากรธรรมชาติ" — national park & wildlife-sanctuary boundaries.
// We ask: is the farmer's plot inside / near a protected forest? This drives both
// legality (you may not clear/plant inside a park) and restoration value (agroforestry
// in the buffer zone protects the forest edge).
//
// SCOPE LIMIT — read this before writing any UI copy against these results.
// This service publishes only the two classes in LAYERS below. It does NOT publish
// ป่าสงวนแห่งชาติ (national reserved forest), ป่าไม้ถาวร, or ลุ่มน้ำชั้น 1A — and those
// are precisely the classifications that decide whether clearing Nan highland farmland
// is prosecutable. A negative result here therefore means "not found in two layers",
// NEVER "legally plantable". Callers must not upgrade it into a clearance claim.
import { fetchGistdaDisaster } from './gistdaDisaster';

const BASE =
  'https://gistdaportal.gistda.or.th/arcgis/rest/services/' +
  encodeURIComponent('ข้อมูลทรัพยากรธรรมชาติ') +
  '/MapServer';

// LAYER 1 IS NOT A NATIONAL PARK BOUNDARY. Its ArcGIS layer *name* is
// "เขตอุทยานแห่งชาติ", which is why it was originally wired up as one, but its own
// service metadata reads:
//   "การแปลตีความข้อมูลพื้นที่ป่าไม้ จากข้อมูลภาพถ่ายจากดาวเทียม LANDSAT-8 ปี พ.ศ. 2556-2557 …"
// and the only non-null DESC_TH across the whole layer is
//   "พื้นที่ที่มีป่าไม้ปกคลุม ซึ่งรวมทั้งป่าธรรมชาติ และพื้นที่ปลูกสร้างสวนป่า"
// i.e. it is a 2013–2014 satellite forest-COVER product (FCA__TYPE, Data_sour1 =
// Landsat scene ids), split by tambon, containing no park names at all.
//
// Treating it as a legal boundary made the app tell a farmer "your land is inside a
// national park, clearing is illegal" purely because their plot had tree cover in 2014 —
// verified firing on บ่อเกลือ and แม่จริม, ordinary Nan farmland. For an agroforestry
// tool that is exactly backwards: the more trees a farmer has already kept, the more
// likely they were falsely accused. So it is now an informational context signal only
// and can never set `inside`/`near`.
const FOREST_COVER_LAYER_ID = 1;

// Only layer 2 is a real protected-area boundary (verified: FR_NAME returns genuine Nan
// sanctuaries such as ดอยผาช้าง). Read FR_NAME/FOR_NAME_T — DESC_TH on this layer is
// truncated to 16 characters ('พื้นที่เขตรักษาพ') and is useless as a name.
const LEGAL_LAYERS = [
  { id: 2, type: 'เขตรักษาพันธุ์สัตว์ป่า' },
];

// ป่าสงวนแห่งชาติ (national reserved forest) — the class that actually decides whether
// clearing Nan highland farmland is prosecutable. On a 48-point grid across Nan this layer
// hits 70.8% of points while the sanctuary layer above hits 8.3%, so without it the app is
// blind to the dominant legal class over roughly two thirds of the province.
//
// PROVENANCE, and why a hit is only ever a WARNING: this is not an official RFD endpoint.
// The Royal Forest Department's own advertised WMS/WFS host (gis.forest.go.th) has no DNS
// record at all — confirmed against 8.8.8.8, 1.1.1.1 and 9.9.9.9 while neighbouring
// forest.go.th hosts resolve fine. The only live source is this public 2019 item on a
// third-party ArcGIS Online account (owner deqp_datateam, modified 2019-05-03, no licence,
// no SLA) which also hosts landfill surveys and a service named "test_ระบบ". The owner can
// unshare it without notice.
//
// Its DATA is trustworthy: all 193 forests match the official RFD registry of 1,221 gazetted
// forests on both code and area, and it carries all 16 of Nan's H2.* reserved forests. But
// RFD's own wording for this boundary product is "แนวเขต…โดยประมาณ" (approximate), and a
// zero-feature response is indistinguishable from out-of-coverage — Nan farmland, Bangkok,
// Surat Thani and a point inside Laos all return byte-identical empty responses. So a miss
// is never permission.
const RESERVED_FOREST_URL =
  'https://services1.arcgis.com/iZtkT1QkRyBwT4eu/arcgis/rest/services/' +
  encodeURIComponent('ป่าสงวนแห่งชาติ') +
  '/FeatureServer/4';

// The classes still not checked at all, surfaced to the UI so the gap is stated to the
// farmer rather than hidden behind a reassuring absence. อุทยานแห่งชาติ is here because,
// per the note above, this GISTDA service exposes no genuine park layer; ลุ่มน้ำชั้น 1A is
// here because no live source for it exists by any route (ONEP publishes only a 347 MB zip
// behind a WAF).
export const UNCHECKED_LEGAL_CLASSES = [
  'อุทยานแห่งชาติ', 'ป่าไม้ถาวร', 'ลุ่มน้ำชั้น 1A',
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
  // 'unavailable'/'partial' means the count is NOT a real "zero fires" reading —
  // the query failed, so absence must not be shown to the farmer as zero-risk.
  fireStatus?: 'ok' | 'partial' | 'unavailable';
  riverStatus?: 'ok' | 'unavailable';
  // 'unavailable' means the park/sanctuary lookup itself failed, so inside/near are
  // BOTH meaningless defaults rather than a real "not protected" reading. Without this
  // an outage is indistinguishable from a clear result — see checkProtectedLayers.
  protectedStatus?: 'ok' | 'unavailable';
  // 2013–2014 satellite forest-cover read (GISTDA layer 1). Context, never legality.
  forestCover?: boolean;
  forestCoverStatus?: 'ok' | 'unavailable';
  // ป่าสงวนแห่งชาติ. A hit is a WARNING that must be verified with a forestry officer; a
  // miss is NOT clearance (approximate boundary, and 0 features cannot be distinguished
  // from out-of-coverage). 'unavailable' means the query itself failed.
  reservedForest?: boolean;
  reservedForestName?: string;
  reservedForestCode?: string;
  reservedForestAreaRai?: number;
  reservedForestStatus?: 'ok' | 'unavailable';
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
        riverStatus: 'ok' as const,
        riverDistanceM: distance,
        riverOrder: Number(attr(a, 'STR_ORDER')) || undefined,
        riverTambon: attr(a, 'TAMBON_T'),
        riverAmphoe: attr(a, 'AMPHOE_T'),
      };
    }
  }
  return { riverNear: false, riverStatus: 'ok' as const };
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
  // Track each query's success so a failed fetch reads as "unknown", not "0 fires".
  const wrap = (p: Promise<any[]>) => p.then((r) => ({ ok: true, r })).catch(() => ({ ok: false, r: [] as any[] }));
  const [modisRes, nppRes] = await Promise.all([
    wrap(queryFire('FR_Fire/hotspot_daily', { where: "pv_tn='น่าน'" })),
    wrap(queryFire('FR_Fire/hotspot_npp_daily', {
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '50000',
      units: 'esriSRUnit_Meter',
    })),
  ]);
  const modis = modisRes.r;
  const nppNearby = nppRes.r;
  const fireStatus: 'ok' | 'partial' | 'unavailable' =
    modisRes.ok && nppRes.ok ? 'ok' : modisRes.ok || nppRes.ok ? 'partial' : 'unavailable';
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
    fireStatus,
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

// Park/sanctuary lookup, isolated so one HTTP error degrades ONLY this signal.
// Previously these two loops sat un-wrapped in checkProtected, so a single failure
// rejected the whole call, planRunner turned it into `protectedArea: null`, and the
// UI's optional-chained branches fell through to the same "plantable" headline that
// a genuine clear result produces.
async function checkProtectedLayers(lat: number, lng: number) {
  const OUT = 'FR_NAME,FOR_NAME_T,DESC_TH,CHANGWAT_T,Area_rai';
  const nameOf = (a: Record<string, any>) =>
    attr(a, 'FR_NAME') || attr(a, 'FOR_NAME_T') || undefined;

  // inside a protected area?
  for (const L of LEGAL_LAYERS) {
    const f = await queryLayer(L.id, lat, lng, 0, OUT);
    if (f.length) {
      const a = f[0].attributes ?? {};
      return {
        inside: true, near: true, type: L.type,
        name: nameOf(a), changwat: attr(a, 'CHANGWAT_T'),
        protectedStatus: 'ok' as const,
      };
    }
  }
  // within ~3 km of one?
  for (const L of LEGAL_LAYERS) {
    const f = await queryLayer(L.id, lat, lng, 3000, OUT);
    if (f.length) {
      const a = f[0].attributes ?? {};
      return {
        inside: false, near: true, type: L.type,
        name: nameOf(a), changwat: attr(a, 'CHANGWAT_T'),
        protectedStatus: 'ok' as const,
      };
    }
  }
  return { inside: false, near: false, protectedStatus: 'ok' as const };
}

// Reserved-forest point lookup. Uses the same query shape as every other layer here — the
// hosted FeatureServer accepts the "lng,lat" shorthand despite a research note claiming it
// required Esri-JSON geometry plus an explicit where clause (tested: all four combinations
// return the identical feature, so no special-casing is needed).
async function checkReservedForest(lat: number, lng: number) {
  const p = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FR_ID,FR_NAME,AREA_RAI',
    returnGeometry: 'false',
    f: 'json',
  });
  const r = await fetch(`${RESERVED_FOREST_URL}/query?${p}`, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`RFD reserved-forest HTTP ${r.status}`);
  const body = await r.json();
  // An ArcGIS error object comes back with HTTP 200, so absence of `features` is a failure,
  // not an empty result — treating it as empty would read as "not in reserved forest".
  if (!Array.isArray(body.features)) throw new Error('RFD reserved-forest: malformed response');
  const f = body.features[0];
  if (!f) return { reservedForest: false, reservedForestStatus: 'ok' as const };
  const a = f.attributes ?? {};
  const areaRai = Number(attr(a, 'AREA_RAI'));
  return {
    reservedForest: true,
    reservedForestName: attr(a, 'FR_NAME') || undefined,
    reservedForestCode: attr(a, 'FR_ID') || undefined,
    reservedForestAreaRai: Number.isFinite(areaRai) ? areaRai : undefined,
    reservedForestStatus: 'ok' as const,
  };
}

// Existing tree cover, from the 2013–2014 satellite product described above. Genuinely
// useful for an agroforestry tool — a plot that already carries canopy is a restoration
// candidate rather than a conversion — but it is NOT a legal determination.
async function checkForestCover(lat: number, lng: number) {
  const f = await queryLayer(FOREST_COVER_LAYER_ID, lat, lng, 0, 'DESC_TH,Area_rai,CHANGWAT_T');
  return { forestCover: f.length > 0, forestCoverStatus: 'ok' as const };
}

export async function checkProtected(lat: number, lng: number): Promise<ProtectedArea> {
  const src = 'GISTDA · ข้อมูลทรัพยากรธรรมชาติ';
  const [protectedLayers, forest, reserved, river, fire, disaster] = await Promise.all([
    checkProtectedLayers(lat, lng).catch(() => ({
      inside: false, near: false, protectedStatus: 'unavailable' as const,
    })),
    checkForestCover(lat, lng).catch(() => ({
      forestCover: false, forestCoverStatus: 'unavailable' as const,
    })),
    checkReservedForest(lat, lng).catch(() => ({
      reservedForest: false, reservedForestStatus: 'unavailable' as const,
    })),
    checkRiver(lat, lng).catch(() => ({ riverNear: false, riverStatus: 'unavailable' as const })),
    checkFire(lat, lng).catch(() => ({ fireHotspots: 0, fireNearby: 0, fireProtected: 0, fireStatus: 'unavailable' as const })),
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

  return { ...protectedLayers, ...forest, ...reserved, ...river, ...fire, ...disaster, source: src };
}
