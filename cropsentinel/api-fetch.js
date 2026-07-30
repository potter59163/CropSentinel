// CropSentinel — Real-data integration layer
// Sources: Open-Meteo (weather/flood), WAQI (PM2.5), NASA POWER (NDVI proxy)
// No API keys required for any of these services.

(async function csDataFetch() {
  const D = window.CS_DATA;

  // ── helpers ──────────────────────────────────────────────────────────────
  function avg(arr) {
    const valid = arr.filter(v => v != null && v > -990);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round2(v) { return Math.round(v * 100) / 100; }

  // Pathum Thani centroid
  const LAT = 14.0208, LON = 100.5250;

  // Timestamp "now"
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} ICT`;
  D.province.lastUpdate = dateStr;

  // ── flood-risk thresholds (mm / 7-day) ───────────────────────────────────
  function floodLevel(mm7) {
    if (mm7 > 120) return 'CRITICAL';
    if (mm7 >  70) return 'HIGH';
    if (mm7 >  30) return 'MEDIUM';
    return 'LOW';
  }
  function droughtLevel(score) {
    if (score >= 0.78) return 'CRITICAL';
    if (score >= 0.52) return 'HIGH';
    if (score >= 0.32) return 'MEDIUM';
    return 'LOW';
  }

  // ── helpers for supply/price labels ─────────────────────────────────────
  function fmt1(v) { return Math.round(v * 10) / 10; }

  // ── district base flood susceptibility (0–1) ─────────────────────────────
  // Derived from historic flood-maps and canal density in Pathum Thani
  const FLOOD_SUSC = {
    'mueang':       0.55,
    'khlongluang':  0.72,
    'thanyaburi':   0.66,
    'nongsuea':     0.88,   // น้ำท่วมซ้ำซาก
    'lat-lum-kaeo': 0.33,   // terrain slightly higher
    'samkhok':      0.48,
    'lamlukka':      0.95,   // ลำลูกกา — ปลายคลองรังสิต
  };

  // District sensitivity to water stress (0-1), higher = dries out faster.
  const DROUGHT_SUSC = {
    'mueang':       0.58,
    'khlongluang':  0.68,
    'thanyaburi':   0.74,
    'nongsuea':     0.82,
    'lat-lum-kaeo': 0.46,
    'samkhok':      0.54,
    'lamlukka':      0.86,
  };

  const SOIL_OFFSET = {
    'mueang':       +0.03,
    'khlongluang':  -0.03,
    'thanyaburi':   -0.06,
    'nongsuea':     -0.08,
    'lat-lum-kaeo': +0.07,
    'samkhok':      +0.02,
    'lamlukka':      -0.10,
  };

  // ── per-district PM2.5 offset from province centroid ──────────────────────
  const PM25_OFFSET = {
    'mueang':       -3,
    'khlongluang':  +6,
    'thanyaburi':   +9,
    'nongsuea':     +2,
    'lat-lum-kaeo': -8,
    'samkhok':      -2,
    'lamlukka':      +14,  // ใกล้นิคมอุตสาหกรรม + มอเตอร์เวย์
  };

  // ── per-district NDVI offset from province average ───────────────────────
  const NDVI_OFFSET = {
    'mueang':       +0.06,
    'khlongluang':  -0.03,
    'thanyaburi':   -0.07,
    'nongsuea':     -0.11,
    'lat-lum-kaeo': +0.09,
    'samkhok':      +0.03,
    'lamlukka':      -0.16,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH 1 — Open-Meteo: weather + 14-day precipitation forecast
  // https://open-meteo.com  (free, no API key, CORS-OK)
  // ═══════════════════════════════════════════════════════════════════════════
  let week1Rain = 0, week2Rain = 0, currentTemp = 30, currentHumidity = 78;
  let dryDays = D.province.dryDays ?? 9;
  let soilMoistureBase = D.province.soilMoisture ?? 0.42;

  try {
    const meteoURL =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${LAT}&longitude=${LON}` +
      '&current=temperature_2m,precipitation,rain,relative_humidity_2m,wind_speed_10m' +
      '&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&forecast_days=14&timezone=Asia%2FBangkok';

    const meteo = await fetch(meteoURL).then(r => r.json());

    currentTemp     = meteo.current?.temperature_2m     ?? currentTemp;
    currentHumidity = meteo.current?.relative_humidity_2m ?? currentHumidity;

    const dp = meteo.daily?.precipitation_sum ?? [];
    week1Rain = dp.slice(0, 7).reduce((s, v) => s + (v ?? 0), 0);  // mm next 7 days
    week2Rain = dp.slice(7, 14).reduce((s, v) => s + (v ?? 0), 0); // mm days 8-14
    dryDays = dp.slice(0, 14).filter(v => (v ?? 0) < 1).length;

    // Province-level flood risk from real precipitation
    D.province.floodRisk = floodLevel(week1Rain);

    // Per-district flood score  (susceptibility × rainfall ratio)
    D.districts.forEach(d => {
      const susc = FLOOD_SUSC[d.id] ?? 0.60;
      const raw  = clamp(susc * (week1Rain / 90), 0, 1);   // 90 mm = reference
      d.flood    = round2(raw);
      d.risk     = raw >= 0.75 ? 'CRITICAL' : raw >= 0.50 ? 'HIGH' : raw >= 0.25 ? 'MEDIUM' : 'LOW';
    });

    // Store live weather for UI badge
    D.province.weatherTemp     = Math.round(currentTemp);
    D.province.weatherHumidity = Math.round(currentHumidity);
    D.province.weekRain        = Math.round(week1Rain);
    D.province.dryDays         = dryDays;
    D.province.dataSource      = 'LIVE';

    console.info('[CS] Open-Meteo ✓', { week1Rain: Math.round(week1Rain), floodRisk: D.province.floodRisk });
  } catch (e) {
    console.warn('[CS] Open-Meteo fetch failed, using mock flood data:', e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH 2 — Open-Meteo Air Quality: PM2.5 ที่พิกัดปทุมธานีจริง
  //
  // เดิมใช้ WAQI ด้วย token=demo ซึ่งเป็นโทเคนสาธารณะที่ใช้ร่วมกันทั้งโลก
  // มันคืนค่าจาก "สถานีที่ใกล้ที่สุดเท่าที่โทเคนสาธิตเข้าถึงได้" ซึ่งอาจอยู่คนละ
  // ประเทศ แล้วเราเอามาแสดงเป็นค่าของปทุมธานี — ตัวเลขจึงไม่ตรงกับพื้นที่ที่อ้าง
  // Open-Meteo คืนค่าที่พิกัดที่ขอจริง ไม่ต้องใช้คีย์ และเปิด CORS เหมือนกัน
  // ═══════════════════════════════════════════════════════════════════════════
  let pm25Base = null;   // null = ยังไม่มีค่าที่วัดได้ ห้ามเดา

  try {
    const aqURL = `https://air-quality-api.open-meteo.com/v1/air-quality`
      + `?latitude=${LAT}&longitude=${LON}&current=pm2_5&timezone=Asia%2FBangkok`;
    const aq = await fetch(aqURL).then(r => r.json());
    const v = aq?.current?.pm2_5;

    if (typeof v === 'number' && isFinite(v)) {
      pm25Base = Math.round(v);
      D.province.pm25 = pm25Base;
      D.province.pm25Source = 'Open-Meteo Air Quality';
      D.districts.forEach(d => {
        d.pm25 = Math.max(1, Math.round(pm25Base + (PM25_OFFSET[d.id] ?? 0)));
        d.pm25Estimated = true;   // ค่าจังหวัดวัดได้ ส่วนการกระจายรายอำเภอเป็นค่าประมาณ
      });
      console.info('[CS] Open-Meteo AQ ✓', { pm25: pm25Base });
    } else {
      throw new Error('ไม่มีค่า pm2_5 ในผลลัพธ์');
    }
  } catch (e) {
    // ล้มเหลวแล้วต้องแสดงว่าไม่มีข้อมูล ไม่ใช่แสดงตัวเลขปลอมว่าวัดได้
    console.warn('[CS] Open-Meteo AQ ล้มเหลว:', e.message);
    D.province.pm25 = null;
    D.province.pm25Source = null;
    D.districts.forEach(d => { d.pm25 = null; d.pm25Estimated = true; });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH 3 — NASA POWER: 30-day climate → NDVI proxy
  // https://power.larc.nasa.gov  (free, no API key, CORS-OK)
  // Parameters: GWETROOT (root-zone soil wetness), solar radiation, temp, rain
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    // Use recent 30-day window (up to ~5 days ago — POWER latency)
    const refEnd = new Date(now);
    refEnd.setDate(refEnd.getDate() - 5);
    const refStart = new Date(refEnd);
    refStart.setDate(refStart.getDate() - 29);

    const fmt = d =>
      `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;

    const powerURL =
      'https://power.larc.nasa.gov/api/temporal/daily/point' +
      '?parameters=GWETROOT,ALLSKY_SFC_SW_DWN,T2M,RH2M,PRECTOTCORR' +
      '&community=AG' +
      `&longitude=${LON}&latitude=${LAT}` +
      `&start=${fmt(refStart)}&end=${fmt(refEnd)}` +
      '&format=JSON';

    const power  = await fetch(powerURL).then(r => r.json());
    const param  = power.properties?.parameter;

    if (param) {
      const gwetArr  = Object.values(param.GWETROOT            ?? {});
      const solarArr = Object.values(param.ALLSKY_SFC_SW_DWN   ?? {});
      const tempArr  = Object.values(param.T2M                 ?? {});

      const avgGwet  = avg(gwetArr)  ?? 0.55;   // 0–1 soil wetness
      const avgSolar = avg(solarArr) ?? 16;     // MJ/m²/day
      const avgTemp  = avg(tempArr)  ?? 30;     // °C
      soilMoistureBase = round2(clamp(avgGwet, 0.15, 0.90));
      D.province.soilMoisture = soilMoistureBase;

      // NDVI proxy for rice in tropical wet season:
      //   • soil wetness: optimal 0.55–0.80 for rice (paddy needs water but not waterlogged)
      //   • solar: 15–25 MJ/m²/day → photosynthesis
      //   • temp: 25–35°C → rice thrives
      const gwetScore  = avgGwet  > 0.80
        ? clamp(1 - (avgGwet - 0.80) * 2, 0.3, 1)   // penalise waterlogging
        : clamp(avgGwet / 0.75,            0.2, 1);

      const solarScore = clamp(avgSolar / 22, 0.4, 1);
      const tempScore  = avgTemp >= 25 && avgTemp <= 35
        ? 1 - Math.abs(avgTemp - 30) / 10
        : 0.5;

      const baseNDVI = clamp(0.30 + 0.55 * gwetScore * solarScore * tempScore, 0.20, 0.90);
      D.province.avgNDVI = round2(baseNDVI);

      // Per-district NDVI with fixed geographic offsets
      D.districts.forEach(d => {
        d.ndvi = round2(clamp(baseNDVI + (NDVI_OFFSET[d.id] ?? 0), 0.20, 0.92));
      });

      console.info('[CS] NASA POWER ✓', { avgGwet: round2(avgGwet), avgSolar: round2(avgSolar), baseNDVI: round2(baseNDVI) });
    }
  } catch (e) {
    console.warn('[CS] NASA POWER fetch failed, using mock NDVI:', e.message);
    D.province.soilMoisture = soilMoistureBase;
    // Still apply offsets from mock base
    D.districts.forEach(d => {
      d.ndvi = round2(clamp(D.province.avgNDVI + (NDVI_OFFSET[d.id] ?? 0), 0.20, 0.92));
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED — Supply & Price Projection (weather-adjusted)
  // OAE 2024-25 anchor: KDML105 paddy ≈ ฿9,200/ton current season
  // Supply model: weekly decline driven by water risk + NDVI
  // ═══════════════════════════════════════════════════════════════════════════

  // Stress index: blend flood rain intensity + drought pressure + average district NDVI deficit
  const ndviAvg     = D.districts.reduce((s, d) => s + d.ndvi, 0) / D.districts.length;
  const ndviDeficit = clamp((0.70 - ndviAvg) / 0.40, 0, 1);   // 0 = healthy, 1 = very stressed
  const rainStress  = clamp(week1Rain / 120, 0, 1);            // 120 mm = max reference
  const droughtRainStress = 1 - clamp((week1Rain + week2Rain * 0.5) / 80, 0, 1);
  const soilDryness = 1 - clamp(soilMoistureBase / 0.70, 0, 1);
  const heatStress = clamp((currentTemp - 32) / 8, 0, 1);
  const droughtScore = clamp(
    0.35 * droughtRainStress +
    0.30 * soilDryness +
    0.20 * ndviDeficit +
    0.15 * heatStress,
    0,
    1
  );

  D.province.droughtRisk = droughtLevel(droughtScore);
  D.province.waterStress = Math.round(droughtScore * 100);

  D.districts.forEach(d => {
    const districtSoil = clamp(soilMoistureBase + (SOIL_OFFSET[d.id] ?? 0), 0.12, 0.90);
    const localNdviDeficit = clamp((0.70 - d.ndvi) / 0.40, 0, 1);
    const localDrought = clamp(
      droughtScore * (0.72 + (DROUGHT_SUSC[d.id] ?? 0.60) * 0.42) +
      localNdviDeficit * 0.16 -
      districtSoil * 0.10,
      0,
      1
    );
    d.soilMoisture = round2(districtSoil);
    d.drought = round2(localDrought);
    d.waterStress = Math.round(localDrought * 100);
    d.droughtRisk = droughtLevel(localDrought);
  });

  const stressIndex = clamp(0.45 * rainStress + 0.30 * droughtScore + 0.25 * ndviDeficit, 0, 1);  // 0–1

  // Weekly supply decline: 1.5 % base + up to 2 % stress bonus → realistic 10–25 % 8-week drop
  const weeklyDecline = 1 - (0.015 + stressIndex * 0.020);

  const current = D.supply.current;   // keep OAE-anchored starting point (พันตัน)

  // Build 8-week supply array: index 0 = W1 (current), index 7 = W8 (horizon)
  const projArr = [current];
  for (let i = 1; i < 8; i++) {
    projArr.push(fmt1(current * Math.pow(weeklyDecline, i)));
  }
  D.supply.projected = projArr;

  // Readiness: % of W1 demand that current supply covers (capped display at 100)
  D.supply.readiness = Math.min(100, Math.round((current / D.supply.demand[0]) * 100));

  // Price projection: OAE KDML105 paddy anchor + mild supply-demand gap elasticity
  // Calibrated so a 20 % supply gap at week 8 → ~16 % price premium (Thai rice market)
  const anchorPrice = D.price.actual[0];
  D.price.actual = D.supply.projected.map((supply, i) => {
    const gap    = Math.max(0, (D.supply.demand[i] - supply) / D.supply.demand[i]);
    const markup = 1 + gap * 0.80 * (i / 7);   // linear ramp, tops at week 8
    return Math.round(anchorPrice * markup);
  });
  D.price.band_low  = D.price.actual.map(p => Math.round(p * 0.968));
  D.price.band_high = D.price.actual.map(p => Math.round(p * 1.045));

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTS — regenerated from live data
  // ═══════════════════════════════════════════════════════════════════════════
  const critNames  = D.districts.filter(d => d.risk === 'CRITICAL').map(d => d.nameTh);
  const highNames  = D.districts.filter(d => d.risk === 'HIGH').map(d => d.nameTh);
  const droughtCritNames = D.districts.filter(d => d.droughtRisk === 'CRITICAL').map(d => d.nameTh);
  const droughtHighNames = D.districts.filter(d => d.droughtRisk === 'HIGH').map(d => d.nameTh);
  const shortageW8 = Math.max(0, Math.round((D.supply.demand[7] - D.supply.projected[7]) * 10) / 10);
  const priceW8    = D.price.actual[7];
  const priceUpPct = Math.round(((priceW8 - anchorPrice) / anchorPrice) * 100);

  const newAlerts = [];

  // Flood alert (driven by Open-Meteo)
  if (week1Rain > 20 || critNames.length > 0) {
    const floodZones = critNames.length ? critNames.join(', ') : highNames.join(', ');
    newAlerts.push({
      id: 'a1', level: week1Rain > 80 ? 'crit' : 'risk', confidence: 0.87,
      title: `เสี่ยงน้ำท่วม — ฝน ${Math.round(week1Rain)} มม./สัปดาห์ (Open-Meteo Live)`,
      titleEn: `Flood Risk — ${Math.round(week1Rain)} mm/week rain (Open-Meteo Live)`,
      body: `ฝนสะสม 7 วันข้างหน้า ${Math.round(week1Rain)} มม. อุณหภูมิ ${D.province.weatherTemp ?? '--'}°C · ความชื้น ${D.province.weatherHumidity ?? '--'}% — พื้นที่เสี่ยง: ${floodZones || 'ไม่มี'}`,
      tag: 'น้ำท่วม',
    });
  }

  // Drought alert (heuristic from rain deficit + soil moisture + NDVI)
  if (D.province.droughtRisk !== 'LOW' || dryDays >= 5 || soilMoistureBase < 0.55) {
    const droughtZones = [...droughtCritNames, ...droughtHighNames].slice(0, 3).join(', ') || 'พื้นที่นอกเขตชลประทาน';
    newAlerts.push({
      id: 'a5',
      level: D.province.droughtRisk === 'CRITICAL' ? 'crit' : D.province.droughtRisk === 'HIGH' ? 'risk' : 'warn',
      confidence: 0.72,
      title: `${D.province.droughtRisk === 'LOW' ? 'เฝ้าระวังภัยแล้ง' : 'เสี่ยงภัยแล้งสะสม'} — water stress ${D.province.waterStress}%`,
      titleEn: `Drought stress ${D.province.waterStress}% — heuristic water-risk score`,
      body: `ฝน 7 วัน ${Math.round(week1Rain)} มม. · วันฝนน้อย ${dryDays}/14 วัน · soil moisture ${soilMoistureBase.toFixed(2)} — พื้นที่ที่ควรเฝ้าระวัง: ${droughtZones}`,
      tag: 'ภัยแล้ง',
    });
  }

  // Supply shortage alert
  if (shortageW8 > 0) {
    newAlerts.push({
      id: 'a2', level: shortageW8 > 25 ? 'crit' : 'risk', confidence: 0.81,
      title: `คาดผลผลิตต่ำกว่าอุปสงค์ ${shortageW8} พันตัน (สัปดาห์ที่ 8)`,
      titleEn: `Supply gap ${shortageW8}k tons at week-8 horizon`,
      body: `ผลผลิตคาดการณ์ ${D.supply.projected[7]} พันตัน — อุปสงค์ ${D.supply.demand[7]} พันตัน (gap ${shortageW8} พันตัน) · ดัชนีความเครียด ${Math.round(stressIndex * 100)}%`,
      tag: 'อุปทาน',
    });
  }

  // Price spike alert
  if (priceUpPct > 4) {
    newAlerts.push({
      id: 'a3', level: priceUpPct > 14 ? 'risk' : 'warn', confidence: 0.74,
      title: `เตือนราคาข้าวพุ่ง +${priceUpPct}% ใน 8 สัปดาห์`,
      titleEn: `Price spike +${priceUpPct}% projected over 8 weeks`,
      body: `KDML105 คาดแตะ ฿${priceW8.toLocaleString()}/ตัน (จาก ฿${anchorPrice.toLocaleString()}) หากขาดแคลนต่อเนื่องและโควตานำเข้าไม่เพิ่ม`,
      tag: 'ราคา',
    });
  }

  // PM2.5 alert (driven by WAQI)
  if (D.province.pm25 > 35) {
    const pmPeak = [...D.districts].sort((a,b)=>b.pm25-a.pm25)[0];
    newAlerts.push({
      id: 'a4', level: D.province.pm25 > 55 ? 'risk' : 'warn', confidence: 0.92,
      title: `PM2.5 ${D.province.pm25} μg/m³ สูงเกินมาตรฐาน (WAQI Live)`,
      titleEn: `PM2.5 ${D.province.pm25} μg/m³ elevated (WAQI Live)`,
      body: `ค่าฝุ่น PM2.5 ปัจจุบัน ${D.province.pm25} μg/m³ (WHO ≤15) — คาดผลผลิตลด 4-6% หากสภาพนี้ต่อเนื่อง 2 สัปดาห์ สูงสุด: ${pmPeak.nameTh} (${pmPeak.pm25} μg/m³)`,
      tag: 'อากาศ',
    });
  }

  D.alerts = newAlerts.length ? newAlerts : D.alerts;

  // ═══════════════════════════════════════════════════════════════════════════
  // RECOMMENDATIONS — urgency updated from live risk assessment
  // ═══════════════════════════════════════════════════════════════════════════
  const urgentZonesTh = [...critNames, ...highNames].slice(0, 3).join(' · ') || 'ทุกอำเภอ';
  const droughtZonesTh = [...droughtCritNames, ...droughtHighNames].slice(0, 3).join(' · ') || 'แปลงนอกเขตชลประทาน';

  D.recommendations.farmer[0] = {
    urgency: critNames.length ? 'urgent' : D.province.droughtRisk === 'HIGH' || D.province.droughtRisk === 'CRITICAL' ? 'urgent' : 'soft',
    icon: '!',
    title: critNames.length ? `เร่งเก็บเกี่ยวในพื้นที่ ${urgentZonesTh}` : `ปรับรอบให้น้ำในพื้นที่ ${droughtZonesTh}`,
    desc: critNames.length
      ? `ฝนคาดสะสม ${Math.round(week1Rain)} มม./สัปดาห์ เลื่อนการเก็บเกี่ยวให้เร็วขึ้น 10-14 วัน เพื่อหลีกเลี่ยงน้ำท่วมช่วงสัปดาห์ที่ 2-3 ติดต่อสหกรณ์เพื่อใช้รถเกี่ยวร่วมกัน`
      : `water stress ${D.province.waterStress}% และ soil moisture ${soilMoistureBase.toFixed(2)} ควรเพิ่มการตรวจน้ำในแปลง ลดการปล่อยน้ำทิ้งกลางวัน และเตรียมน้ำสำรองใน 7 วัน`,
    meta: critNames.length
      ? [`พื้นที่เสี่ยงน้ำท่วม: ${critNames.length + highNames.length} เขต`, `ฝน: ${Math.round(week1Rain)} มม./สัปดาห์`, `ระดับ: ${D.province.floodRisk}`]
      : [`พื้นที่เสี่ยงแล้ง: ${droughtCritNames.length + droughtHighNames.length} เขต`, `dry days: ${dryDays}/14`, `ระดับ: ${D.province.droughtRisk}`],
  };

  D.recommendations.farmer[1] = {
    urgency: D.province.droughtRisk === 'LOW' ? 'good' : 'soft',
    icon: D.province.droughtRisk === 'LOW' ? '✓' : '!',
    title: 'ติดตามความชื้นดินและ NDWI ก่อนรอบให้น้ำถัดไป',
    desc: `พื้นที่ที่ soil moisture ต่ำกว่า 0.40 ให้ปรับรอบให้น้ำแบบสั้นลงและติดตาม NDVI/NDWI หากดัชนียังลดต่อเนื่องให้แจ้งสหกรณ์เพื่อประสานน้ำสำรอง`,
    meta: [`soil moisture: ${soilMoistureBase.toFixed(2)}`, `water stress: ${D.province.waterStress}%`, `dry days: ${dryDays}`],
  };

  D.recommendations.lgu[0] = {
    urgency: shortageW8 > 20 ? 'urgent' : 'soft',
    icon: '!',
    title: `เริ่มพิจารณาโควตานำเข้าข้าว — gap ${shortageW8} พันตัน`,
    desc: `คาดว่าจะขาดแคลน ${shortageW8} พันตัน ในสัปดาห์ที่ 8 แนะนำให้เริ่มเจรจารัฐต่อรัฐ (เวียดนาม เมียนมา) โดยทันที ระยะเวลานำเข้า ~6 สัปดาห์`,
    meta: [`ขาดแคลน: ${shortageW8} พันตัน`, 'ระยะเวลานำเข้า: 6 สัปดาห์', `ราคาคาด: ฿${priceW8.toLocaleString()}`],
  };

  D.recommendations.lgu[1] = {
    urgency: D.province.droughtRisk === 'CRITICAL' || D.province.droughtRisk === 'HIGH' ? 'urgent' : 'soft',
    icon: '!',
    title: `เตรียมแผนจัดสรรน้ำ — ภัยแล้ง ${D.province.droughtRisk}`,
    desc: `ติดตามพื้นที่ ${droughtZonesTh} หากฝนต่ำต่อเนื่องและ soil moisture ต่ำกว่า 0.40 ให้เตรียมรอบส่งน้ำสำรอง พร้อมสื่อสารคำแนะนำลดการใช้น้ำกับเกษตรกร`,
    meta: [`water stress: ${D.province.waterStress}%`, `dry days: ${dryDays}/14`, `soil moisture: ${soilMoistureBase.toFixed(2)}`],
  };

  D.recommendations.retailer[0] = {
    urgency: priceUpPct > 10 ? 'urgent' : 'soft',
    icon: '!',
    title: `ล็อกสต็อก KDML105 ก่อนราคาพุ่ง +${priceUpPct}%`,
    desc: `ราคาคาดแตะ ฿${priceW8.toLocaleString()}/ตัน ใน 8 สัปดาห์ ล็อกราคาสต็อก 6 สัปดาห์ทันทีก่อนราคาขึ้น ประหยัดได้ประมาณ ${Math.min(priceUpPct - 2, 15)}% เทียบกับซื้อตลาดจร`,
    meta: [`SKU: KDML105`, `ราคาปัจจุบัน: ฿${anchorPrice.toLocaleString()}`, `คาด 8 สัปดาห์: +${priceUpPct}%`],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Signal React that real data is ready → triggers re-render
  // ═══════════════════════════════════════════════════════════════════════════
  window.CS_DATA_LOADED = true;
  window.dispatchEvent(new CustomEvent('cs-data-ready'));

  console.info(
    `%c[CropSentinel] ✅ Live data loaded @ ${dateStr}`,
    'color:#22c55e;font-weight:bold',
    {
      floodRisk: D.province.floodRisk,
      pm25: D.province.pm25,
      avgNDVI: D.province.avgNDVI,
      weekRain: D.province.weekRain,
      supplyW8: D.supply.projected[7],
      priceW8,
    }
  );
})().catch(err => {
  console.error('[CropSentinel] Fatal fetch error:', err);
  window.CS_DATA_LOADED = true;
  window.dispatchEvent(new CustomEvent('cs-data-ready'));
});
