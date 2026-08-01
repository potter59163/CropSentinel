import type { ExistingZone } from '../data/types';

/**
 * What the previous crop means for the next one.
 *
 * The app used to answer this with a single opaque number: prior use -> baht per rai of
 * "transition cost", multiplied by area and added to year 1. Nothing else. Fifteen years of
 * continuous maize and freshly cleared forest produced an identical species recommendation.
 * The advisory meeting asked what land history actually feeds into — this module is the
 * answer, and it deliberately produces FLAGS and ACTIONS rather than more arithmetic.
 *
 * Two of the old numbers were not just unsourced but wrong in sign or emphasis:
 *
 *   ยางพารา was the most expensive prior use in the table at 6,800 ฿/rai. In reality การยาง
 *   แห่งประเทศไทย pays a ทุนปลูกแทน grant to replant — including categories explicitly for
 *   replanting with economic trees and for "เกษตรกรรมยั่งยืน", which is close to exactly what
 *   this app recommends — and the standing rubber wood itself sells. Conversion is plausibly
 *   cash-POSITIVE. No grant amount is hard-coded here: the rates and the application window
 *   reset every fiscal year, so the app points the farmer at กยท. instead of quoting a figure
 *   that will be stale.
 *
 *   The clearing cost for rubber is now null, not a number. A search of Thai sources found no
 *   published costing for ค่าขุดตอยาง per rai — only forum posts and backhoe rental pages. An
 *   honest "get a quote, and it may be offset by the wood" beats an invented constant,
 *   especially after a meeting that rejected the data for being unsourced.
 *
 * Deliberately NOT modelled, on evidence:
 *   - Paraquat/glyphosate multi-year soil persistence. The claim circulates widely in Thailand
 *     but does not hold up, and repeating it would delay farmers for no reason.
 *   - Atrazine as a multi-year problem. It carries over for about one wet season, and only
 *     matters for broadleaf covers and legumes — trees and rhizomes planted in holes are fine.
 *   - Any nurse-species list for the north. Thai pioneer lists exist for the south and for
 *     highland reforestation generally, but none specific to Nan was found, and inventing one
 *     from southern data is exactly the error this rebuild exists to remove. The nurse phase
 *     is flagged; the species for it must come from RECOFTC's own Nan planting records.
 */

export interface LandHistoryFlags {
  /** Maize herbicide may carry over one rainy season — only if sprayed this year. */
  herbicideWatch: boolean;
  /** Topsoil likely acidic (maize ~pH 5.0, cassava similar) — gates species needing pH > 5.5. */
  acidRisk: boolean;
  /** Cassava specifically mines potassium; bananas and rhizome crops need it replaced. */
  kDeficit: boolean;
  /** A living rubber stand can be kept and underplanted instead of felled. */
  standingRubber: boolean;
  /** Eligible to ask กยท. about a replanting grant. */
  grantEligible: boolean;
  /** Soil too poor to carry expensive trees in year 1 — needs a nurse/green-manure phase. */
  nurseRequired: boolean;
  /** Actively losing soil now; contour work belongs in year 0, before anything is planted. */
  erosionUrgent: boolean;
}

export interface LandHistoryProfile {
  cropId: string;
  /**
   * Site clearing, ฿/rai. null means "cannot be estimated from a desk — get a quote",
   * which is a real answer and must not be rendered as 0.
   */
  clearingCostPerRai: number | null;
  /** Soil repair (lime, organic matter, green manure seed), ฿/rai. */
  soilRepairCostPerRai: number;
  flags: LandHistoryFlags;
  /** Concrete things to do before planting. Kept to at most two. */
  year0Actions: string[];
  /** At most ONE, per the meeting's instruction not to pile on complexity. */
  warning?: string;
  /** Funding the farmer could ask about. Never an amount — rates reset annually. */
  grantPointer?: string;
  /** Species the app should not offer as year-1 options for this history. */
  gatedSpecies?: string[];
  /** Species officially documented as plantable INTO a standing stand. */
  underplantSpecies?: string[];
  /** Where the numbers and claims above come from. */
  sources: string[];
}

const NO_FLAGS: LandHistoryFlags = {
  herbicideWatch: false, acidRisk: false, kDeficit: false, standingRubber: false,
  grantEligible: false, nurseRequired: false, erosionUrgent: false,
};

