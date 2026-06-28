// Open-Meteo elevation — free, no key, CORS-OK.
export async function fetchElevation(lat: number, lng: number): Promise<number> {
  if (typeof window !== 'undefined') {
    const res = await fetch(`/api/elevation?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error(`elevation proxy HTTP ${res.status}`);
    const body = await res.json();
    return Math.round(Number(body.elevationM) || 0);
  }
  const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
  if (!res.ok) throw new Error(`elevation HTTP ${res.status}`);
  const j = await res.json();
  const e = Array.isArray(j.elevation) ? j.elevation[0] : j.elevation;
  return Math.round(Number(e) || 0);
}

export function getGeolocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('อุปกรณ์ไม่รองรับ GPS'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.message || 'ขอตำแหน่งไม่สำเร็จ')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
