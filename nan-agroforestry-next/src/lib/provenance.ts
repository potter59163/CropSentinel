/**
 * Where each species' economic numbers came from.
 *
 * The advisory meeting's first complaint was "ตัวเลขนี้เอามาจากไหน". The honest answer differs
 * enormously by species, and averaging over that difference is itself a form of dishonesty: a
 * longan price traceable to a named OAE series and a ผักหวานป่า price inferred from scattered
 * local reports should not look identical on screen.
 *
 * So every species carries a tier, and the tier is visible.
 *
 * WHAT THE RESEARCH ESTABLISHED, and why the tiers land where they do:
 *
 * - OAE publishes per-crop, per-rai cost-of-production workbooks (article/487) giving both an
 *   annual cost and, for perennials, a pre-productive establishment cost. That maps 1:1 onto
 *   this app's two cost fields. Every one of those files is stamped ธันวาคม 2563 — about five
 *   and a half years old, over a period when fertiliser and labour moved a great deal.
 * - OAE's monthly farm-gate price series runs back to 2550 in บาท/กก., roughly 29 commodities.
 * - PRICES ARE NATIONAL ONLY. Every price record carries province_code TH00 (ประเทศไทย). The
 *   province tier exists on the production/yield endpoint but NOT on price. A Nan farmer at a
 *   village buying point generally receives less than a national average, so this is the
 *   single most important caveat on the price side.
 * - YIELD can be Nan-specific. NABC's AgriAPI returns province-level yield, and Nan maize runs
 *   ~693 kg/rai against a national 790 — using the national figure overstates a Nan farmer's
 *   harvest by about 14%.
 * - The OAE coffee series is ROBUSTA (สารกาแฟ โรบัสต้า), a lowland southern crop. Nan grows
 *   ARABICA on the highlands. Applying the published price to a Nan arabica plot is a real
 *   economic error rather than a rounding one, so coffee is deliberately NOT tier A.
 * - About twenty species — มะแขว่น, ชาเมี่ยง, ผักหวานป่า, ผักกูด, ผักเชียงดา, หวาย, เร่ว, บุก,
 *   ทองหลางป่า, the cover legumes, and also อะโวคาโด and แมคคาเดเมีย — appear in no national
 *   price, yield or cost series at all. Those are precisely the species that make an
 *   agroforestry system work, and precisely the ones with no official number.
 *
 * A METHODOLOGICAL TRAP worth recording, because it invalidates the obvious way of checking
 * this work: www.oae.go.th is an Angular single-page app behind Imperva, and returns HTTP 200
 * with an identical shell for ANY path, including invented ones. A citation checker based on
 * status codes will silently accept fabricated OAE URLs. Every OAE citation here was verified
 * by rendering the page and reading its content.
 *
 * Related: OAE's per-commodity PDFs sit at hashed upload paths that change each publication
 * cycle, so the deep link rots. Cite the article page, never the PDF.
 */

export type ProvenanceTier = 'official' | 'research' | 'estimated';

export interface TierMeta {
  labelTh: string;
  shortTh: string;
  descTh: string;
}

export const TIER_META: Record<ProvenanceTier, TierMeta> = {
  official: {
    labelTh: 'ตัวเลขราชการ',
    shortTh: 'ราชการ',
    descTh: 'ราคา/ผลผลิต/ต้นทุน อ้างอิงชุดข้อมูลของสำนักงานเศรษฐกิจการเกษตร (สศก.) ที่ระบุปีได้',
  },
  research: {
    labelTh: 'อ้างอิงบางส่วน',
    shortTh: 'อ้างอิงบางส่วน',
    descTh: 'มีข้อมูลราชการหรืองานวิจัยรองรับบางตัว แต่ไม่ตรงพันธุ์/ไม่ตรงพื้นที่ ต้องปรับตามราคาจริง',
  },
  estimated: {
    labelTh: 'ประมาณการ',
    shortTh: 'ประมาณการ',
    descTh: 'ไม่มีในสถิติระดับชาติ ตัวเลขเป็นการประมาณจากรายงานท้องถิ่น ควรใส่ราคาจริงของท่านทับ',
  },
};

/**
 * Species whose price AND cost trace to a named OAE series.
 *
 * Conservative on purpose — a species only appears here if the research confirmed it in the
 * monthly price list or the cost workbook list by name. Anything uncertain is downgraded
 * rather than promoted, because an overstated provenance claim is exactly what a reviewer
 * would catch first.
 */
const OFFICIAL = new Set([
  'longan',      // ลำไย — monthly price series + cost XLSX (8,120.13 ฿/rai/yr, est. 632.78)
  'lychee',      // ลิ้นจี่ — cost XLSX (5,703.31 ฿/rai/yr, est. 417.31)
  'mango',       // มะม่วง — cost XLSX (8,579.58 ฿/rai/yr, est. 586.24)
  'pineapple',   // สับปะรด — monthly price (สับปะรดปัตตาเวีย) + cost XLSX
  'peanut',      // ถั่วลิสง — monthly price + cost XLSX
  'mungbean',    // ถั่วเขียว — monthly price + cost XLSX
  'rambutan',    // เงาะ — monthly price (เงาะโรงเรียน)
  'longkong',    // ลองกอง — cost XLSX
]);

/**
 * Species with partial official backing that does not quite fit this plot or this varietal.
 * Naming the mismatch is more useful than either claiming or denying official status.
 */
