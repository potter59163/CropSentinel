// Real satellite land context from Google Earth Engine (precomputed grid).
// Hansen forest-loss + ESA WorldCover + Sentinel-2 NDVI for Nan province.
import data from '../data/nan_satellite.json';

interface Cell { lat: number; lng: number; tc: number; lossyr: number; lc: number; ndvi: number | null }
const D = data as { step: number; source: string; cells: Cell[] };

export const LC_TH: Record<number, string> = {
  10: 'ป่าไม้', 20: 'ไม้พุ่ม', 30: 'ทุ่งหญ้า', 40: 'พื้นที่เกษตร', 50: 'สิ่งปลูกสร้าง',
  60: 'ดินโล่ง', 70: 'หิมะ/น้ำแข็ง', 80: 'แหล่งน้ำ', 90: 'พื้นที่ชุ่มน้ำ', 95: 'ป่าชายเลน', 100: 'มอส/ไลเคน',
};

export type Verdict = 'restore' | 'forest' | 'ok';
export interface SatContext {
  tc: number; lossyr: number; lc: number; lcTh: string; ndvi: number | null;
  verdict: Verdict; distanceKm: number; source: string;
}

export function satContext(lat: number, lng: number): SatContext | null {
  let best: Cell | null = null, bd = Infinity;
  for (const c of D.cells) {
    const dx = (c.lng - lng) * Math.cos((lat * Math.PI) / 180);
    const d = dx * dx + (c.lat - lat) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return null;
  const distanceKm = Math.round(Math.sqrt(bd) * 111 * 10) / 10;

  let verdict: Verdict;
  if (best.lc === 10 || best.tc >= 40) verdict = 'forest';
  else if (best.lossyr > 0 || best.lc === 30 || best.lc === 40 || best.lc === 60 || (best.ndvi != null && best.ndvi < 0.4)) verdict = 'restore';
  else verdict = 'ok';

  return { tc: best.tc, lossyr: best.lossyr, lc: best.lc, lcTh: LC_TH[best.lc] ?? `คลาส ${best.lc}`, ndvi: best.ndvi, verdict, distanceKm, source: D.source };
}
