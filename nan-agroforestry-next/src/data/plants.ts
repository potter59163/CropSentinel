import type { Plant, Layer, Habit } from './types';

/**
 * Layers are named by POSITION, never by growth form.
 *
 * The old labels made a botanical claim the data could not keep: the top layer was called
 * "ไม้ยืนต้น" (perennial tree) while containing ไผ่ (a grass, Poaceae) and กล้วย (a giant
 * herb, Musaceae) — the error the advisory meeting flagged. Thai references avoid this by
 * naming strata positionally: ALRO's 5-level model uses ไม้ระดับสูง / กลาง / พุ่มเตี้ย /
 * เรี่ยดิน / หัวใต้ดิน, and puts มะพร้าว (a palm) in the tall band and กล้วย in the middle
 * band without calling either a tree.
 *
 * The names below follow โครงการ "สร้างป่า สร้างรายได้" (royal initiative, 2556), which uses
 * exactly these FOUR positional layers — ไม้เรือนยอดชั้นบน / ชั้นรอง / ไม้พุ่ม / ไม้ผิวดิน —
 * and was piloted in NAN province itself (อ.บ่อเกลือ และ อ.เฉลิมพระเกียรติ). That model
 * places ไผ่ in ชั้นรอง and กล้วย in ไม้พุ่ม. Using its vocabulary means the layer scheme has
 * a provincial, government precedent rather than being our invention.
 *
 * Note "ไม้ลงดิน" (the old root label) is not an established Thai term at all; the real ones
 * are ไม้หัวใต้ดิน (ALRO) and ไม้ผิวดิน (สร้างป่า สร้างรายได้).
 *
 * The KEYS stay in English and unchanged — engine.ts, planSchema.ts and
 * FarmInput.selectedByLayer all depend on them.
 */
export const LAYER_META: Record<Layer, { th: string; en: string; desc: string }> = {
  canopy: {
    th: 'ไม้เรือนยอดชั้นบน', en: 'Upper canopy',
    desc: 'ชั้นบนสุด · โครงสร้างและร่มเงาของแปลง (บังคับ ≥2 ชนิด) · รวมพืชสูงที่ไม่ใช่ไม้ต้น เช่น ไผ่ กล้วย',
  },
  shrub: {
    th: 'ไม้ชั้นรอง/ไม้พุ่ม', en: 'Sub-canopy & shrub',
    desc: 'ชั้นรอง · รายได้ต่อเนื่องใต้ร่มชั้นบน',
  },
  groundcover: {
    th: 'พืชคลุมดิน', en: 'Ground cover',
    desc: 'คลุมหน้าดิน กันวัชพืช ลดการชะล้าง',
  },
  root: {
    th: 'พืชหัวใต้ดิน', en: 'Root & tuber',
    desc: 'ใช้พื้นที่ใต้ดิน · รายได้เร็ว เก็บได้ในปีแรก',
  },
};

// id, nameTh, nameEn, layer, habit, category, elevMin, elevMax, perennial,
// yToYield, yToMature, price/kg, yield kg/rai, shadeTol, canopyShade, nFix, water,
// estCost, annCost, cyclesPerYear, sdmId, note
const P = (
  id: string, nameTh: string, nameEn: string, layer: Layer, habit: Habit, category: string,
  elevMin: number, elevMax: number, perennial: boolean, yToYield: number, yToMature: number,
  pricePerKg: number, yieldKgPerRai: number, shadeTol: number, canopyShade: number,
  nFixing: boolean, water: Plant['water'], establishCostPerRai: number, annualCostPerRai: number,
  cyclesPerYear: number, sdmId: string | undefined, note: string,
): Plant => ({ id, nameTh, nameEn, layer, habit, category, elevMin, elevMax, perennial, yearsToYield: yToYield, yearsToMature: yToMature, pricePerKg, yieldKgPerRai, shadeTol, canopyShade, nFixing, water, establishCostPerRai, annualCostPerRai, cyclesPerYear, sdmId, note });

