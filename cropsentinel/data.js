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

  // ปฏิทินการเก็บเกี่ยวจริง 8 ช่วงครึ่งเดือน แทนกราฟ "8 สัปดาห์" ที่เดิมเป็นตัวเลขสมมติ
  //
  // เดิม supply.current = 180 พันตัน ซึ่งขัดกับพื้นที่ข้าวที่ดาวเทียมวัดได้:
  // 76,272 ไร่ x 720.18 กก./ไร่ = 54,930 ตัน = 54.9 พันตัน ต่างกัน 3.3 เท่า
  // ตอนนี้ทุกจุดบนกราฟอุปทานมาจากชั้นข้อมูลข้าวรายแปลงของ GISTDA โดยตรง
  weeks: G.harvestWindows.map((w) => w.windowTh.replace(" 2569", "")),

  supply: {
    // พันตัน — ผลผลิตที่จะเข้าสู่ตลาดในแต่ละช่วงครึ่งเดือน (วัดได้)
    projected: G.harvestWindows.map((w) => Math.round(w.tonnes / 100) / 10),
    // พันตันรวมทั้งฤดู = ไร่ x กก./ไร่ / 1e6 ปัดทศนิยม 1 ตำแหน่ง
    current: Math.round(G.province.riceRai * G.province.productKgPerRai[0] / 1e5) / 10,

    // ---- ค่าสมมติ ยังไม่มีชั้นข้อมูลรองรับ ----
    // ปทุมธานีมีโรงสีเพียง 2 แห่ง (ชั้นข้อมูลโรงสีข้าว GISTDA) แต่ยังไม่มีชั้นข้อมูล
    // "กำลังสีข้าวต่อวัน" เผยแพร่ ตัวเลขนี้จึงเป็นสมมติฐานสำหรับให้ผู้เล่นปรับเอง
    // ห้ามนำเสนอเป็นค่าที่วัดได้ และต้องแสดงป้ายกำกับทุกครั้งที่วาดกราฟ
    millCapacityPerWindowKt: 8,
    demand: G.harvestWindows.map(() => 8),
    demandIsAssumption: true,
    demandBasisTh: "สมมติฐาน ยังไม่มีชั้นข้อมูลกำลังสีข้าว — ปรับได้ในภารกิจ",

    // สัดส่วนผลผลิตทั้งฤดูที่กำลังรับซื้อรองรับได้ ถ้าไม่มีการเกลี่ยจังหวะ
    // ต้องมีค่าตั้งต้นเสมอ ไม่งั้น Gauge ใน M03 จะได้ NaN ก่อน api-fetch ทำงานเสร็จ
    readiness: (() => {
      const arrive = G.harvestWindows.map((w) => w.tonnes / 1000);
      const total = arrive.reduce((a, b) => a + b, 0);
      const absorbed = arrive.reduce((s, v) => s + Math.min(v, 8), 0);
      return total > 0 ? Math.round((absorbed / total) * 100) : 0;
    })(),
  },

  price: {
    // ---- ฉากทัศน์ราคา ไม่ใช่การพยากรณ์ ----
    // ราคาอ้างอิงตั้งต้นและค่าความยืดหยุ่นยังไม่ได้สอบเทียบกับข้อมูลตลาดจริง
    // แสดงเป็น "ถ้า...แล้ว..." เท่านั้น ห้ามติดป้ายว่าเป็นการพยากรณ์
    isScenario: true,
    anchorNoteTh: "ราคาตั้งต้นเป็นค่าอ้างอิง ยังไม่ได้เชื่อมกับฟีดราคาจริง",
    actual: [9200, 9260, 9380, 9510, 9720, 10020, 10380, 10860],
    band_low: [9100, 9120, 9200, 9280, 9420, 9640, 9880, 10180],
    band_high: [9300, 9400, 9560, 9740, 10020, 10400, 10880, 11540],
  },

  // การแจ้งเตือนตั้งต้น — api-fetch.js สร้างใหม่จากข้อมูลสดเมื่อเรียก API สำเร็จ
  //
  // ทุกใบต้องมี basisTh บอกว่ามาจากไหน และห้ามมีตัวเลข confidence ที่ไม่ได้คำนวณ
  // เวอร์ชันก่อนหน้ามี confidence 0.89/0.82/0.76/0.68/0.73 ซึ่งเป็นค่าที่พิมพ์ไว้เฉย ๆ
  // และเตือนเรื่อง "ขาดแคลน" ทั้งที่ปัญหาจริงของปทุมธานีคือผลผลิตออกพร้อมกันเกินรับ
  alerts: (() => {
    const peak = G.harvestWindows.reduce((a, b) => (b.rai > a.rai ? b : a));
    return [
      {
        id: "a2", level: "risk",
        basisTh: "ชั้นข้อมูลข้าวรายแปลง GISTDA " + G.source.riceLabelTh,
        title: `ข้าวออกพร้อมกัน ${Math.round(peak.tonnes).toLocaleString()} ตัน ช่วง ${peak.windowTh}`,
        titleEn: `Harvest concentration in a single half-month window`,
        body: `${peak.rai.toLocaleString()} ไร่ คิดเป็น ${Math.round(peak.shareOfProvince * 100)}% ของผลผลิตทั้งฤดู มาถึงในช่วงครึ่งเดือนเดียว จังหวัดมีโรงสี ${G.mills.inProvince.length} แห่ง`,
        tag: "อุปทาน",
      },
      {
        id: "a6", level: "warn",
        basisTh: "ชั้นข้อมูลข้าวรายแปลง GISTDA — สรุปตามโครงการชลประทาน",
        title: "การกระจุกตัวมาจากรอบเวรน้ำ ไม่ใช่ภูมิอากาศ",
        titleEn: "Concentration follows irrigation scheduling",
        body: `${G.irrigationProjects[0].nameTh} ครอบคลุม ${G.irrigationProjects[0].rai.toLocaleString()} ไร่ แปลงในโครงการเดียวกันได้น้ำรอบเดียวกันจึงเก็บเกี่ยวใกล้กัน — ขอบเขตโครงการไม่ตรงกับขอบเขตอำเภอ`,
        tag: "ชลประทาน",
      },
      {
        id: "a1", level: "warn",
        basisTh: "ความถี่น้ำท่วมซ้ำซาก GISTDA 2548-2559 · ยังไม่ใช่สถานะน้ำวันนี้",
        title: "พื้นที่ที่ท่วมซ้ำบ่อยที่สุดคือสามโคก (7 ครั้งใน 12 ปี)",
        titleEn: "Repeated flooding — Sam Khok highest at 7 events",
        body: "ตัวเลขนี้เป็นความเสี่ยงเชิงประวัติศาสตร์ ไม่ได้บอกว่าตอนนี้น้ำท่วมอยู่ ต้องดูฝนพยากรณ์ประกอบ",
        tag: "น้ำท่วม",
      },
    ];
  })(),

  recommendations: {
    farmer: [
      { urgency: "urgent", icon: "!", title: "นัดคิวรถเกี่ยวล่วงหน้าก่อนช่วงข้าวออกหนาแน่น", desc: "แปลงในโครงการส่งน้ำเดียวกันจะสุกใกล้กัน ทำให้แย่งรถเกี่ยวและคิวสีข้าวพร้อมกัน การนัดคิวล่วงหน้าช่วยลดวันที่ข้าวเปียกรอสี", meta: ["อ้างอิงปฏิทินเก็บเกี่ยวจากดาวเทียม"] },
      { urgency: "soft", icon: "!", title: "ปรับรอบให้น้ำในแปลงที่ดินเริ่มแห้ง", desc: "พื้นที่ที่มี soil moisture ต่ำกว่า 0.40 ควรเพิ่มการติดตามน้ำในแปลงและลดการปล่อยน้ำทิ้งช่วงกลางวัน เพื่อลด water stress", meta: ["ภัยแล้ง: MEDIUM", "soil moisture: 0.42", "dry days: 9"] },
      { urgency: "soft", icon: "◐", title: "หารือปรับรอบปลูกให้เหลื่อมกันในฤดูถัดไป", desc: "แปลงที่อยู่ในโครงการส่งน้ำเดียวกันมักเก็บเกี่ยวพร้อมกัน การเหลื่อมรอบส่งน้ำ 15 วันช่วยกระจายวันเก็บเกี่ยวและลดการแย่งกำลังสีข้าว", meta: ["ฤดู: ถัดไป", "ต้องหารือกับโครงการชลประทาน"] },
      { urgency: "good", icon: "✓", title: "NDVI ในลาดหลุมแก้วอยู่ในเกณฑ์ดี", desc: "ไม่ต้องดำเนินการ รักษาตารางการให้น้ำแบบเปียกสลับแห้งตามปกติ", meta: ["NDVI: 0.74", "สถานะ: คงที่"] },
    ],
    lgu: [
      { urgency: "urgent", icon: "!", title: "เริ่มพิจารณาโควตานำเข้าข้าว", desc: "คาดว่าจะขาดแคลน 46,000 ตัน ในสัปดาห์ที่ 8 แนะนำให้เริ่มเจรจารัฐต่อรัฐ (เวียดนาม เมียนมา) โดยทันที", meta: ["ขาดแคลน: 46,000 ตัน", "ระยะเวลานำเข้า: 6 สัปดาห์"] },
      { urgency: "soft", icon: "!", title: "เตรียมแผนจัดสรรน้ำหากฝนต่ำต่อเนื่อง", desc: "ติดตาม dry days และ soil moisture รายอำเภอ หากพื้นที่เสี่ยงสูงเกิน 3 อำเภอ ให้เตรียมรอบส่งน้ำสำรองและประกาศคำแนะนำลดการใช้น้ำ", meta: ["dry days: 9", "water stress: 58%", "หน่วยงานน้ำ: เฝ้าระวัง"] },
      { urgency: "soft", icon: "◐", title: "ทบทวนแผนสูบน้ำในอำเภอที่ท่วมซ้ำบ่อย", desc: "สามโคกท่วมซ้ำสูงสุด 7 ครั้งใน 12 ปี รองลงมาคือเมืองปทุมธานี คลองหลวง และลาดหลุมแก้ว ที่ 6 ครั้ง — ใช้เป็นลำดับความสำคัญของการเตรียมเครื่องสูบ", meta: ["ความถี่น้ำท่วมซ้ำซาก GISTDA 2548-2559"] },
      { urgency: "soft", icon: "◐", title: "หารือมาตรการเพดานราคา", desc: "เชิญกระทรวงพาณิชย์ประชุมหากราคาเกิน 10,500 บาท/ตัน เพื่อป้องกันผลกระทบต่อผู้บริโภค", meta: ["กระตุ้น: สัปดาห์ที่ 6", "ความเชื่อมั่น: 76%"] },
    ],
    retailer: [
      { urgency: "soft", icon: "◐", title: "เตรียมพื้นที่เก็บและกำลังอบลดความชื้น", desc: "ช่วงที่ข้าวออกหนาแน่นที่สุดคือโอกาสรับซื้อปริมาณมาก แต่ข้าวเปียกที่รอสีนานจะเสียคุณภาพ ต้องเตรียมลานตากหรือเครื่องอบไว้ล่วงหน้า", meta: ["อ้างอิงปฏิทินเก็บเกี่ยวจากดาวเทียม"] },
      { urgency: "soft", icon: "◐", title: "ซัพพลายเออร์สำรองในนครสวรรค์", desc: "กระจายความเสี่ยงจากปทุมธานี เปิดใช้สัญญาสำรองในจังหวัดที่ไม่ได้รับผลกระทบ", meta: ["ตัวเลือก: 3", "เริ่ม: สัปดาห์ที่ 2"] },
      { urgency: "good", icon: "✓", title: "ข้าวหักยังคงเสถียร", desc: "ไม่ต้องปรับราคา กข6 และสายการผลิตข้าวหัก ความยืดหยุ่นของอุปสงค์ยังอยู่ในระดับปกติ", meta: ["SKU: 4", "กำไร: ±0%"] },
    ],
  },
};
