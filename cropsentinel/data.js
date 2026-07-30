// CropSentinel — ข้อมูลฐานอุปทานข้าว จ.ปทุมธานี
//
// อำเภอ พื้นที่ข้าว ขอบเขตแผนที่ และความถี่น้ำท่วม มาจาก window.CS_GISTDA
// ซึ่ง build-gistda-baseline.py ดึงมาจากบริการข้อมูลเปิดของ GISTDA โดยตรง
// ค่าที่ยังเป็นการประมาณ (NDVI, PM2.5, ความชื้นดิน) ถูกทำเครื่องหมาย estimated:true
// และ api-fetch.js จะเขียนทับด้วยค่าที่วัดได้จริงเมื่อเรียก API สำเร็จ
const G = window.CS_GISTDA;
if (!G) throw new Error("ต้องโหลด gistda-baseline.js ก่อน data.js");

// รหัสภาษาอังกฤษของอำเภอ ใช้เป็น id ภายในและป้ายกำกับสองภาษา
const AMPHOE_EN = {
  "เมืองปทุมธานี": ["mueang", "Mueang Pathum Thani"],
  "คลองหลวง": ["khlongluang", "Khlong Luang"],
  "ธัญบุรี": ["thanyaburi", "Thanyaburi"],
  "หนองเสือ": ["nongsuea", "Nong Suea"],
  "ลาดหลุมแก้ว": ["lat-lum-kaeo", "Lat Lum Kaeo"],
  "ลำลูกกา": ["lamlukka", "Lam Luk Ka"],
  "สามโคก": ["samkhok", "Sam Khok"],
};

// ความถี่น้ำท่วมซ้ำซาก 2548-2559 (สูงสุด 7 ครั้ง) ปรับเป็นสัดส่วน 0-1
// นี่คือความเสี่ยงเชิงประวัติศาสตร์ ไม่ใช่สถานะน้ำท่วมวันนี้ — คนละเรื่องกัน
const MAX_FLOOD_FREQ = 7;