export const PLANTS: Plant[] = [
  // ── ไม้เรือนยอดชั้นบน (canopy) — positional layer: holds a grass (ไผ่) and a giant herb (กล้วย) ──
  P('banana', 'กล้วยน้ำว้า', 'Banana', 'canopy', 'ไม้ล้มลุกขนาดใหญ่', 'พืชพี่เลี้ยง', 0, 1200, true, 1, 2, 12, 2500, 0.4, 0.4, false, 'high', 4000, 2000, 1, 'banana', 'พี่เลี้ยงให้ร่มเงาไม้ใหญ่ + รายได้ปีแรก เหมาะพื้นที่ร้อนชื้นต่ำ-กลาง'),
  P('mango', 'มะม่วง', 'Mango', 'canopy', 'ไม้ต้น', 'ผลไม้', 0, 800, true, 3, 6, 25, 1000, 0.3, 0.6, false, 'med', 7000, 3500, 1, 'mango', 'ปลูกง่าย ตลาดกว้าง ให้ผลผลิตดีในพื้นที่ต่ำ-กลางที่มีช่วงแล้ง'),
  P('longan', 'ลำไย', 'Longan', 'canopy', 'ไม้ต้น', 'ผลไม้', 100, 1000, true, 4, 7, 30, 900, 0.3, 0.6, false, 'med', 8000, 4000, 1, 'longan', 'พืชเศรษฐกิจภาคเหนือ ต้องการช่วงเย็นช่วยกระตุ้นดอก'),
  P('cashew', 'มะม่วงหิมพานต์', 'Cashew', 'canopy', 'ไม้ต้น', 'ผลไม้เปลือกแข็ง', 0, 700, true, 3, 6, 80, 200, 0.4, 0.5, false, 'low', 6000, 2500, 1, 'cashew', 'ทนแล้ง เหมาะพื้นที่ต่ำ-กลางมากกว่าพื้นที่เย็นสูง'),
  P('avocado', 'อะโวคาโด', 'Avocado', 'canopy', 'ไม้ต้น', 'ผลไม้', 700, 1600, true, 4, 7, 60, 1200, 0.3, 0.7, false, 'high', 10000, 4500, 1, 'avocado', 'ตลาดสุขภาพโตเร็ว เหมาะพื้นที่สูงเย็นและน้ำพอ'),
  P('macadamia', 'แมคคาเดเมีย', 'Macadamia', 'canopy', 'ไม้ต้น', 'ผลไม้เปลือกแข็ง', 800, 1600, true, 5, 8, 200, 160, 0.3, 0.6, false, 'med', 12000, 3500, 1, 'macadamia', 'พืชมูลค่าสูงสำหรับพื้นที่สูงเย็น ใช้เป็นเรือนยอดร่วมกาแฟได้'),
  P('maikhwaen', 'มะแขว่น', 'Mai khwaen', 'canopy', 'ไม้ต้น', 'เครื่องเทศพื้นถิ่น', 800, 1200, true, 4, 7, 300, 120, 0.4, 0.4, false, 'low', 6000, 2000, 1, 'maikhwaen', 'เครื่องเทศเอกลักษณ์น่าน เหมาะพื้นที่สูงราว 800-1000+ ม. และดินระบายน้ำดี'),
  P('bamboo', 'ไผ่ซางหม่น', 'Bamboo', 'canopy', 'ไผ่', 'ไม้เศรษฐกิจ', 200, 1000, true, 3, 4, 15, 1800, 0.4, 0.5, false, 'med', 5000, 1500, 1, 'bamboo', 'โตเร็ว ยึดดินลาดชัน ขายหน่อ+ลำ'),
  P('teak', 'สัก', 'Teak', 'canopy', 'ไม้ต้น', 'ไม้เศรษฐกิจ', 100, 1000, true, 15, 20, 40, 4000, 0.2, 0.7, false, 'med', 5000, 1200, 1, 'teak', 'ออมระยะยาว มูลค่าไม้สูงเมื่อโต เหมาะพื้นที่มีฤดูแล้งชัดและดินระบายน้ำดี'),

  // ── ไม้ชั้นรอง/ไม้พุ่ม (shrub) ──
  P('coffee', 'กาแฟอาราบิก้า', 'Arabica coffee', 'shrub', 'ไม้พุ่ม', 'กาแฟ', 800, 1600, true, 3, 5, 150, 220, 0.7, 0.35, false, 'med', 9000, 4000, 1, 'coffee', 'อาราบิก้าควรอยู่พื้นที่สูงเย็น 800-1000+ ม. ชอบร่มเงาและน้ำสม่ำเสมอ'),
  P('chili', 'พริก', 'Chili', 'shrub', 'ไม้ล้มลุก', 'พืชผัก', 0, 1200, false, 1, 1, 45, 1200, 0.3, 0.2, false, 'med', 3000, 3500, 2, 'chili', 'รายได้ดี เก็บได้หลายรอบ พื้นที่สูงเกินไปจะช้าลงและต้องการแดดพอควร'),
  P('tea', 'ชาเมี่ยง', 'Assam tea', 'shrub', 'ไม้ต้น', 'เครื่องดื่ม', 800, 1600, true, 4, 6, 60, 350, 0.6, 0.3, false, 'med', 7000, 2500, 2, 'tea', 'พืชใต้ร่มดั้งเดิมภาคเหนือ เหมาะภูเขาเย็นชื้น เก็บได้หลายรอบ'),
  P('lemongrass', 'ตะไคร้', 'Lemongrass', 'shrub', 'หญ้า', 'สมุนไพร', 0, 1200, false, 1, 1, 15, 2000, 0.4, 0.15, false, 'low', 2500, 1500, 1, 'lemongrass', 'ปลูกง่าย ทนแล้ง ไล่แมลง เหมาะพื้นที่แดดดีต่ำ-กลาง'),

  // ── พืชคลุมดิน (groundcover) ──
  P('peanut', 'ถั่วลิสง', 'Peanut', 'groundcover', 'ไม้ล้มลุก', 'พืชตระกูลถั่ว', 0, 1500, false, 1, 1, 35, 250, 0.35, 0, true, 'low', 1200, 1500, 2, 'peanut', 'ตรึงไนโตรเจนบำรุงดิน คลุมหน้าดิน เหมาะอากาศอุ่นและดินไม่แฉะ'),
  P('pumpkin', 'ฟักทอง', 'Pumpkin', 'groundcover', 'ไม้เถา', 'พืชเลื้อย', 0, 1200, false, 1, 1, 14, 1800, 0.25, 0, false, 'med', 2500, 2000, 1, 'pumpkin', 'เลื้อยคลุมดิน เก็บง่าย ต้องการแดดและพื้นที่โปร่ง'),
  P('sweetpotato', 'มันเทศ', 'Sweet potato', 'groundcover', 'ไม้เถา', 'พืชเลื้อย/หัว', 0, 1600, false, 1, 1, 18, 2200, 0.35, 0, false, 'low', 2500, 2000, 1, 'sweetpotato', 'คลุมดินดี หัวขายได้ ทนแล้ง ปรับตัวได้กว้าง'),
  P('pineapple', 'สับปะรด', 'Pineapple', 'groundcover', 'ไม้ล้มลุก', 'ไม้ผลล้มลุก', 0, 1000, false, 2, 2, 14, 4000, 0.25, 0, false, 'low', 5000, 1500, 1, 'pineapple', 'คลุมดินกันวัชพืช ทนแล้ง เหมาะพื้นที่ร้อนและดินระบายน้ำดี'),

  // ── พืชหัวใต้ดิน (root) ──
  P('ginger', 'ขิง', 'Ginger', 'root', 'ไม้ล้มลุก', 'พืชหัว', 300, 1200, false, 1, 1, 30, 2000, 0.6, 0, false, 'high', 6000, 4000, 1, 'ginger', 'ชอบร่มรำไร รายได้ต่อไร่สูง ต้องการความชื้นสม่ำเสมอ'),
  P('turmeric', 'ขมิ้น', 'Turmeric', 'root', 'ไม้ล้มลุก', 'พืชหัว/สมุนไพร', 200, 1200, false, 1, 1, 18, 2500, 0.65, 0, false, 'med', 3500, 2500, 1, 'turmeric', 'ทนร่มเงาดีมาก เหมาะใต้ไม้ผล/กล้วย ดินต้องไม่แฉะ'),
  P('taro', 'เผือก', 'Taro', 'root', 'ไม้ล้มลุก', 'พืชหัว', 0, 1200, false, 1, 1, 22, 2500, 0.5, 0, false, 'high', 3000, 2500, 1, 'taro', 'ชอบดินชื้น เหมาะที่ลุ่ม/ร่องน้ำใต้ร่ม ไม่เหมาะแล้งจัด'),
  P('galangal', 'ข่า', 'Galangal', 'root', 'ไม้ล้มลุก', 'พืชหัว/เครื่องเทศ', 100, 1200, true, 1, 2, 25, 2000, 0.6, 0, false, 'med', 3000, 2000, 1, 'galangal', 'ทนร่ม ปลูกครั้งเดียวเก็บได้นาน เหมาะต่ำ-กลางถึงพื้นที่สูงไม่หนาวจัด'),
];

