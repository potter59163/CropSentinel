// GISTDA — real natural-resource layers (public ArcGIS REST, CORS-enabled).
// Service: "ข้อมูลทรัพยากรธรรมชาติ" — national park & wildlife-sanctuary boundaries.
// We ask: is the farmer's plot inside / near a protected forest? This drives both
// legality (you may not clear/plant inside a park) and restoration value (agroforestry
// in the buffer zone protects the forest edge).
const BASE =
  'https://gistdaportal.gistda.or.th/arcgis/rest/services/' +
  encodeURIComponent('ข้อมูลทรัพยากรธรรมชาติ') +
  '/MapServer';

const LAYERS = [
  { id: 1, type: 'อุทยานแห่งชาติ' },
  { id: 2, type: 'เขตรักษาพันธุ์สัตว์ป่า' },
];

export interface ProtectedArea {
  inside: boolean;
  near: boolean;
  type?: string;
  name?: string;
  changwat?: string;
  source: string;
}

async function queryLayer(id: number, lat: number, lng: number, distance = 0): Promise<any[]> {
  const p = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'DESC_TH,CHANGWAT_T,Area_rai',
    returnGeometry: 'false',
    f: 'json',
  });
  if (distance) { p.set('distance', String(distance)); p.set('units', 'esriSRUnit_Meter'); }
  const r = await fetch(`${BASE}/${id}/query?${p}`, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`GISTDA HTTP ${r.status}`);
  return (await r.json()).features ?? [];
}

export async function checkProtected(lat: number, lng: number): Promise<ProtectedArea> {
  const src = 'GISTDA · ข้อมูลทรัพยากรธรรมชาติ';
  // inside a protected area?
  for (const L of LAYERS) {
    const f = await queryLayer(L.id, lat, lng);
    if (f.length) {
      const a = f[0].attributes ?? {};
      return { inside: true, near: true, type: L.type, name: a.DESC_TH, changwat: a.CHANGWAT_T, source: src };
    }
  }
  // within ~3 km of one?
  for (const L of LAYERS) {
    const f = await queryLayer(L.id, lat, lng, 3000);
    if (f.length) {
      const a = f[0].attributes ?? {};
      return { inside: false, near: true, type: L.type, name: a.DESC_TH, changwat: a.CHANGWAT_T, source: src };
    }
  }
  return { inside: false, near: false, source: src };
}