/**
 * High-establishment-cost species that should not be offered as a year-1 option into soil
 * that cannot yet support them. Gating these is the point of the nurse phase.
 */
const EXPENSIVE_ESTABLISH = ['avocado', 'macadamia', 'coffee'];

/** Species needing a pH above roughly 5.5, which acidified maize/cassava topsoil may not meet. */
const PH_SENSITIVE = ['avocado', 'macadamia'];

const PROFILES: Record<string, LandHistoryProfile> = {
  'ข้าวโพดเลี้ยงสัตว์': {
    cropId: 'ข้าวโพดเลี้ยงสัตว์',
    clearingCostPerRai: 900,
    // Lime plus a green-manure round. Northern upland maize topsoil measures around pH 5.0
    // and under 2% organic matter, so this is repair, not routine fertilising.
    soilRepairCostPerRai: 1500,
    flags: { ...NO_FLAGS, herbicideWatch: true, acidRisk: true, erosionUrgent: true },
    year0Actions: [
      'ตรวจ pH ดินก่อนเลือกไม้ผลราคาแพง — ดินข้าวโพดเก่ามักเปรี้ยว (ราว pH 5)',
      'หว่านปอเทืองหรือถั่วพร้าคลุมดิน 1 รอบฝน แล้วไถกลบ เพิ่มอินทรียวัตถุก่อนลงไม้ยืนต้น',
    ],
    warning: 'ดินข้าวโพดต่อเนื่องมักเปรี้ยวและอินทรียวัตถุต่ำ · ควรปรับดินก่อน ไม่ควรลงไม้ผลแพงทันที',
    gatedSpecies: PH_SENSITIVE,
    sources: [
      'Phewnil, On-Anong et al. (2010) Thai J. Agric. Sci. 43(3): 119-127 — maize upland soil pH ~5.0, OM 1.78%',
    ],
  },
  'มันสำปะหลัง': {
    cropId: 'มันสำปะหลัง',
    clearingCostPerRai: 800,
    soilRepairCostPerRai: 1400,
    flags: { ...NO_FLAGS, acidRisk: true, kDeficit: true, erosionUrgent: true },
    year0Actions: [
      'เติมโพแทสเซียม (ปุ๋ยคอก/ขี้เถ้าแกลบ/ปุ๋ยสูตรมี K) — มันสำปะหลังดึง K ออกไปมาก',
      'ตรวจ pH ก่อนลงไม้ผล มันสำปะหลังทนดินเปรี้ยวกว่าไม้ผลหลายชนิด',
    ],
    warning: 'มันสำปะหลังดึงโพแทสเซียมออกจากดินมาก · กล้วยและพืชหัวจะโตช้าถ้าไม่เติมคืนก่อน',
    gatedSpecies: PH_SENSITIVE,
    sources: ['ปัญหาการสูญเสียโพแทสเซียมจากการปลูกมันสำปะหลังต่อเนื่อง — กรมวิชาการเกษตร'],
  },
  'ยางพารา': {
    cropId: 'ยางพารา',
    // Deliberately null. No published Thai per-rai figure for ค่าขุดตอยาง was found, and the
    // standing wood has real resale value that may offset it entirely.
    clearingCostPerRai: null,
    soilRepairCostPerRai: 600,
    flags: { ...NO_FLAGS, standingRubber: true, grantEligible: true, erosionUrgent: true },
    year0Actions: [
      'ให้พ่อค้าไม้ประเมินราคาไม้ยางก่อนตัดสินใจโค่น — ค่าโค่นอาจหักกลบกับราคาไม้ที่ขายได้',
      'ถ้ายังกรีดได้อยู่ ลองปลูกแซมใต้ยางก่อน ไม่ต้องโค่นทั้งแปลง',
    ],
    warning: 'สวนยางบนที่ลาดชันชะล้างหน้าดินมากกว่าข้าวโพด · ควรปลูกพืชคลุมดินใต้ยางไม่ว่าจะโค่นหรือไม่',
    grantPointer: 'สวนยางอายุมากหรือให้ผลผลิตต่ำ อาจขอทุนปลูกแทนจาก กยท. สาขาน่านได้ '
      + '(มีประเภทปลูกแทนด้วยไม้ยืนต้นเศรษฐกิจ และแบบเกษตรกรรมยั่งยืน ซึ่งตรงกับแผนวนเกษตร) '
      + '— สอบถามอัตราและรอบรับคำขอของปีปัจจุบัน',
    // กรมวิชาการเกษตร publishes an age-banded list of crops plantable into a live stand.
    // All six are already in this app.
    underplantSpecies: ['ginger', 'galangal', 'turmeric', 'banana', 'pineapple', 'peanut'],
    sources: [
      'Neyret, M. et al. (2020) — rubber plantations show higher runoff and soil detachment than maize on northern Thai slopes',
      'สำนักวิจัยและพัฒนาการเกษตรเขตที่ 8, กรมวิชาการเกษตร — ทางเลือกการปลูกพืชแซมยางพารา (ตัวเลขเป็นของภาคใต้ ควรปรับตามราคาน่าน)',
      'การยางแห่งประเทศไทย — ทุนปลูกแทน (อัตราและรอบรับคำขอเปลี่ยนทุกปีงบประมาณ)',
    ],
  },
  'พื้นที่เสื่อมโทรม': {
    cropId: 'พื้นที่เสื่อมโทรม',
    clearingCostPerRai: 700,
    soilRepairCostPerRai: 2200,
    flags: { ...NO_FLAGS, nurseRequired: true, acidRisk: true, erosionUrgent: true },
    year0Actions: [
      'ปลูกพืชบำรุงดิน (ปอเทือง/ถั่วพร้า) และไม้เบิกนำโตเร็วก่อน 1 ปี แล้วค่อยลงไม้ผลราคาแพง',
      'ทำแนวระดับ/ปลูกแฝกตามแนวลาดก่อนฤดูฝน เพื่อหยุดการชะล้างก่อนลงทุน',
    ],
    warning: 'ดินเสื่อมโทรมยังไม่พร้อมรับไม้ผลราคาแพง · ลงทุนสูงในปีแรกมีโอกาสตายสูง ควรฟื้นดินก่อน 1 ปี',
    gatedSpecies: EXPENSIVE_ESTABLISH,
    sources: ['กระถินเทพาและไม้เบิกนำสำหรับพื้นที่เสื่อมโทรม — รายชื่อชนิดสำหรับภาคเหนือยังต้องยืนยันกับ RECOFTC/กรมป่าไม้น่าน'],
  },
  'พื้นที่ว่าง/เพิ่งถาง': {
    cropId: 'พื้นที่ว่าง/เพิ่งถาง',
    clearingCostPerRai: 500,
    soilRepairCostPerRai: 1200,
    flags: { ...NO_FLAGS, nurseRequired: true, erosionUrgent: true },
    year0Actions: [
      'ปลูกพืชคลุมดินทันทีก่อนฝนแรก — พื้นที่เพิ่งถางเสียหน้าดินเร็วที่สุด',
      'ลงไม้พี่เลี้ยง (กล้วย) พร้อมไม้ยืนต้น เพื่อให้ร่มเงาและรายได้ปีแรก',
    ],
    warning: 'พื้นที่เพิ่งถางไม่มีอะไรยึดหน้าดิน · ควรคลุมดินก่อนฝนแรก',
    gatedSpecies: EXPENSIVE_ESTABLISH,
    sources: [],
  },
  'ข้าวไร่': {
    cropId: 'ข้าวไร่',
    clearingCostPerRai: 600,
    soilRepairCostPerRai: 900,
    flags: { ...NO_FLAGS, erosionUrgent: true },
    year0Actions: ['หว่านพืชตระกูลถั่วคลุมดินหลังเก็บเกี่ยว เพื่อบำรุงดินก่อนลงไม้ยืนต้น'],
    sources: [],
  },
  'ไม้ผลผสม': {
    cropId: 'ไม้ผลผสม',
    clearingCostPerRai: 400,
    soilRepairCostPerRai: 400,
    flags: { ...NO_FLAGS },
    year0Actions: ['เก็บไม้ผลเดิมที่ยังให้ผลดีไว้ แล้วเสริมชั้นล่างเข้าไป ไม่ต้องรื้อทั้งแปลง'],
    sources: [],
  },
  'สวนผสม': {
    cropId: 'สวนผสม',
    clearingCostPerRai: 300,
    soilRepairCostPerRai: 300,
    flags: { ...NO_FLAGS },
    year0Actions: ['ต่อยอดจากของเดิม เติมเฉพาะชั้นที่ยังขาด'],
    sources: [],
  },
  'ป่า/ไม้ยืนต้นเดิม': {
    cropId: 'ป่า/ไม้ยืนต้นเดิม',
    clearingCostPerRai: 200,
    soilRepairCostPerRai: 200,
    flags: { ...NO_FLAGS },
    year0Actions: ['เก็บไม้เดิมไว้เป็นเรือนยอดชั้นบน แล้วปลูกพืชทนร่มใต้ต้น'],
    sources: [],
  },
  'อื่นๆ': {
    cropId: 'อื่นๆ',
    clearingCostPerRai: 700,
    soilRepairCostPerRai: 700,
    flags: { ...NO_FLAGS },
    year0Actions: [],
    sources: [],
  },
};