const RESEARCH: Record<string, string> = {
  coffee: 'สศก. เผยแพร่ราคากาแฟ "โรบัสต้า" ซึ่งเป็นพันธุ์พื้นที่ต่ำภาคใต้ · น่านปลูกอาราบิก้าบนที่สูง ราคาต่างกันจริง',
  // Demoted from official for the same reason coffee is here. The cost workbook entry is
  // ชาอัสสัม — the same species, Camellia sinensis var. assamica — but a different PRODUCT:
  // ชาเมี่ยง is fermented leaf for chewing, harvested and priced on its own local market,
  // often from old shade-grown stands rather than a managed tea garden. Claiming the tea
  // series covers it while the plan uses a cost 71% below that series is the kind of gap a
  // reviewer opens two files to find. The app also has no SDM for it, despite the file
  // having claimed one that was never in the model.
  tea: 'สศก. มีต้นทุน "ชาอัสสัม" ซึ่งเป็นพืชชนิดเดียวกันแต่คนละผลิตภัณฑ์ · ชาเมี่ยงเป็นใบหมักขายตลาดท้องถิ่น ราคาและต้นทุนต่างกัน',
  banana: 'สศก. มีต้นทุนกล้วยหอม/กล้วยไข่ แต่ไม่มีกล้วยน้ำว้า ซึ่งเป็นพันธุ์ที่ใช้ในแผนนี้',
  uplandrice: 'สศก. มีข้าวนาปี/นาปรัง แต่ข้าวไร่บนที่สูงให้ผลผลิตต่างจากนาลุ่มมาก',
  chili: 'ราคาพริกผันผวนสูงมากตามฤดูและชนิดพริก ตัวเลขกลางใช้ได้แค่เป็นจุดตั้งต้น',
};

/**
 * The known blind spot, listed explicitly so it can be printed rather than inferred.
 * These are the species that make agroforestry work and have no official number.
 */
export const NO_NATIONAL_SERIES = [
  'มะแขว่น', 'ผักหวานป่า', 'ผักกูด', 'ผักเชียงดา', 'หวาย', 'เร่ว', 'บุก',
  'ทองหลางป่า', 'อะโวคาโด', 'แมคคาเดเมีย', 'พืชคลุมดินตระกูลถั่วทุกชนิด', 'ไม้ใช้สอยทุกชนิด',
];

export function provenanceOf(plantId: string): ProvenanceTier {
  if (OFFICIAL.has(plantId)) return 'official';
  if (Object.hasOwn(RESEARCH, plantId)) return 'research';
  return 'estimated';
}

/** The specific mismatch, when there is one worth naming. */
export function provenanceNote(plantId: string): string | undefined {
  return Object.hasOwn(RESEARCH, plantId) ? RESEARCH[plantId] : undefined;
}

/** Canonical citations. Article pages, never PDF deep links — those rotate each cycle. */
export const ECONOMIC_SOURCES = [
  {
    org: 'สำนักงานเศรษฐกิจการเกษตร (สศก.)',
    what: 'ต้นทุนการผลิตต่อไร่ รายพืช (ไฟล์คำนวณ XLSX) — มีทั้งต้นทุนต่อปีและต้นทุนก่อนให้ผล',
    url: 'https://oae.go.th/home/article/487',
    caveat: 'ทุกไฟล์ลงวันที่ ธันวาคม 2563 — เก่าราว 5 ปีครึ่ง ค่าปุ๋ยและค่าแรงเปลี่ยนไปมากแล้ว',
  },
  {
    org: 'สำนักงานเศรษฐกิจการเกษตร (สศก.)',
    what: 'ราคาที่เกษตรกรขายได้ ณ ไร่นา รายเดือน (บาท/กก.) ย้อนถึงปี 2550',
    url: 'https://oae.go.th/home/article/610',
    caveat: 'เป็นราคาระดับประเทศทั้งหมด ไม่มีรายจังหวัดหรือรายภาค · ราคาที่จุดรับซื้อในหมู่บ้านมักต่ำกว่า',
  },
  {
    org: 'ศูนย์ข้อมูลเกษตรแห่งชาติ (NABC/สศก.)',
    what: 'AgriAPI — ผลผลิตต่อไร่ระดับจังหวัด ใช้ได้ฟรี ไม่ต้องใช้คีย์',
    url: 'https://agriapi.nabc.go.th',
    caveat: 'ผลผลิตมีระดับจังหวัด (น่าน = TH55) แต่ราคามีแค่ระดับประเทศ · ครอบคลุมราว 9 พืชเท่านั้น',
  },
  {
    org: 'สำนักงานเศรษฐกิจการเกษตรที่ 2 (พิษณุโลก)',
    what: 'สำนักงานภูมิภาคที่รับผิดชอบ จ.น่าน สำรวจต้นทุนการผลิตในพื้นที่จริง',
    url: 'https://zone2.oae.go.th',
    caveat: 'ยังไม่เผยแพร่ตารางต้นทุนต่อไร่รายพืชรายจังหวัด — การทำหนังสือขอข้อมูลคือทางที่ตรงที่สุด',
  },
];

/** A concrete, checkable fact about why national yield figures mislead for Nan. */
export const NAN_YIELD_CAVEAT =
  'ผลผลิตข้าวโพดของน่านอยู่ราว 693 กก./ไร่ ขณะที่ค่าเฉลี่ยประเทศราว 790 กก./ไร่ '
  + '— ใช้ตัวเลขระดับประเทศจะสูงกว่าที่เกษตรกรน่านได้จริงราว 14% (ที่มา: NABC AgriAPI ระดับจังหวัด)';
