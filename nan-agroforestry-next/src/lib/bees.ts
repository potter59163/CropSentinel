import type { LayerPick } from '../data/types';

/**
 * ชันโรง (stingless bees) — the tool's one and only animal component.
 *
 * The meeting asked "ดูเรื่องสัตว์? และวนเกษตร". The answer is one hive card, not a livestock
 * planner, for reasons that all point the same way:
 *   - It needs no extra land. On a 5-15 rai plot competing for every square metre, that is
 *     decisive.
 *   - กรมส่งเสริมการเกษตร publishes per-hive economics, so the numbers can be cited.
 *   - Foraging radius is ~300 m, so a handful of hives covers a whole smallholding.
 *   - RECOFTC is already trialling stingless bees in อ.สันติสุข, จ.น่าน — the project's own
 *     partner, in the same district. That is the strongest available evidence of fit.
 *   - It pollinates species this app already carries.
 *
 * Deliberately NOT built: stocking rates, feed rations, breed selection, cattle/goat/pig
 * income models, manure-nutrient calculators, animal health. That is a separate profession
 * and DOAE/DLD already own it. Cattle appear only as a constraint (see CATTLE_WARNING),
 * because free grazing is normal practice in Nan and a newly planted plot needs protecting.
 */

/** กรมส่งเสริมการเกษตร, economic-insect commodity profile. One-off, บาท/รัง. */
export const HIVE_SETUP_THB = 1600;

/**
 * Annual return per hive, บาท — split by where it actually comes from.
 *
 * The headline 2,500 is real but 60% of it is selling SPLIT COLONIES, not honey. A farmer
 * with no colony buyer earns 1,000, not 2,500 — the number collapses by 60% and payback goes
 * from under a year to about 1.6 years. DOAE itself names weak colony marketing as a sector
 * weakness. Showing only the headline would be exactly the kind of attractive-but-conditional
 * figure this project has been removing everywhere else, so the split is the primary output
 * and the total is derived from it.
 */
export const HIVE_RETURN_THB = {
  honey: 600,
  propolis: 400,
  colonies: 1500,
} as const;

export const HIVE_RETURN_TOTAL = HIVE_RETURN_THB.honey + HIVE_RETURN_THB.propolis + HIVE_RETURN_THB.colonies;
/** What a farmer earns if nobody buys split colonies. */
export const HIVE_RETURN_NO_COLONY_BUYER = HIVE_RETURN_THB.honey + HIVE_RETURN_THB.propolis;

/**
 * Hives per rai. DOAE gives 4-5 for สวนผสม (mixed orchard), which is the right band for a
 * multi-strata plot; the 10/rai figure is for solid single-species fruit orchards. DOAE's own
 * national statistics divide hive counts by exactly 4.0 to derive pollinated area, which
 * corroborates the lower end.
 */
export const HIVES_PER_RAI = 4;
/** Start small and split, rather than buying a full complement up front. */
export const STARTER_HIVES = 3;
/** Metres. Stated identically across three DOAE documents. */
export const FORAGE_RADIUS_M = 300;

/** Species in this app that ชันโรง pollinates. */
const POLLINATED = new Set([
  'longan', 'mango', 'lychee', 'somsithong', 'rambutan', 'jackfruit', 'coffee',
  'chili', 'pumpkin', 'avocado', 'macadamia', 'cashew', 'tamarindsweet',
  'tamarindsour', 'papaya', 'cacao', 'sesame',
]);

export interface BeePlan {
  starterHives: number;
  /** What the plot could eventually support at DOAE's mixed-orchard density. */
  fullHives: number;
  setupCost: number;
  /** Annual return once established, if colonies can be sold. */
  returnFull: number;
  /** Annual return if nobody buys colonies — the realistic floor. */
  returnFloor: number;
  /** Species in this plan that the bees will pollinate. */
  pollinates: string[];
  /** True when the plot has nothing for them to forage on. */
  noForage: boolean;
}

export function beePlan(sizeRai: number, picks: LayerPick[]): BeePlan {
  const pollinates = picks.filter((p) => POLLINATED.has(p.plant.id)).map((p) => p.plant.nameTh);
  const fullHives = Math.max(1, Math.round(Math.max(0, sizeRai) * HIVES_PER_RAI));
  const starterHives = Math.min(STARTER_HIVES, fullHives);
  return {
    starterHives,
    fullHives,
    setupCost: starterHives * HIVE_SETUP_THB,
    returnFull: starterHives * HIVE_RETURN_TOTAL,
    returnFloor: starterHives * HIVE_RETURN_NO_COLONY_BUYER,
    pollinates,
    noForage: pollinates.length === 0,
  };
}

/**
 * Free grazing of native cattle in forest is documented local practice in Nan, and Nan has
 * ~9,761 beef-cattle households. A newly planted plot is browse. This is a constraint the
 * plan must accommodate, not an enterprise to add.
 */
export const CATTLE_WARNING =
  'ถ้าแถวนี้มีการปล่อยวัวเลี้ยงในป่า ต้องกันแปลง 2–3 ปีแรก · ต้นกล้าที่เพิ่งลงถูกวัวกินและเหยียบเสียหายง่ายที่สุด';

/** Pesticide drift is the fastest way to lose hives, and maize is the neighbouring crop. */
export const PESTICIDE_WARNING =
  'ชันโรงตายง่ายจากสารเคมี · ถ้าแปลงข้างเคียงพ่นยาข้าวโพด ควรคุยเรื่องช่วงเวลาพ่นก่อนวางรัง';
