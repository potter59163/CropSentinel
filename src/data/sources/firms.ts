import type { Hotspot } from '../types';
import { CHIANG_MAI_BBOX } from '../districts';

// Esri Living Atlas — NASA/NOAA VIIRS Thermal Hotspots & Fire Activity (last 7 days).
// Public, CORS-enabled, no API key. GISTDA's national FAIPA console is built on the
// same VIIRS Suomi-NPP / NOAA-20 feed, so this mirrors GISTDA's hotspot product.
const FIRMS_URL =
  'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/' +
  'Satellite_VIIRS_Thermal_Hotspots_and_Fire_Activity/FeatureServer/0/query';

export async function fetchHotspots(): Promise<Hotspot[]> {
  const bb = CHIANG_MAI_BBOX;
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${bb.minLng},${bb.minLat},${bb.maxLng},${bb.maxLat}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'frp,bright_ti4,confidence,daynight,satellite,hours_old,acq_date',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '2000',
    f: 'geojson',
  });

  const res = await fetch(`${FIRMS_URL}?${params}`);
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const gj = await res.json();

  const feats: any[] = gj.features ?? [];
  return feats
    .filter((f) => f.geometry?.coordinates)
    .map((f): Hotspot => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties ?? {};
      return {
        lat,
        lng,
        frp: Number(p.frp) || 0,
        brightness: Number(p.bright_ti4) || 0,
        confidence: p.confidence ?? 'nominal',
        daynight: p.daynight ?? 'D',
        satellite: p.satellite ?? 'N',
        hoursOld: Number(p.hours_old) || 0,
        acqDate: Number(p.acq_date) || 0,
      };
    });
}
