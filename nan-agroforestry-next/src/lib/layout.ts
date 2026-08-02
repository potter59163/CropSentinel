import type { LayerPick, SystemPlan } from '../data/types';

/**
 * Where each species goes, and how to keep fire out.
 *
 * The advisory meeting asked for this with a concrete failure: "ถั่วชอบแดดแต่ปลูกข้างต้นสัก
 * และสักบังแดดหมด" — peanuts want sun but get planted beside teak, which shades them out.
 * The engine already models that shade loss in the cashflow and warns about it in prose, but
 * it never said WHERE to put anything, so the mix could be internally impossible.
 *
 * It turns out Thai extension already publishes the answer, and expresses it in YEARS rather
 * than in light percentages: in กรมป่าไม้'s agroforestry handbook (รูปแบบการปลูกไม้ป่าโดย
 * ระบบวนเกษตร, 2556 — 10 named patterns with plan-view diagrams) field crops go in the ALLEY
 * between tree rows, starting 50 cm out from the row and moving 50 cm further each year, and
 * at YEAR 6 the alley crop switches from sun-lovers to shade-tolerant species.
 *
 * That is why this module outputs a repeating STRIP — one tree row plus one alley — and not a
 * plot map. A map would need plot shape, aspect and slope the app does not have, and the
 * meeting asked explicitly not to add difficulty. The strip is the unit the handbook itself
 * uses, it tiles to any plot, and it carries the year-6 rule that answers the actual question.
 *
 * ROW ORIENTATION — a real conflict in the sources. กรมป่าไม้ orients tree rows east-west for
 * light. กรมวิชาการเกษตร and กรมพัฒนาที่ดิน orient them across the slope (ตามแนวระดับ) for
 * erosion control. On Nan's steep highland plots the contour rule wins: soil loss on a 35%
 * slope is the larger and more irreversible risk, and rows on the contour are also what
 * vetiver strips require. The app states the contour rule and notes the trade-off rather than
 * hiding the disagreement.
 */

export const ALLEY_SWITCH_YEAR = 6;

export interface StripPlan {
  /** Species forming the tree row itself. */
  rowSpecies: LayerPick[];
  /** Sun-loving species that work in the alley while the canopy is still open (years 1-5). */
  alleyEarly: LayerPick[];
  /** Shade-tolerant species for the alley once the canopy closes (year 6 onward). */
  alleyLate: LayerPick[];
  /**
   * Species chosen by the farmer that need sun but will be shaded out — the exact mistake the
   * meeting raised. Named so the advice can be specific rather than generic.
   */
  shadedOut: LayerPick[];
  /** True when the plan's canopy never closes enough to force a year-6 switch. */
  canopyStaysOpen: boolean;
}

/**
 * Below this shadeTol, a species needs sun and a closed canopy will suppress it.
 *
 * 0.4, not 0.35. The data has a natural gap here — sun-demanding species cluster at 0.10-0.35
 * (งาดำ, ปอเทือง, ฟักทอง, พริก, ถั่วลิสง, มันเทศ, ชะอม) and shade-tolerant ones at 0.45+
 * (โกโก้, เผือก, ขิง, ชาเมี่ยง) — with only ตะไคร้ at 0.40 in between. A strict `< 0.35` cut
 * excluded ถั่วลิสง, whose shadeTol is exactly 0.35, which is to say it excluded the very
 * species from the meeting's own example of the problem this module exists to solve.
 */
const SHADE_TOL_SUN_LOVER = 0.4;
const CANOPY_CLOSES_ABOVE = 0.5;

