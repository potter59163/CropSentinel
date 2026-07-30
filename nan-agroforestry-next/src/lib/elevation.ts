// Open-Meteo elevation — free, no key, CORS-OK.
// Both paths carry an explicit timeout so a slow endpoint can't hang the request
// on a spotty rural connection (the client wrapper in InputForm has no timeout).
export async function fetchElevation(lat: number, lng: number): Promise<number> {
  if (typeof window !== 'undefined') {
    const res = await fetch(`/api/elevation?lat=${lat}&lng=${lng}`, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`elevation proxy HTTP ${res.status}`);
    const body = await res.json();
    return Math.round(Number(body.elevationM) || 0);
  }
  const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`elevation HTTP ${res.status}`);
  const j = await res.json();
  const e = Array.isArray(j.elevation) ? j.elevation[0] : j.elevation;
  return Math.round(Number(e) || 0);
}

// accuracyM is carried through because elevation — derived from these coordinates — is
// the hard gate on the whole species ranking. A cell-tower fix can be a kilometre or more
// off, which on Nan's terrain is a different elevation band and therefore a different
// recommendation, so the caller must be able to warn instead of rendering it as a precise pin.
export function getGeolocation(): Promise<{ lat: number; lng: number; accuracyM?: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('อุปกรณ์ไม่รองรับ GPS'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracyM: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : undefined,
      }),
      (e) => reject(new Error(e.message || 'ขอตำแหน่งไม่สำเร็จ')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