export function landHistoryProfile(cropId: string): LandHistoryProfile {
  // Object.hasOwn, not `??`: a cropId like "constructor" would otherwise resolve up the
  // prototype chain. planSchema constrains cropId to a known enum; this is the second line.
  return Object.hasOwn(PROFILES, cropId) ? PROFILES[cropId] : PROFILES['อื่นๆ'];
}

export interface TransitionBreakdown {
  /** Site clearing across all zones, ฿. */
  clearing: number;
  /** Whether any zone's clearing cost is unknown and must be quoted on site. */
  clearingNeedsQuote: boolean;
  /** Soil repair across all zones, ฿. */
  soilRepair: number;
  /** clearing + soilRepair. Excludes anything unquoted. */
  total: number;
  flags: LandHistoryFlags;
  year0Actions: string[];
  warnings: string[];
  grantPointers: string[];
  /** Species the app should not offer as year-1 options, given this land history. */
  gatedSpecies: string[];
  sources: string[];
}

/** OR together the flags of every zone — any zone needing care makes the whole plot need it. */
function mergeFlags(profiles: LandHistoryProfile[]): LandHistoryFlags {
  return profiles.reduce<LandHistoryFlags>((acc, p) => ({
    herbicideWatch: acc.herbicideWatch || p.flags.herbicideWatch,
    acidRisk: acc.acidRisk || p.flags.acidRisk,
    kDeficit: acc.kDeficit || p.flags.kDeficit,
    standingRubber: acc.standingRubber || p.flags.standingRubber,
    grantEligible: acc.grantEligible || p.flags.grantEligible,
    nurseRequired: acc.nurseRequired || p.flags.nurseRequired,
    erosionUrgent: acc.erosionUrgent || p.flags.erosionUrgent,
  }), { ...NO_FLAGS });
}

