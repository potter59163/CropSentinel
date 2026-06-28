// CropSentinel — domain model for Chiang Mai wildfire + maize console
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ForestType = 'deciduous' | 'mixed' | 'evergreen' | 'agriculture';

export interface District {
  id: string;
  name: string;
  nameTh: string;
  lat: number;
  lng: number;
  /** mean terrain elevation (m) */
  elevationM: number;
  /** representative slope (degrees) — drives upslope fire acceleration */
  slopeDeg: number;
  forestType: ForestType;
  /** maize (ข้าวโพดเลี้ยงสัตว์) planted area in rai — the burning/encroachment driver */
  maizeAreaRai: number;
  /** forest area in rai */
  forestRai: number;
  /** detected forest-encroachment in rai over the season */
  encroachmentRai: number;
  /** baseline fuel susceptibility 0..1 (deciduous leaf litter = high) */
  fuelSusc: number;

  // ── live / derived fields (filled by data sources) ──
  ndvi: number;
  /** dryness index 0..1 (1 = tinder dry) */
  dryness: number;
  pm25: number;
  /** active VIIRS hotspots inside district over lookback window */
  hotspots: number;
  /** cumulative fire radiative power of those hotspots (MW) */
  frpSum: number;
  fireRisk: RiskLevel;
}

export interface Hotspot {
  lat: number;
  lng: number;
  /** fire radiative power (MW) */
  frp: number;
  /** brightness temperature K (channel I-4) */
  brightness: number;
  confidence: 'low' | 'nominal' | 'high' | string;
  daynight: 'D' | 'N' | string;
  satellite: string;
  hoursOld: number;
  acqDate: number;
  districtId?: string;
}

export interface Weather {
  tempC: number;
  humidity: number;
  /** surface wind speed km/h */
  windSpeedKmh: number;
  /** wind direction in degrees the wind is coming FROM (meteorological) */
  windDirDeg: number;
  windGustKmh: number;
  /** mm rain accumulated next 7 days */
  weekRain: number;
  /** consecutive recent dry days */
  dryDays: number;
}

/** one expanding fire front at a given hour */
export interface FireFront {
  hour: number;
  /** ring of [lat,lng] points forming the burned perimeter */
  ring: Array<[number, number]>;
  /** burned area so far (rai) */
  areaRai: number;
}

export interface FireSpreadSim {
  origin: { lat: number; lng: number };
  originLabelTh: string;
  /** head-fire rate of spread (m/min) */
  rosHead: number;
  /** compass bearing the head fire travels TOWARD (deg) */
  bearingDeg: number;
  /** length:width ratio of the elliptical front */
  lwRatio: number;
  fronts: FireFront[];
  /** total burned area at the final hour (rai) */
  finalAreaRai: number;
  /** hours simulated */
  horizonH: number;
  drivers: { wind: number; slope: number; fuel: number; dryness: number };
}

export interface Alert {
  id: string;
  level: 'warn' | 'risk' | 'crit';
  confidence: number;
  title: string;
  titleEn: string;
  body: string;
  tag: string;
}

export interface Recommendation {
  urgency: 'urgent' | 'soft' | 'good';
  icon: string;
  title: string;
  desc: string;
  meta: string[];
}

export interface ProvinceSummary {
  name: string;
  nameTh: string;
  lat: number;
  lng: number;
  lastUpdate: string;
  dataSource: 'LIVE' | 'LOADING' | 'MOCK';
  // aggregates
  totalHotspots: number;
  totalFrp: number;
  avgNdvi: number;
  avgDryness: number;
  pm25: number;
  weather: Weather;
  fireRisk: RiskLevel;
  /** active-fire pixels trend (last weeks) */
  fireTrend: number[];
  totalMaizeRai: number;
  totalForestRai: number;
  totalEncroachmentRai: number;
  burnedScarRai: number;
}

export interface AppData {
  province: ProvinceSummary;
  districts: District[];
  hotspots: Hotspot[];
  sim: FireSpreadSim;
  alerts: Alert[];
  recommendations: {
    firefighter: Recommendation[];
    lgu: Recommendation[];
    farmer: Recommendation[];
  };
  /** 8-week forward fire-risk & pm2.5 projections */
  forecast: {
    weeks: string[];
    fireRiskIdx: number[]; // 0..100
    pm25: number[];
    burnedRai: number[]; // cumulative burned scar projection
  };
  sources: SourceStatus[];
}

export interface SourceStatus {
  name: string;
  desc: string;
  status: 'ok' | 'warn' | 'down';
  ago: string;
}
