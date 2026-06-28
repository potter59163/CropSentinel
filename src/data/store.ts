import { createContext, useContext } from 'react';
import type {
  AppData, District, Hotspot, Weather, Alert, Recommendation, RiskLevel, SourceStatus,
} from './types';
import { CHIANG_MAI_CENTER, CHIANG_MAI_DISTRICTS } from './districts';
import { fetchHotspots } from './sources/firms';
import { fetchWeather } from './sources/weather';
import { fetchClimate } from './sources/climate';
import { estimateBurnScarRai } from './sources/gistda';
import { simulateSpread, pickIgnition } from '../lib/fireSpread';
import { fireRiskFromScore, maxRisk, riskRank } from '../lib/risk';
import { haversineM } from '../lib/geo';
import { clamp, round2, avg, nf0 } from '../lib/format';

// ── React context ──────────────────────────────────────────────────────────
export const DataContext = createContext<AppData | null>(null);
export const useData = (): AppData => {
  const d = useContext(DataContext);
  if (!d) throw new Error('useData outside provider');
  return d;
};

const FALLBACK_WEATHER: Weather = {
  tempC: 36, humidity: 32, windSpeedKmh: 14, windDirDeg: 200, windGustKmh: 22, weekRain: 2, dryDays: 13,
};

function nowICT(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} ICT`;
}

// assign each hotspot to its nearest district centroid
function assignHotspots(districts: District[], hotspots: Hotspot[]) {
  for (const d of districts) { d.hotspots = 0; d.frpSum = 0; }
  for (const h of hotspots) {
    let best: District | null = null;
    let bestDist = Infinity;
    for (const d of districts) {
      const dist = haversineM({ lat: h.lat, lng: h.lng }, d);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    if (best && bestDist < 30_000) {
      best.hotspots += 1;
      best.frpSum += h.frp;
      h.districtId = best.id;
    }
  }
}

export async function loadAppData(): Promise<AppData> {
  const districts: District[] = CHIANG_MAI_DISTRICTS.map((d) => ({ ...d }));

  const sources: SourceStatus[] = [];
  const settle = async <T,>(p: Promise<T>, ok: SourceStatus, fail: SourceStatus, fb: T): Promise<T> => {
    try { const v = await p; sources.push(ok); return v; }
    catch (e) { console.warn(`[CS] ${fail.name} failed:`, (e as Error).message); sources.push(fail); return fb; }
  };

  const [hotspots, weather, climate] = await Promise.all([
    settle(fetchHotspots(),
      { name: 'NASA/NOAA VIIRS (GISTDA FAIPA feed)', desc: 'จุดความร้อน Suomi-NPP / NOAA-20', status: 'ok', ago: 'real-time' },
      { name: 'NASA/NOAA VIIRS (GISTDA FAIPA feed)', desc: 'จุดความร้อน — ใช้ข้อมูลสำรอง', status: 'down', ago: '—' },
      [] as Hotspot[]),
    settle(fetchWeather(),
      { name: 'Open-Meteo', desc: 'ลม ทิศลม อุณหภูมิ ความชื้น พยากรณ์ฝน', status: 'ok', ago: 'real-time' },
      { name: 'Open-Meteo', desc: 'สภาพอากาศ — ใช้ข้อมูลสำรอง', status: 'down', ago: '—' },
      FALLBACK_WEATHER),
    settle(fetchClimate(),
      { name: 'NASA POWER', desc: 'NDVI proxy · ความชื้นดิน · ดัชนีความแห้ง', status: 'ok', ago: '~1 วัน' },
      { name: 'NASA POWER', desc: 'ภูมิอากาศ — ใช้ข้อมูลสำรอง', status: 'warn', ago: '—' },
      { ndvi: 0.34, soilWetness: 0.28, dryness: 0.82 }),
  ]);

  assignHotspots(districts, hotspots);

  const windFactorProv = clamp(weather.windSpeedKmh / 30, 0, 1);
  const ndviForestOffset: Record<District['forestType'], number> = {
    deciduous: -0.06, mixed: 0.0, evergreen: 0.08, agriculture: -0.02,
  };

  // ── per-district derivation ────────────────────────────────────────────
  for (const d of districts) {
    d.ndvi = round2(clamp(climate.ndvi + ndviForestOffset[d.forestType] + (d.elevationM > 800 ? 0.03 : 0), 0.15, 0.85));
    // drier where high fuel + steep + low elevation basin trapping heat
    d.dryness = round2(clamp(climate.dryness * (0.85 + d.fuelSusc * 0.3), 0, 1));
    const score =
      0.28 * d.dryness +
      0.20 * d.fuelSusc +
      0.16 * clamp(d.slopeDeg / 30, 0, 1) +
      0.22 * clamp(d.hotspots / 8, 0, 1) +
      0.14 * windFactorProv;
    d.fireRisk = fireRiskFromScore(score);
    // PM2.5: regional haze base + local hotspot/maize burning contribution
    d.pm25 = Math.round(
      48 + clamp(d.hotspots * 3.2, 0, 120) + (d.maizeAreaRai / 12000) * 6 + d.dryness * 18,
    );
  }

  // ── province aggregate ─────────────────────────────────────────────────
  const totalHotspots = hotspots.length;
  const totalFrp = round2(hotspots.reduce((s, h) => s + h.frp, 0));
  const avgNdvi = round2(avg(districts.map((d) => d.ndvi)));
  const avgDryness = round2(avg(districts.map((d) => d.dryness)));
  const pm25 = Math.round(avg(districts.map((d) => d.pm25)));
  const provScore =
    0.30 * avgDryness +
    0.20 * avg(districts.map((d) => d.fuelSusc)) +
    0.18 * clamp(totalHotspots / 60, 0, 1) +
    0.18 * windFactorProv +
    0.14 * clamp(weather.dryDays / 14, 0, 1);
  const provFireRisk: RiskLevel = fireRiskFromScore(provScore);

  const totalMaizeRai = districts.reduce((s, d) => s + d.maizeAreaRai, 0);
  const totalForestRai = districts.reduce((s, d) => s + d.forestRai, 0);
  const totalEncroachmentRai = districts.reduce((s, d) => s + d.encroachmentRai, 0);
  const burnedScarRai = estimateBurnScarRai(hotspots);

  const fireTrend = [0.32, 0.41, 0.55, 0.68, 0.83, 1.0].map((f) => Math.round(f * Math.max(totalHotspots, 12)));

  // ── fire-spread simulation from the worst district ─────────────────────
  const ignDistrict = pickIgnition(districts);
  const ignHotspot = hotspots
    .filter((h) => h.districtId === ignDistrict.id)
    .sort((a, b) => b.frp - a.frp)[0];
  const origin = ignHotspot ? { lat: ignHotspot.lat, lng: ignHotspot.lng } : { lat: ignDistrict.lat, lng: ignDistrict.lng };
  const sim = simulateSpread({
    origin,
    originLabelTh: ignDistrict.nameTh,
    weather,
    slopeDeg: ignDistrict.slopeDeg,
    fuelSusc: ignDistrict.fuelSusc,
    dryness: ignDistrict.dryness,
    horizonH: 6,
  });

  const province: AppData['province'] = {
    name: 'Chiang Mai', nameTh: 'เชียงใหม่', lat: CHIANG_MAI_CENTER.lat, lng: CHIANG_MAI_CENTER.lng,
    lastUpdate: nowICT(),
    dataSource: sources.some((s) => s.status === 'ok') ? 'LIVE' : 'MOCK',
    totalHotspots, totalFrp, avgNdvi, avgDryness, pm25, weather, fireRisk: provFireRisk,
    fireTrend, totalMaizeRai, totalForestRai, totalEncroachmentRai, burnedScarRai,
  };

  const alerts = buildAlerts(province, districts, sim);
  const recommendations = buildRecommendations(province, districts, sim);
  const forecast = buildForecast(province, provScore);

  console.info('%c[CropSentinel] ✅ live data', 'color:#f4763b;font-weight:bold', {
    hotspots: totalHotspots, fireRisk: provFireRisk, pm25, wind: `${weather.windSpeedKmh}km/h`,
    rosHead: round2(sim.rosHead), area6h: nf0(sim.finalAreaRai),
  });

  return { province, districts, hotspots, sim, alerts, recommendations, forecast, sources };
}

// ── alerts ────────────────────────────────────────────────────────────────
function buildAlerts(p: AppData['province'], districts: District[], sim: AppData['sim']): Alert[] {
  const out: Alert[] = [];
  const crit = districts.filter((d) => d.fireRisk === 'CRITICAL').map((d) => d.nameTh);
  const high = districts.filter((d) => d.fireRisk === 'HIGH').map((d) => d.nameTh);
  const bearingTh = sim.bearingDeg;

  out.push({
    id: 'spread', level: sim.finalAreaRai > 1500 ? 'crit' : 'risk', confidence: 0.84,
    title: `ไฟลามเร็ว ${Math.round(sim.rosHead)} ม./นาที จาก${sim.originLabelTh}`,
    titleEn: `Head fire ${Math.round(sim.rosHead)} m/min from ${sim.originLabelTh}`,
    body: `จำลองด้วยลม ${p.weather.windSpeedKmh} กม./ชม. คาดไฟลามทิศ ${Math.round(bearingTh)}° ครอบคลุม ~${nf0(sim.finalAreaRai)} ไร่ ภายใน ${sim.horizonH} ชม. — เร่งตัดแนวกันไฟด้านหัวไฟ`,
    tag: 'ไฟลาม',
  });

  if (p.totalHotspots > 0) {
    out.push({
      id: 'hotspot', level: p.totalHotspots > 40 ? 'crit' : 'risk', confidence: 0.92,
      title: `จุดความร้อน ${p.totalHotspots} จุด (VIIRS) · FRP รวม ${nf0(p.totalFrp)} MW`,
      titleEn: `${p.totalHotspots} active VIIRS hotspots`,
      body: `ตรวจพบจุดความร้อนสะสมในรอบล่าสุด พื้นที่หนาแน่น: ${[...crit, ...high].slice(0, 3).join(', ') || 'กระจายหลายอำเภอ'}`,
      tag: 'จุดความร้อน',
    });
  }

  if (p.pm25 > 50) {
    out.push({
      id: 'pm25', level: p.pm25 > 90 ? 'crit' : p.pm25 > 55 ? 'risk' : 'warn', confidence: 0.9,
      title: `PM2.5 ${p.pm25} μg/m³ จากการเผาในที่โล่ง`,
      titleEn: `PM2.5 ${p.pm25} μg/m³ from open burning`,
      body: `หมอกควันจากไฟป่าและการเผาตอซังข้าวโพด (WHO ≤15) กระทบสุขภาพและทัศนวิสัยการบิน`,
      tag: 'หมอกควัน',
    });
  }

  const encroach = [...districts].sort((a, b) => b.encroachmentRai - a.encroachmentRai)[0];
  out.push({
    id: 'encroach', level: 'warn', confidence: 0.71,
    title: `บุกรุกป่าเพื่อปลูกข้าวโพด — ${encroach.nameTh} ${nf0(encroach.encroachmentRai)} ไร่`,
    titleEn: `Forest encroachment for maize — ${encroach.name}`,
    body: `ตรวจพบการเปลี่ยนแปลงพื้นที่ป่าเป็นแปลงข้าวโพดสะสม ${nf0(p.totalEncroachmentRai)} ไร่ทั้งจังหวัด ควรตรวจสอบภาคสนาม`,
    tag: 'บุกรุกป่า',
  });

  return out;
}

// ── recommendations ─────────────────────────────────────────────────────────
function buildRecommendations(p: AppData['province'], districts: District[], sim: AppData['sim']) {
  const crit = districts.filter((d) => d.fireRisk === 'CRITICAL');
  const topMaize = [...districts].sort((a, b) => b.maizeAreaRai - a.maizeAreaRai).slice(0, 2);
  const critTh = crit.map((d) => d.nameTh).join(' · ') || topMaize.map((d) => d.nameTh).join(' · ');

  const firefighter: Recommendation[] = [
    {
      urgency: 'urgent', icon: '!',
      title: `ตัดแนวกันไฟด้านหัวไฟ ทิศ ${Math.round(sim.bearingDeg)}° ที่${sim.originLabelTh}`,
      desc: `ไฟลาม ${Math.round(sim.rosHead)} ม./นาที ตามลม ${p.weather.windSpeedKmh} กม./ชม. เข้าทำแนวด้านข้างไฟ (flank) เท่านั้น ห้ามเข้าด้านหัวไฟหรือร่องเขาที่ไฟวิ่งขึ้น`,
      meta: [`ROS ${Math.round(sim.rosHead)} ม./นาที`, `คาด ~${nf0(sim.finalAreaRai)} ไร่/${sim.horizonH} ชม.`, `ลม→ ${Math.round(sim.bearingDeg)}°`],
    },
    {
      urgency: crit.length ? 'urgent' : 'soft', icon: '◐',
      title: `ส่งชุดเฝ้าระวังเข้าพื้นที่วิกฤติ ${critTh}`,
      desc: `เชื้อเพลิงใบไม้แห้งหนาแน่นและความชันสูง วางจุดสกัดบนสันเขาเหนือลม เตรียมเส้นทางถอยก่อนเข้าปฏิบัติการ`,
      meta: [`อำเภอเสี่ยงวิกฤติ: ${crit.length}`, `ความชื้น ${p.weather.humidity}%`, `ลมกระโชก ${p.weather.windGustKmh} กม./ชม.`],
    },
    {
      urgency: 'good', icon: '✓',
      title: 'ใช้ภาพ VIIRS อัปเดตทุกรอบดาวเทียมยืนยันจุดดับ',
      desc: 'หลังดับไฟให้ตรวจ FRP รอบถัดไปเพื่อยืนยันไฟสงบ ลดความเสี่ยงไฟปะทุซ้ำตอนกลางคืน',
      meta: [`จุดความร้อน ${p.totalHotspots}`, `กลางคืน เฝ้าระวังลมเปลี่ยนทิศ`],
    },
  ];

  const lgu: Recommendation[] = [
    {
      urgency: p.fireRisk === 'CRITICAL' || p.fireRisk === 'HIGH' ? 'urgent' : 'soft', icon: '!',
      title: `ประกาศห้ามเผาและเปิดศูนย์บัญชาการ — ระดับ ${p.fireRisk}`,
      desc: `ความเสี่ยงไฟป่าระดับ ${p.fireRisk} จาก ${p.totalHotspots} จุดความร้อนและความแห้ง ${Math.round(p.avgDryness * 100)}% บังคับใช้ช่วงห้ามเผาและประสานชุดดับไฟ อปท.`,
      meta: [`จุดความร้อน: ${p.totalHotspots}`, `ความแห้ง: ${Math.round(p.avgDryness * 100)}%`, `PM2.5: ${p.pm25}`],
    },
    {
      urgency: p.pm25 > 90 ? 'urgent' : 'soft', icon: '◐',
      title: `แจ้งเตือนสุขภาพ PM2.5 ${p.pm25} μg/m³`,
      desc: `เปิดห้องปลอดฝุ่นและแจกหน้ากากในเขตเมืองและกลุ่มเปราะบาง สื่อสารงดกิจกรรมกลางแจ้งเมื่อค่าฝุ่นเกินมาตรฐาน`,
      meta: [`PM2.5: ${p.pm25}`, `แหล่ง: ไฟป่า + เผาตอซัง`],
    },
    {
      urgency: 'soft', icon: '◐',
      title: `บังคับใช้แนวเขตป่า — บุกรุก ${nf0(p.totalEncroachmentRai)} ไร่`,
      desc: `ใช้ภาพถ่ายดาวเทียมเทียบรายปีตรวจการเปลี่ยนป่าเป็นแปลงข้าวโพด ส่งชุดตรวจสอบและสนับสนุนการปรับเปลี่ยนอาชีพ`,
      meta: [`บุกรุกสะสม: ${nf0(p.totalEncroachmentRai)} ไร่`, `พื้นที่ข้าวโพด: ${nf0(Math.round(p.totalMaizeRai / 1000))}k ไร่`],
    },
  ];

  const farmer: Recommendation[] = [
    {
      urgency: 'urgent', icon: '!',
      title: 'งดเผาตอซังข้าวโพด — ใช้การไถกลบ/อัดก้อน',
      desc: `ช่วงความแห้ง ${Math.round(p.avgDryness * 100)}% และลมแรง การเผาเสี่ยงลามเข้าป่า เปลี่ยนเป็นไถกลบหรืออัดฟางขายเป็นอาหารสัตว์เพื่อรายได้เสริม`,
      meta: [`ความแห้ง: ${Math.round(p.avgDryness * 100)}%`, `ลม: ${p.weather.windSpeedKmh} กม./ชม.`, 'ลดจุดความร้อน'],
    },
    {
      urgency: 'soft', icon: '◐',
      title: `ทำแนวกันไฟรอบแปลงในพื้นที่ ${topMaize.map((d) => d.nameTh).join(' · ')}`,
      desc: 'จัดทำแนวกันไฟกว้าง 8–10 เมตรรอบแปลงข้าวโพดที่ติดชายป่า ลดโอกาสไฟจากแปลงลามเข้าเขตป่าอนุรักษ์',
      meta: [`แปลงข้าวโพดใหญ่สุด: ${topMaize[0].nameTh}`, `${nf0(topMaize[0].maizeAreaRai)} ไร่`],
    },
    {
      urgency: 'good', icon: '✓',
      title: 'ลงทะเบียนรับแจ้งเตือนไฟล่วงหน้าผ่าน LINE',
      desc: 'รับพิกัดจุดความร้อนและทิศทางลมรายวันเพื่อวางแผนเก็บเกี่ยวและเฝ้าระวังแปลงของตนเองเชิงรุก',
      meta: ['เตือนล่วงหน้า', 'รายแปลง'],
    },
  ];

  return { firefighter, lgu, farmer };
}

// ── 8-week forecast ─────────────────────────────────────────────────────────
function buildForecast(p: AppData['province'], provScore: number) {
  const weeks = Array.from({ length: 8 }, (_, i) => `W${i + 1}`);
  const base = clamp(provScore, 0.1, 0.95);
  // dry season escalation (more wind/heat) then mild relief
  const shape = [1.0, 1.06, 1.12, 1.18, 1.2, 1.16, 1.08, 0.98];
  const fireRiskIdx = shape.map((s) => Math.round(clamp(base * s, 0, 1) * 100));
  const pm25 = shape.map((s) => Math.round(clamp(p.pm25 * s, 0, 260)));
  let cum = p.burnedScarRai;
  const burnedRai = fireRiskIdx.map((idx) => {
    cum += Math.round((idx / 100) * 900);
    return cum;
  });
  return { weeks, fireRiskIdx, pm25, burnedRai };
}
