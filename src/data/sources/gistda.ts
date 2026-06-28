import type { Hotspot } from '../types';

/**
 * GISTDA burn-scar layer.
 *
 * GISTDA's national fire console (FAIPA / fire.gistda.or.th) publishes daily
 * burn-scar (พื้นที่เผาไหม้) polygons derived from Sentinel-2 / Landsat-8. A direct
 * public JSON endpoint for those polygons is not openly documented, so for the
 * prototype we estimate seasonal burn scar from the cumulative VIIRS hotspot
 * footprint (each persistent hotspot pixel ≈ 375 m → ~88 rai, scaled by FRP and
 * clustering). Swap `estimateBurnScarRai` for the live GISTDA FeatureServer
 * query once an access token / endpoint is provisioned.
 */
export function estimateBurnScarRai(hotspots: Hotspot[]): number {
  // a VIIRS pixel footprint is ~375 m → ~140,000 m² ≈ 88 rai, but adjacent
  // detections overlap, so use an effective per-detection burned area that
  // grows with FRP (fire intensity → larger scar).
  let rai = 0;
  for (const h of hotspots) {
    const intensity = Math.min(1.6, 0.5 + h.frp / 25);
    rai += 36 * intensity; // effective rai per detection
  }
  return Math.round(rai);
}
