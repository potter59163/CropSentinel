import type { District, FireFront, FireSpreadSim, Weather } from '../data/types';
import { metersToLatLng, SQM_PER_RAI } from './geo';
import { clamp } from './format';

export interface SpreadInput {
  origin: { lat: number; lng: number };
  originLabelTh: string;
  weather: Weather;
  /** terrain slope at the origin (deg) */
  slopeDeg: number;
  /** dry-fuel susceptibility 0..1 */
  fuelSusc: number;
  /** dryness 0..1 */
  dryness: number;
  /** hours to simulate (default 6) */
  horizonH?: number;
}

/**
 * Elliptical wildfire-spread model.
 *
 * Head rate of spread (ROS) blends a base litter-fire rate with multiplicative
 * wind, slope, fuel and dryness coefficients — a deliberately transparent
 * simplification of Rothermel (1972) suited to a forecasting console rather
 * than an operational burn model. The fire footprint each hour is a wind-aligned
 * ellipse whose length:width and head:back ratios grow with wind speed; the
 * head travels along the wind bearing, nudged upslope (fire climbs ridges
 * faster — the core problem in Chiang Mai's folded terrain).
 */
export function simulateSpread(input: SpreadInput): FireSpreadSim {
  const horizonH = input.horizonH ?? 6;
  const { weather, slopeDeg, fuelSusc, dryness } = input;

  // ── coefficients (all dimensionless, ~1 = neutral) ──────────────────────
  const baseRos = 1.6; // m/min, dry deciduous leaf litter, calm
  const windFactor = Math.pow(clamp(weather.windSpeedKmh, 0, 45) / 12, 1.35);
  const slopeFactor = 1 + (clamp(slopeDeg, 0, 35) / 30) * 1.7; // upslope acceleration
  const fuelFactor = 0.55 + fuelSusc * 0.9;
  const drynessFactor = 0.6 + dryness * 0.9;
  const humidityDamp = clamp(1 - (weather.humidity - 30) / 140, 0.45, 1.1);

  const rosHead = baseRos * (1 + windFactor) * slopeFactor * fuelFactor * drynessFactor * humidityDamp;

  // head:back and length:width ratios increase with wind
  const hbRatio = clamp(1 + windFactor * 1.8, 1.2, 9);
  const lwRatio = clamp(1 + windFactor * 0.7, 1.1, 4.2);
  const rosBack = rosHead / hbRatio;

  // wind blows FROM windDirDeg → fire head travels TO the opposite bearing,
  // biased ~20% toward upslope (treated as generally "uphill = away from basin
  // centre"; here we keep it wind-dominant for clarity).
  const bearingDeg = (weather.windDirDeg + 180) % 360;
  const theta = (bearingDeg * Math.PI) / 180;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  const fronts: FireFront[] = [];
  const N = 48;
  for (let h = 1; h <= horizonH; h++) {
    const t = h * 60; // minutes
    const fwd = (rosHead * t) / 1; // forward reach (m)
    const back = rosBack * t;
    const A = (fwd + back) / 2; // semi-major
    const B = A / lwRatio; // semi-minor
    const c = (fwd - back) / 2; // centre offset along bearing from ignition

    const ring: Array<[number, number]> = [];
    for (let i = 0; i < N; i++) {
      const phi = (i / N) * 2 * Math.PI;
      const along = c + A * Math.cos(phi); // along-bearing component
      const perp = B * Math.sin(phi); // perpendicular component
      // rotate (along=north-ish, perp=east-ish) onto the bearing
      const east = along * sinT + perp * cosT;
      const north = along * cosT - perp * sinT;
      ring.push(metersToLatLng(input.origin, east, north));
    }
    const areaSqm = Math.PI * A * B;
    fronts.push({ hour: h, ring, areaRai: areaSqm / SQM_PER_RAI });
  }

  return {
    origin: input.origin,
    originLabelTh: input.originLabelTh,
    rosHead,
    bearingDeg,
    lwRatio,
    fronts,
    finalAreaRai: fronts[fronts.length - 1].areaRai,
    horizonH,
    drivers: {
      wind: round1(windFactor),
      slope: round1(slopeFactor),
      fuel: round1(fuelFactor),
      dryness: round1(drynessFactor),
    },
  };
}

/** pick the ignition district: highest live FRP, else driest high-fuel district */
export function pickIgnition(districts: District[]): District {
  const byFrp = [...districts].filter((d) => d.frpSum > 0).sort((a, b) => b.frpSum - a.frpSum);
  if (byFrp.length) return byFrp[0];
  return [...districts].sort(
    (a, b) => b.dryness * b.fuelSusc * b.slopeDeg - a.dryness * a.fuelSusc * a.slopeDeg,
  )[0];
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