window.CS_DATA = {
  overview: {
    // ปทุมธานีเป็นพื้นที่ชลประทานเกือบทั้งจังหวัด ทำนาปรัง ใช้พันธุ์ไม่ไวแสง
    // (กข31/กข41/กข47) ไม่ใช่ข้าวหอมมะลิซึ่งเป็นข้าวนาปีอาศัยน้ำฝนของอีสาน/เหนือ
    cropLabelTh: "ข้าวนาปรัง · พันธุ์ไม่ไวแสง",
    shortageWarningWeeks: 6,
    primaryAudienceTh: "เกษตรกรรายย่อย",
    secondaryAudienceTh: "อปท./รัฐบาล · ผู้ค้าปลีก/โลจิสติกส์",
    positioningTh: "วัดความเสี่ยงอาหาร → ป้องกันวิกฤต",
  },

  province: {
    name: "Pathum Thani",
    nameTh: G.province.nameTh,
    areaRai: G.province.areaRai,          // 953,660 ไร่ — พื้นที่จังหวัดทั้งหมด
    riceRai: G.province.riceRai,          // พื้นที่ข้าวจริงจากภาพดาวเทียม
    riceShare: G.province.riceShareOfProvince,
    riceParcels: G.province.riceParcels,
    totalFarmland: G.province.riceRai,    // ชื่อเดิม ชี้ไปที่พื้นที่ข้าวจริง
    riceAsOfTh: G.source.riceLabelTh,
    ricePixelM: G.source.ricePixelM,      // 40 ม. = 1,600 ตร.ม. = 1 ไร่ ต่อ 1 จุดภาพ
    productKgPerRai: G.province.productKgPerRai,
    mills: G.mills,
    // ค่าประมาณ รอ api-fetch.js เขียนทับ
    avgNDVI: 0.65, pm25: 45, soilMoisture: 0.42, waterStress: 58, dryDays: 9,
    floodRisk: "HIGH", droughtRisk: "MEDIUM",
    estimated: ["avgNDVI", "pm25", "soilMoisture", "waterStress", "dryDays"],
  },

  // ช่วงเก็บเกี่ยวและโครงการชลประทาน — ใช้เป็นฐานของภารกิจ
  harvestWindows: G.harvestWindows,
  irrigationProjects: G.irrigationProjects,

  // อำเภอทั้ง 7 ของปทุมธานี ตามชั้นขอบเขตการปกครองของ GISTDA
  // รูปร่างบนแผนที่คือขอบเขตจริงที่ฉายลงผืนผ้าใบ 600x440 ไม่ใช่รูปวาดมือ
  //
  // หมายเหตุ: เวอร์ชันก่อนหน้าใส่ "รังสิต" เป็นอำเภอ ซึ่งไม่ถูกต้อง — รังสิตเป็น
  // เขตเทศบาลในอำเภอธัญบุรี ส่วนอำเภอที่หายไปคือลำลูกกา ซึ่งเป็นหนึ่งในอำเภอ
  // ที่มีพื้นที่ข้าวมากที่สุด ตรวจสอบได้จากชั้น L05_Amphoe_GISTDA_50k
  districts: G.districts.map((d) => {
    const [id, nameEn] = AMPHOE_EN[d.nameTh];
    const floodFreq = (d.floodMaxFreq || 0) / MAX_FLOOD_FREQ;
    return {
      id,
      name: nameEn,
      nameTh: d.nameTh,
      poly: d.poly,
      // ---- วัดได้จริง ----
      riceRai: d.riceRai,                    // ไร่ จากภาพดาวเทียมรายแปลง
      floodFreq,                             // 0-1 จากความถี่น้ำท่วมซ้ำซาก 2548-2559
      floodFreqCount: d.floodMaxFreq,        // จำนวนครั้งที่ท่วมสูงสุดในอำเภอ
      floodExposureRai: d.floodExposureRai,  // ไร่-ครั้ง สะสมทุกเหตุการณ์
      // ชื่อเดิมที่โมดูลอื่นยังเรียกใช้ ชี้ไปที่ค่าจริงชุดเดียวกัน
      farmland: d.riceRai,
      flood: floodFreq,
      risk: floodFreq >= 0.85 ? "CRITICAL" : floodFreq >= 0.7 ? "HIGH" : floodFreq >= 0.5 ? "MEDIUM" : "LOW",
      // ---- ค่าประมาณ api-fetch.js เขียนทับเมื่อเรียก API สำเร็จ ----
      ndvi: 0.62, drought: 0.45, droughtRisk: "MEDIUM",
      waterStress: 50, soilMoisture: 0.42, pm25: 45,
      estimated: ["ndvi", "drought", "droughtRisk", "waterStress", "soilMoisture", "pm25"],
    };
  }),

  // 8-week forecast
  weeks: Array.from({ length: 8 }, (_, i) => `W${i + 1}`),
  supply: {
    current: 180,
    readiness: 77,
    projected: [180, 177, 173, 166, 158, 149, 144, 140], // tons ('000)
    demand:    [178, 179, 180, 182, 182, 184, 185, 186],
  },
  price: {
    // THB / ton
    actual: [9200, 9260, 9380, 9510, 9720, 10020, 10380, 10860],
    band_low:  [9100, 9120, 9200, 9280, 9420, 9640, 9880, 10180],
    band_high: [9300, 9400, 9560, 9740, 10020, 10400, 10880, 11540],
  },

  alerts: [
    {
      id: "a1", level: "risk", confidence: 0.89,
      title: "เสี่ยงน้ำท่วมสูง — พื้นที่รังสิต",
      titleEn: "Flood Risk HIGH — Rangsit area",
      body: "แบบจำลองคาดการณ์น้ำท่วมจากมรสุมบริเวณลุ่มคลองรังสิตภายในสัปดาห์ที่ 3 (±4 วัน)",
      tag: "น้ำท่วม",
    },
    {
      id: "a2", level: "crit", confidence: 0.82,
      title: "คาดการณ์ผลผลิตต่ำกว่าอุปสงค์ 23%",
      titleEn: "Supply Shortage predicted — 23% below demand",
      body: "คาดว่าผลผลิตจะลดเหลือ 140,000 ตัน ในสัปดาห์ที่ 8 เทียบกับอุปสงค์ 186,000 ตัน สาเหตุหลักจาก NDVI ที่ลดลงและความเสี่ยงน้ำท่วม",
      tag: "อุปทาน",
    },
    {
      id: "a3", level: "risk", confidence: 0.76,
      title: "เตือนราคาข้าวพุ่งสูง +18%",
      titleEn: "Price spike alert — +18% projected",
      body: "ราคาข้าวมีแนวโน้มทะลุ 10,800 บาท/ตัน ในสัปดาห์ที่ 8 หากยังขาดแคลนและโควตานำเข้าไม่เพิ่ม",
      tag: "ราคา",
    },
    {
      id: "a4", level: "warn", confidence: 0.68,
      title: "ค่าฝุ่น PM2.5 สูง กระทบการสังเคราะห์แสง",
      titleEn: "PM2.5 elevated — photosynthesis impact",
      body: "PM2.5 เฉลี่ย 45 μg/m³ คาดว่าผลผลิตในพื้นที่เสี่ยงจะลดลง 4-6% หากสภาพนี้ต่อเนื่อง 2 สัปดาห์ขึ้นไป",
      tag: "อากาศ",
    },
    {
      id: "a5", level: "warn", confidence: 0.73,
      title: "เสี่ยงภัยแล้งสะสม — ดินเริ่มขาดความชื้น",
      titleEn: "Drought stress — soil moisture below normal",
      body: "ฝนสะสมต่ำและความชื้นดินเฉลี่ย 0.42 ทำให้บางอำเภอเริ่มมี water stress ควรติดตามแหล่งน้ำและรอบให้น้ำใน 2 สัปดาห์ข้างหน้า",
      tag: "ภัยแล้ง",
    },
  ],

  recommendations: {
    farmer: [
      { urgency: "urgent", icon: "!", title: "เร่งเก็บเกี่ยวในพื้นที่รังสิตและหนองเสือ", desc: "เลื่อนการเก็บเกี่ยวให้เร็วขึ้น 10-14 วัน เพื่อหลีกเลี่ยงน้ำท่วมช่วงสัปดาห์ที่ 3 ติดต่อสหกรณ์เพื่อใช้รถเกี่ยวร่วมกัน", meta: ["พื้นที่: 2 เขต", "กำหนด: 7 วัน", "ผลผลิตลดลง ~6%"] },
      { urgency: "soft", icon: "!", title: "ปรับรอบให้น้ำในแปลงที่ดินเริ่มแห้ง", desc: "พื้นที่ที่มี soil moisture ต่ำกว่า 0.40 ควรเพิ่มการติดตามน้ำในแปลงและลดการปล่อยน้ำทิ้งช่วงกลางวัน เพื่อลด water stress", meta: ["ภัยแล้ง: MEDIUM", "soil moisture: 0.42", "dry days: 9"] },
      { urgency: "soft", icon: "◐", title: "พิจารณาเปลี่ยนพันธุ์ KDML105 → กข79", desc: "สำหรับฤดูกาลเพาะปลูกหน้าในแปลงเสี่ยงน้ำท่วม พันธุ์ กข79 ทนน้ำท่วมได้ 14 วัน เทียบกับ 5 วันของพันธุ์เดิม", meta: ["ฤดู: ถัดไป", "รัฐอุดหนุน: มี"] },
      { urgency: "good", icon: "✓", title: "NDVI ในลาดหลุมแก้วอยู่ในเกณฑ์ดี", desc: "ไม่ต้องดำเนินการ รักษาตารางการให้น้ำแบบเปียกสลับแห้งตามปกติ", meta: ["NDVI: 0.74", "สถานะ: คงที่"] },
    ],
    lgu: [
      { urgency: "urgent", icon: "!", title: "เริ่มพิจารณาโควตานำเข้าข้าว", desc: "คาดว่าจะขาดแคลน 46,000 ตัน ในสัปดาห์ที่ 8 แนะนำให้เริ่มเจรจารัฐต่อรัฐ (เวียดนาม เมียนมา) โดยทันที", meta: ["ขาดแคลน: 46,000 ตัน", "ระยะเวลานำเข้า: 6 สัปดาห์"] },
      { urgency: "soft", icon: "!", title: "เตรียมแผนจัดสรรน้ำหากฝนต่ำต่อเนื่อง", desc: "ติดตาม dry days และ soil moisture รายอำเภอ หากพื้นที่เสี่ยงสูงเกิน 3 อำเภอ ให้เตรียมรอบส่งน้ำสำรองและประกาศคำแนะนำลดการใช้น้ำ", meta: ["dry days: 9", "water stress: 58%", "หน่วยงานน้ำ: เฝ้าระวัง"] },
      { urgency: "soft", icon: "◐", title: "เตรียมความพร้อมรับมือน้ำท่วมรังสิต", desc: "จัดวางกระสอบทรายและเครื่องสูบน้ำที่คลังคลองหลวงและธัญบุรีก่อนสัปดาห์ที่ 2", meta: ["งบประมาณ: 24 ล้านบาท", "อำเภอ: 2"] },
      { urgency: "soft", icon: "◐", title: "หารือมาตรการเพดานราคา", desc: "เชิญกระทรวงพาณิชย์ประชุมหากราคาเกิน 10,500 บาท/ตัน เพื่อป้องกันผลกระทบต่อผู้บริโภค", meta: ["กระตุ้น: สัปดาห์ที่ 6", "ความเชื่อมั่น: 76%"] },
    ],
    retailer: [
      { urgency: "urgent", icon: "!", title: "เพิ่มสต็อกข้าวหอมมะลิเป็น 6 สัปดาห์", desc: "ล็อกราคาสต็อก 6 สัปดาห์ทันทีก่อนราคาพุ่งในสัปดาห์ที่ 5-8 ประหยัดได้ประมาณ 8.2% เทียบกับซื้อตลาดจร", meta: ["SKU: KDML105", "เพิ่ม: +40%"] },
      { urgency: "soft", icon: "◐", title: "ซัพพลายเออร์สำรองในนครสวรรค์", desc: "กระจายความเสี่ยงจากปทุมธานี เปิดใช้สัญญาสำรองในจังหวัดที่ไม่ได้รับผลกระทบ", meta: ["ตัวเลือก: 3", "เริ่ม: สัปดาห์ที่ 2"] },
      { urgency: "good", icon: "✓", title: "ข้าวหักยังคงเสถียร", desc: "ไม่ต้องปรับราคา กข6 และสายการผลิตข้าวหัก ความยืดหยุ่นของอุปสงค์ยังอยู่ในระดับปกติ", meta: ["SKU: 4", "กำไร: ±0%"] },
    ],
  },
};