export function stripPlan(sys: SystemPlan): StripPlan {
  const rowSpecies = sys.picks.filter((p) => p.layer === 'canopy');
  const understory = sys.picks.filter((p) => p.layer !== 'canopy');

  // The densest mature canopy governs, matching how engine.ts picks `dominant`.
  const canopyShade = rowSpecies.reduce((m, p) => Math.max(m, p.plant.canopyShade), 0);
  const canopyStaysOpen = canopyShade < CANOPY_CLOSES_ABOVE;

  const alleyEarly = understory.filter((p) => p.plant.shadeTol < SHADE_TOL_SUN_LOVER);
  const alleyLate = understory.filter((p) => p.plant.shadeTol >= SHADE_TOL_SUN_LOVER);

  return {
    rowSpecies,
    alleyEarly,
    alleyLate,
    shadedOut: canopyStaysOpen ? [] : alleyEarly,
    canopyStaysOpen,
  };
}

// ── Firebreak ───────────────────────────────────────────────────────────────

/**
 * Neighbouring land use, because that — not the farmer's own plot — is what sizes the break.
 *
 * Wanthongchai et al. (2021, APN Science Bulletin) measured fuel load and fire behaviour on
 * NAN PROVINCE plots: maize stubble burns at a flame length of 1.42 m, mixed deciduous forest
 * 1.34 m, but abandoned highland reaches 7.13 m and 5-year swidden fallow 12.82 m on slopes
 * over 35%. So the official 8-10 m break is generous against maize stubble and comfortably
 * beats a forest-edge fire, yet is roughly equal to or NARROWER than the flame length coming
 * off an unmanaged fallow next door.
 *
 * That is the finding worth putting in front of a farmer: their fire risk is mostly a fact
 * about the neighbour's land, and past a certain point the answer is not a wider break but a
 * conversation with the neighbour and the village head.
 */
export type NeighbourFuel = 'maize' | 'forest' | 'fallow' | 'unknown';

export interface FirebreakPlan {
  /** Cleared width in metres, down to bare soil. */
  widthM: number;
  /** True when no achievable width beats the neighbouring fuel's flame length. */
  widthNotEnough: boolean;
  /** Measured flame length of the neighbouring fuel, metres. */
  neighbourFlameM: number | null;
  /** Roughly how much of the plot the break consumes, in rai. */
  areaCostRai: number;
  advice: string[];
  sources: string[];
}

/** Flame lengths measured on Nan plots — Wanthongchai et al. (2021). */
const FLAME_LENGTH_M: Record<NeighbourFuel, number | null> = {
  maize: 1.42,
  forest: 1.34,
  fallow: 12.82,
  unknown: null,
};

/** กรมป่าไม้ reforestation manual and สวพส./HRDI both give "ไม่น้อยกว่า 8 เมตร". */
const BASE_WIDTH_M = 8;
const WIDE_WIDTH_M = 10;
const M2_PER_RAI = 1600;