/**
 * Relative woody-structure index, 0..1. How much permanent woody biomass a species builds —
 * which is what makes an agroforestry system durable rather than a rotation crop.
 *
 * This REPLACES a table of absolute tCO2e/rai/yr figures. Those figures were uncited (the
 * comment said only "literature-based estimate: 3-8 tCO2e/ha/yr") and, checked against the
 * one verified Thai smallholder number available — TGO's own Green Carbon Bank case in Khon
 * Kaen, 401 tCO2e over 3 years across 365.30 rai, i.e. ~0.366 tCO2e/rai/yr actually credited
 * — the canopy values here were roughly 2-4x too high. They were also monetised at an
 * unsourced 220 THB/tCO2e and printed next to the farmer's real product income.
 *
 * The absolute quantities are gone because they could not be defended. The ORDERING is kept,
 * because it is uncontroversial: bamboo and teak accumulate far more woody biomass per rai
 * than coffee, which accumulates far more than ginger. The engine only ever used this
 * ordinally (normalised against the maximum), so nothing of value is lost.
 *
 * See Methodology.tsx for why carbon credits are not offered to farmers here at all.
 */
export const WOODY_STRUCTURE_INDEX: Record<string, number> = {
  bamboo: 1.00, teak: 0.85, macadamia: 0.65, avocado: 0.65, longan: 0.62, mango: 0.62,
  cashew: 0.54, maikhwaen: 0.50, banana: 0.27,
  coffee: 0.27, tea: 0.27, chili: 0.05, lemongrass: 0.05,
  peanut: 0.06, pumpkin: 0.04, sweetpotato: 0.04, pineapple: 0.04,
  ginger: 0.04, turmeric: 0.04, taro: 0.04, galangal: 0.05,
};
export const woodyOf = (id: string) => WOODY_STRUCTURE_INDEX[id] ?? 0.04;

export const byLayer = (layer: Layer) => PLANTS.filter((p) => p.layer === layer);
export const plantById = (id: string) => PLANTS.find((p) => p.id === id)!;
export const CANOPY = byLayer('canopy');
