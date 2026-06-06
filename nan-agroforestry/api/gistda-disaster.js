const GISTDA_BASE = 'https://api-gateway.gistda.or.th/api/2.0/resources';
const NAN_PROVINCE_ID = '55';
const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 80;

function clampRadius(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADIUS_KM;
  return Math.min(Math.max(n, 3), MAX_RADIUS_KM);
}

function bboxAround(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.08));
  return [
    lng - lngDelta,
    lat - latDelta,
    lng + lngDelta,
    lat + latDelta,
  ].map((v) => v.toFixed(6)).join(',');
}

async function getJson(path, params, apiKey) {
  const url = new URL(`${GISTDA_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      numberMatched: 0,
      numberReturned: 0,
      features: [],
    };
  }
  return response.json();
}

async function probeMap(path, apiKey) {
  const url = new URL(`${GISTDA_BASE}${path}`);
  url.searchParams.set('api_key', apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
  };
}

const count = (body) => Number(body?.numberMatched ?? body?.features?.length ?? 0) || 0;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

  const apiKey = process.env.GISTDA_DISASTER_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      status: 'missing-key',
      source: 'GISTDA Disaster Open API',
      message: 'Set GISTDA_DISASTER_API_KEY in Vercel Environment Variables.',
    });
    return;
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = clampRadius(req.query.radiusKm);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ status: 'bad-request', message: 'lat and lng are required numbers.' });
    return;
  }

  const bbox = bboxAround(lat, lng, radiusKm);
  const baseParams = { limit: 1, offset: 0, pv_idn: NAN_PROVINCE_ID };
  const nearParams = { ...baseParams, bbox };

  try {
    const [
      fireNan,
      fireNear,
      burnScarNear,
      burnFreqNear,
      floodNan,
      floodNear,
      floodFreqNear,
      dri,
      ndwi,
      smap,
    ] = await Promise.all([
      getJson('/features/viirs/7days', baseParams, apiKey),
      getJson('/features/viirs/7days', nearParams, apiKey),
      getJson('/features/burn-scar', nearParams, apiKey),
      getJson('/features/burn-freq', nearParams, apiKey),
      getJson('/features/flood/7days', baseParams, apiKey),
      getJson('/features/flood/7days', nearParams, apiKey),
      getJson('/features/flood-freq', nearParams, apiKey),
      probeMap('/maps/dri/7days/wms', apiKey),
      probeMap('/maps/ndwi/7days/wms', apiKey),
      probeMap('/maps/smap/7days/wms', apiKey),
    ]);

    res.status(200).json({
      status: 'live',
      source: 'GISTDA Disaster Open API',
      provinceId: NAN_PROVINCE_ID,
      radiusKm,
      bbox,
      updatedAt: new Date().toISOString(),
      fire: {
        hotspots7dNan: count(fireNan),
        hotspots7dNearby: count(fireNear),
        burnScarNearby: count(burnScarNear),
        burnFreqNearby: count(burnFreqNear),
      },
      flood: {
        flood7dNan: count(floodNan),
        flood7dNearby: count(floodNear),
        floodFreqNearby: count(floodFreqNear),
      },
      drought: {
        availableLayers: [
          dri.ok ? 'DRIPlus' : null,
          ndwi.ok ? 'NDWI' : null,
          smap.ok ? 'SMAP' : null,
        ].filter(Boolean),
        driStatus: dri.status,
        ndwiStatus: ndwi.status,
        smapStatus: smap.status,
      },
      warnings: [
        fireNan.ok === false ? `VIIRS province API returned ${fireNan.status}` : null,
        floodNan.ok === false ? `Flood province API returned ${floodNan.status}` : null,
      ].filter(Boolean),
    });
  } catch (error) {
    res.status(200).json({
      status: 'unavailable',
      source: 'GISTDA Disaster Open API',
      message: error instanceof Error ? error.message : 'GISTDA Disaster API unavailable.',
    });
  }
}