export function firebreakPlan(sizeRai: number, neighbour: NeighbourFuel = 'unknown'): FirebreakPlan {
  const flame = FLAME_LENGTH_M[neighbour];
  const widthM = neighbour === 'fallow' || neighbour === 'unknown' ? WIDE_WIDTH_M : BASE_WIDTH_M;
  // A 10 m break cannot out-reach a 12.8 m flame. Saying so is more useful than implying the
  // break alone solves it.
  const widthNotEnough = flame != null && flame > widthM;

  // Perimeter of a square plot of this size, times the break width. Approximate on purpose —
  // real plots are not square, and the point is the order of magnitude a farmer gives up.
  //
  // Capped at 90% of the plot because the perimeter formula stops making sense on small ones:
  // a 10 m break around a 1 rai plot is 4 x 40 x 10 = 400 sq m of border drawn on a 1,600 sq m
  // square, and the raw figure came out at 4 rai — more than the whole holding. The break also
  // double-counts its own corners. The cap is a floor under the absurdity, not a correction;
  // below about 3 rai the honest reading is that a full-width break is not viable alone, which
  // is what the advice below says.
  const sideM = Math.sqrt(Math.max(0, sizeRai) * M2_PER_RAI);
  const rawAreaRai = Math.max(0, (4 * sideM * widthM) / M2_PER_RAI);
  const areaCostRai = Math.min(rawAreaRai, Math.max(0, sizeRai) * 0.9);
  // 0.35, not 0.5: at 5 rai — inside the 5-15 rai band this tool is built for — a 10 m break
  // around a square plot takes 2.24 rai, 45% of the holding. That is arithmetically right and
  // practically absurd as a default, and now that the plan actually deducts the area it costs
  // real projected income. Anyone in that position needs the shared-break option said out loud.
  const breakDominatesPlot = rawAreaRai > Math.max(0, sizeRai) * 0.35;

  const advice: string[] = [
    `ทำแนวกันไฟรอบแปลง กว้าง ${widthM} เมตร ถางใบไม้กิ่งไม้ออกให้เห็นดิน ไม่ใช่แค่ตัดหญ้า`,
    'ทำให้เสร็จก่อนเดือนพฤศจิกายน — ฤดูไฟรุนแรงสุดราวเดือนกุมภาพันธ์',
    'ไฟวิ่งขึ้นเขา ด้านล่างเนินของแปลงจึงต้องทำแนวกว้างกว่าด้านอื่น',
  ];
  if (widthNotEnough) {
    advice.push(
      'ที่ติดแปลงเป็นไร่ร้าง/ไร่เหล่า ซึ่งวัดได้ว่าเปลวไฟสูงถึง 7–13 เมตร '
      + '· แนวกันไฟอย่างเดียวไม่พอ ต้องคุยกับเจ้าของที่ข้างเคียงและผู้ใหญ่บ้าน/อบต. เรื่องจัดการเชื้อเพลิงร่วมกัน',
    );
  }
  if (neighbour === 'unknown') {
    advice.push('ยังไม่ได้ระบุว่าที่ติดแปลงเป็นอะไร — ความเสี่ยงไฟขึ้นกับที่ข้างเคียงมากกว่าแปลงเราเอง');
  }
  if (breakDominatesPlot) {
    advice.push(
      `แปลงเล็ก (${sizeRai} ไร่) แนวกันไฟเต็มความกว้างจะกินพื้นที่เกินครึ่งแปลง `
      + '· ทางที่ทำได้จริงคือทำแนวร่วมกับแปลงข้างเคียงเป็นแนวเดียว หรือทำเฉพาะด้านล่างเนินซึ่งไฟวิ่งเข้ามา '
      + 'แล้วใช้การจัดการเชื้อเพลิง (เก็บใบแห้ง ตัดหญ้า) แทนด้านที่เหลือ',
    );
  }

  return {
    widthM,
    widthNotEnough,
    neighbourFlameM: flame,
    areaCostRai: Math.round(areaCostRai * 100) / 100,
    advice,
    sources: [
      'กรมป่าไม้ คู่มือการปลูกฟื้นฟูป่า · สวพส./HRDI — แนวกันไฟไม่น้อยกว่า 8 เมตร',
      'Wanthongchai et al. (2021) APN Science Bulletin — วัดพฤติกรรมไฟในแปลง จ.น่าน',
    ],
  };
}

/**
 * Bamboo is FUEL, not a firebreak.
 *
 * This app recommends ไผ่ often — it scores well on woody structure, slope stabilisation and
 * fast income — so the risk is worth naming explicitly. RECOFTC's own 2024 community fire
 * management report lists bamboo clumps among high fire-risk fuels: the accumulated leaf
 * litter, broken culms and dead branches inside a clump carry fire readily. Planting bamboo
 * as a "green firebreak" would make the problem worse, and a farmer might reasonably assume
 * a living green plant is protective.
 */
export function bambooFireWarning(picks: LayerPick[]): string | null {
  if (!picks.some((p) => p.plant.habit === 'ไผ่')) return null;
  return 'แผนนี้มีไผ่ · ไผ่ไม่ใช่แนวกันไฟ กอไผ่สะสมใบแห้งและลำแห้งซึ่งติดไฟง่าย '
    + 'ต้องเก็บใบและลำแห้งในกอออกก่อนฤดูแล้งทุกปี และอย่าปลูกไผ่เป็นแนวกันไฟ';
}
