import type { Weather } from '../types';
import { CHIANG_MAI_CENTER } from '../districts';

// Open-Meteo — free, no key, CORS-OK. Surface wind (speed + direction) is the
// dominant driver of the fire-spread model; 7-day rain + dry-day count feed dryness.
export async function fetchWeather(): Promise<Weather> {
  const { lat, lng } = CHIANG_MAI_CENTER;
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lng}` +
    '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
    '&daily=precipitation_sum,temperature_2m_max,relative_humidity_2m_min' +
    '&forecast_days=14&timezone=Asia%2FBangkok';

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const j = await res.json();
  const c = j.current ?? {};
  const dp: number[] = j.daily?.precipitation_sum ?? [];
  const weekRain = dp.slice(0, 7).reduce((s, v) => s + (v ?? 0), 0);
  const dryDays = dp.slice(0, 14).filter((v) => (v ?? 0) < 1).length;

  return {
    tempC: Math.round(c.temperature_2m ?? 34),
    humidity: Math.round(c.relative_humidity_2m ?? 40),
    windSpeedKmh: Math.round(c.wind_speed_10m ?? 10),
    windDirDeg: Math.round(c.wind_direction_10m ?? 200),
    windGustKmh: Math.round(c.wind_gusts_10m ?? 16),
    weekRain: Math.round(weekRain),
    dryDays,
  };
}
