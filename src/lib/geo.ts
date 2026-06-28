// Lightweight geo helpers (meters ↔ lat/lng, distance, bearing).
const M_PER_DEG_LAT = 111_320;

export function metersToLatLng(
  origin: { lat: number; lng: number },
  east: number,
  north: number,
): [number, number] {
  const lat = origin.lat + north / M_PER_DEG_LAT;
  const lng = origin.lng + east / (M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180));
  return [lat, lng];
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function inBbox(
  p: { lat: number; lng: number },
  bb: { minLng: number; minLat: number; maxLng: number; maxLat: number },
): boolean {
  return p.lng >= bb.minLng && p.lng <= bb.maxLng && p.lat >= bb.minLat && p.lat <= bb.maxLat;
}

export const SQM_PER_RAI = 1600;

/** initial bearing from A to B, degrees 0..360 from north */
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function compass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

export const compassTh: Record<string, string> = {
  N: 'เหนือ', NE: 'ตะวันออกเฉียงเหนือ', E: 'ตะวันออก', SE: 'ตะวันออกเฉียงใต้',
  S: 'ใต้', SW: 'ตะวันตกเฉียงใต้', W: 'ตะวันตก', NW: 'ตะวันตกเฉียงเหนือ',
};