export function transitionBreakdown(zones: ExistingZone[]): TransitionBreakdown {
  const valid = zones.filter((z) => z.cropId && Number.isFinite(z.areaRai) && z.areaRai > 0);
  const profiles = valid.map((z) => landHistoryProfile(z.cropId));

  let clearing = 0;
  let clearingNeedsQuote = false;
  let soilRepair = 0;
  for (const z of valid) {
    const p = landHistoryProfile(z.cropId);
    if (p.clearingCostPerRai === null) clearingNeedsQuote = true;
    else clearing += p.clearingCostPerRai * z.areaRai;
    soilRepair += p.soilRepairCostPerRai * z.areaRai;
  }

  const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));
  return {
    clearing: Math.round(clearing),
    clearingNeedsQuote,
    soilRepair: Math.round(soilRepair),
    total: Math.round(clearing + soilRepair),
    flags: mergeFlags(profiles),
    year0Actions: uniq(profiles.flatMap((p) => p.year0Actions)).slice(0, 3),
    warnings: uniq(profiles.map((p) => p.warning ?? '')),
    grantPointers: uniq(profiles.map((p) => p.grantPointer ?? '')),
    gatedSpecies: uniq(profiles.flatMap((p) => p.gatedSpecies ?? [])),
    sources: uniq(profiles.flatMap((p) => p.sources)),
  };
}
