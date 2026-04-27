// CropSentinel — baseline data for Pathum Thani rice supply (overwritten by api-fetch.js)
window.CS_DATA = {
  overview: {
    cropLabelTh: "ข้าว · KDML105",
    shortageWarningWeeks: 6,
    primaryAudienceTh: "เกษตรกรรายย่อย",
    secondaryAudienceTh: "อปท./รัฐบาล · ผู้ค้าปลีก/โลจิสติกส์",
    positioningTh: "วัดความเสี่ยงอาหาร → ป้องกันวิกฤต",
  },

  province: {
    name: "Pathum Thani",
    nameTh: "ปทุมธานี",
    totalFarmland: 1_186_400, // rai
    activeZones: 42,
    avgNDVI: 0.65,
    lastUpdate: "2026-04-22 08:14 ICT",
    pm25: 45,
    floodRisk: "HIGH",
  },

  // Districts — simplified polygons on a 600x440 canvas,
  // shaped roughly to Pathum Thani's 7 amphoe (districts).
  districts: [
    {
      id: "mueang", name: "Mueang Pathum Thani", nameTh: "เมืองปทุมธานี",
      ndvi: 0.71, flood: 0.35, pm25: 42,
      farmland: 168_000, risk: "MEDIUM",
      poly: "310,180 360,168 410,182 430,220 408,260 366,268 330,258 305,226",
    },
    {
      id: "khlongluang", name: "Khlong Luang", nameTh: "คลองหลวง",
      ndvi: 0.62, flood: 0.55, pm25: 48,
      farmland: 204_000, risk: "HIGH",
      poly: "410,182 484,170 520,190 522,244 476,262 430,260 408,260 430,220",
    },
    {
      id: "thanyaburi", name: "Thanyaburi", nameTh: "ธัญบุรี",
      ndvi: 0.58, flood: 0.48, pm25: 51,
      farmland: 132_000, risk: "HIGH",
      poly: "430,260 476,262 522,244 540,282 516,318 470,328 436,310",
    },
    {
      id: "nongsuea", name: "Nong Suea", nameTh: "หนองเสือ",
      ndvi: 0.54, flood: 0.72, pm25: 44,
      farmland: 216_000, risk: "CRITICAL",
      poly: "484,170 556,156 596,186 590,236 552,254 522,244 520,190",
    },
    {
      id: "lat-lum-kaeo", name: "Lat Lum Kaeo", nameTh: "ลาดหลุมแก้ว",
      ndvi: 0.74, flood: 0.22, pm25: 39,
      farmland: 178_000, risk: "LOW",
      poly: "210,178 310,180 305,226 330,258 298,288 244,280 212,244",
    },
    {
      id: "samkhok", name: "Sam Khok", nameTh: "สามโคก",
      ndvi: 0.68, flood: 0.31, pm25: 41,
      farmland: 148_000, risk: "MEDIUM",
      poly: "298,288 330,258 366,268 386,300 370,340 322,352 290,328",
    },
    {
      id: "rangsit", name: "Rangsit (Khlong Rangsit)", nameTh: "รังสิต",
      ndvi: 0.49, flood: 0.82, pm25: 57,
      farmland: 140_400, risk: "CRITICAL",
      poly: "366,268 408,260 436,310 470,328 458,376 410,388 378,362 370,340 386,300",
    },
  ],

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
  ],

  recommendations: {
    farmer: [
      { urgency: "urgent", icon: "!", title: "เร่งเก็บเกี่ยวในพื้นที่รังสิตและหนองเสือ", desc: "เลื่อนการเก็บเกี่ยวให้เร็วขึ้น 10-14 วัน เพื่อหลีกเลี่ยงน้ำท่วมช่วงสัปดาห์ที่ 3 ติดต่อสหกรณ์เพื่อใช้รถเกี่ยวร่วมกัน", meta: ["พื้นที่: 2 เขต", "กำหนด: 7 วัน", "ผลผลิตลดลง ~6%"] },
      { urgency: "soft", icon: "◐", title: "พิจารณาเปลี่ยนพันธุ์ KDML105 → กข79", desc: "สำหรับฤดูกาลเพาะปลูกหน้าในแปลงเสี่ยงน้ำท่วม พันธุ์ กข79 ทนน้ำท่วมได้ 14 วัน เทียบกับ 5 วันของพันธุ์เดิม", meta: ["ฤดู: ถัดไป", "รัฐอุดหนุน: มี"] },
      { urgency: "good", icon: "✓", title: "NDVI ในลาดหลุมแก้วอยู่ในเกณฑ์ดี", desc: "ไม่ต้องดำเนินการ รักษาตารางการให้น้ำแบบเปียกสลับแห้งตามปกติ", meta: ["NDVI: 0.74", "สถานะ: คงที่"] },
    ],
    lgu: [
      { urgency: "urgent", icon: "!", title: "เริ่มพิจารณาโควตานำเข้าข้าว", desc: "คาดว่าจะขาดแคลน 46,000 ตัน ในสัปดาห์ที่ 8 แนะนำให้เริ่มเจรจารัฐต่อรัฐ (เวียดนาม เมียนมา) โดยทันที", meta: ["ขาดแคลน: 46,000 ตัน", "ระยะเวลานำเข้า: 6 สัปดาห์"] },
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
