import { CHIANG_MAI_CENTER } from '../districts';
import { avg, clamp, round2 } from '../../lib/format';

export interface ClimateProxy {
  /** province NDVI proxy 0..1 (greener forest = lower fire risk) */
  ndvi: number;
  /** root-zone soil wetness 0..1 */
  soilWetness: number;
  /** dryness index 0..1 (1 = tinder dry) */
  dryness: number;
}

// NASA POWER — free, no key, CORS-OK. 30-day climate window → NDVI & dryness proxy.
export async function fetchClimate(): Promise<ClimateProxy> {
  const { lat, lng } = CHIANG_MAI_CENTER;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const end = new Date(now);
  end.setDate(end.getDate() - 5);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  const url =
    'https://power.larc.nasa.gov/api/temporal/daily/point' +
    '?parameters=GWETROOT,ALLSKY_SFC_SW_DWN,T2M,RH2M,PRECTOTCORR' +
    `&community=AG&longitude=${lng}&latitude=${lat}` +
    `&start=${fmt(start)}&end=${fmt(end)}&format=JSON`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
  const j = await res.json();
  const p = j.properties?.parameter;
  if (!p) throw new Error('NASA POWER: no parameters');

  const gwet = avg(Object.values(p.GWETROOT ?? {}).map(Number).filter((v) => v > -990));
  const solar = avg(Object.values(p.ALLSKY_SFC_SW_DWN ?? {}).map(Number).filter((v) => v > -990));
  const temp = avg(Object.values(p.T2M ?? {}).map(Number).filter((v) => v > -990));
  const rh = avg(Object.values(p.RH2M ?? {}).map(Number).filter((v) => v > -990));
  const rain = Object.values(p.PRECTOTCORR ?? {}).map(Number).filter((v) => v > -990);
  const rainTotal = rain.reduce((a, b) => a + b, 0);

  const soilWetness = round2(clamp(gwet || 0.35, 0.1, 0.9));
  // NDVI proxy: wetter + moderate solar + warm-not-hot → greener
  const gwetScore = clamp(soilWetness / 0.7, 0.2, 1);
  const solarScore = clamp((solar || 18) / 24, 0.4, 1);
  const ndvi = round2(clamp(0.28 + 0.5 * gwetScore * solarScore, 0.18, 0.85));

  // dryness blends low soil wetness, low humidity, low recent rain, high heat
  const dryness = round2(
    clamp(
      0.4 * (1 - soilWetness) +
        0.25 * (1 - clamp((rh || 45) / 80, 0, 1)) +
        0.2 * (1 - clamp(rainTotal / 60, 0, 1)) +
        0.15 * clamp(((temp || 30) - 28) / 10, 0, 1),
      0,
      1,
    ),
  );

  return { ndvi, soilWetness, dryness };
}
