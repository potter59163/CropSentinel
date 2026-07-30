import raw from '../data/cultivation/tambon_cultivation.json';

/**
 * How much of each crop is actually grown near a plot, from Thai government statistics.
 *
 * WHY THIS IS A SEPARATE SIGNAL, AND MUST STAY SEPARATE.
 *
 * This is deliberately NOT folded into the suitability score or the cashflow. A measurement
 * of where crops are *currently* grown reflects market access, tradition, contract farming,
 * subsidies and road networks at least as much as agro-climatic fit. A model trained on it
 * scored 0.748 against the shipped model's 0.614 at predicting real cultivation (see
 * ml/MODEL-FINDINGS.md) — but blending it into "suitability" would turn the app into a
 * recommendation to grow whatever the neighbours already grow. Nan grows more maize than
 * anything else; that must never become evidence that maize is the right choice. The whole
 * point of the tool is to help farmers move away from monoculture maize.
 *
 * What it IS good for is the question the app previously could not answer at all: not "will
 * it grow" but "can I sell it, and can I get seedlings and advice". Neighbouring cultivation
 * is honest evidence of a supply chain. It is a count, not a prediction — no model, no AUC,
 * no selection bias.
 *
 * It is also useful inverted: a crop the model rates highly that *nobody* nearby grows is
 * worth a second look, because there may be a local reason the climate data cannot see
 * (disease pressure, labour demand, a collapsed buyer).
 *
 * SOURCE: DOAE (กรมส่งเสริมการเกษตร) ภาวะการผลิตพืชระดับตำบล, joined to sub-district
 * centroids from HDX/OCHA COD-AB (upstream Royal Thai Survey Department, CC BY-IGO).
 * Tambons reporting under 20 rai are excluded as noise. See ml/reference/README.md.
 */

// Compact on purpose: [lat, lon, rai] per tambon, keyed by the plant id used in plants.ts.
const DATA = raw as unknown as Record<string, [number, number, number][]>;

// 50 km. Chosen as a plausible limit for a smallholder to reach a buyer, share a
// collection point, or source seedlings on Nan's mountain roads — not a modelling
// parameter, and nothing downstream is fitted to it.
export const CULTIVATION_RADIUS_KM = 50;

const EARTH_KM = 6371;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface CropCultivation {
  /** tambons within the radius reporting >= 20 rai */
  tambons: number;
  /** their combined planted/standing area, rai */
  rai: number;
  /** distance to the nearest reporting tambon, km — undefined when none are in range */
  nearestKm?: number;
}

export interface CultivationContext {
  radiusKm: number;
  /** plant id -> local cultivation. A crop absent from this map has no reporting tambon in range. */
  byPlant: Record<string, CropCultivation>;
  /** true when the dataset itself is unavailable, so absence must not be read as "nobody grows it" */
  unavailable?: boolean;
  source: string;
}

const SOURCE = 'DOAE ภาวะการผลิตพืชระดับตำบล · พิกัดตำบล HDX/OCHA (กรมแผนที่ทหาร)';

export function cultivationNear(
  lat: number,
  lng: number,
  radiusKm: number = CULTIVATION_RADIUS_KM,
): CultivationContext {
  // A missing or malformed dataset must degrade to "unknown", never to zero — a UI that
  // renders 0 tambons as "nobody grows this nearby" would be asserting something false.
  if (!DATA || typeof DATA !== 'object' || !Object.keys(DATA).length) {
    return { radiusKm, byPlant: {}, unavailable: true, source: SOURCE };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { radiusKm, byPlant: {}, unavailable: true, source: SOURCE };
  }

  const byPlant: Record<string, CropCultivation> = {};
  for (const [plantId, rows] of Object.entries(DATA)) {
    if (!Array.isArray(rows)) continue;
    let tambons = 0;
    let rai = 0;
    let nearestKm = Infinity;
    for (const r of rows) {
      const d = haversineKm(lat, lng, r[0], r[1]);
      if (d <= radiusKm) {
        tambons += 1;
        rai += r[2];
        if (d < nearestKm) nearestKm = d;
      }
    }
    if (tambons > 0) {
      byPlant[plantId] = {
        tambons,
        rai,
        nearestKm: Math.round(nearestKm * 10) / 10,
      };
    }
  }
  return { radiusKm, byPlant, source: SOURCE };
}
