import type { Plant, Layer } from './types';

export const LAYER_META: Record<Layer, { th: string; en: string; emoji: string; desc: string }> = {
  canopy: { th: 'ไม้ยืนต้น', en: 'Canopy', emoji: '🌳', desc: 'ชั้นเรือนยอด — โครงสร้างหลักของระบบ (บังคับ ≥2 ชนิด)' },
  shrub: { th: 'ไม้พุ่ม', en: 'Shrub', emoji: '🌿', desc: 'ชั้นกลาง — รายได้ต่อเนื่องใต้ร่มไม้ใหญ่' },
  groundcover: { th: 'ไม้คลุมดิน', en: 'Ground cover', emoji: '🍃', desc: 'คลุมดิน กันวัชพืช ลดการชะล้าง' },
  root: { th: 'ไม้ลงดิน', en: 'Root crop', emoji: '🫚', desc: 'พืชหัวใต้ดิน — รายได้เร็ว ใช้พื้นที่ใต้ดิน' },
};

// id, nameTh, nameEn, emoji, layer, category, elevMin, elevMax, perennial,
// yToYield, yToMature, price/kg, yield kg/rai, shadeTol, canopyShade, nFix, water,
// estCost, annCost, cyclesPerYear, sdmId, note
const P = (
  id: string, nameTh: string, nameEn: string, emoji: string, layer: Layer, category: string,
  elevMin: number, elevMax: number, perennial: boolean, yToYield: number, yToMature: number,
  pricePerKg: number, yieldKgPerRai: number, shadeTol: number, canopyShade: number,
  nFixing: boolean, water: Plant['water'], establishCostPerRai: number, annualCostPerRai: number,
  cyclesPerYear: number, sdmId: string | undefined, note: string,
): Plant => ({ id, nameTh, nameEn, emoji, layer, category, elevMin, elevMax, perennial, yearsToYield: yToYield, yearsToMature: yToMature, pricePerKg, yieldKgPerRai, shadeTol, canopyShade, nFixing, water, establishCostPerRai, annualCostPerRai, cyclesPerYear, sdmId, note });

export const PLANTS: Plant[] = [
  // ── ไม้ยืนต้น (canopy) ──
  P('banana', 'กล้วยน้ำว้า', 'Banana', '🍌', 'canopy', 'พืชพี่เลี้ยง', 100, 1000, true, 1, 2, 12, 2500, 0.4, 0.4, false, 'high', 4000, 2000, 1, 'banana', 'พี่เลี้ยงให้ร่มเงาไม้ใหญ่ + รายได้ปีแรก'),
  P('mango', 'มะม่วง', 'Mango', '🥭', 'canopy', 'ผลไม้', 100, 700, true, 3, 6, 25, 1000, 0.3, 0.6, false, 'med', 7000, 3500, 1, 'mango', 'ปลูกง่าย ตลาดกว้าง'),
  P('longan', 'ลำไย', 'Longan', '🟤', 'canopy', 'ผลไม้', 200, 800, true, 4, 7, 30, 900, 0.3, 0.6, false, 'med', 8000, 4000, 1, 'longan', 'ตลาดส่งออกใหญ่'),
  P('cashew', 'มะม่วงหิมพานต์', 'Cashew', '🥜', 'canopy', 'ผลไม้เปลือกแข็ง', 100, 600, true, 3, 6, 80, 200, 0.4, 0.5, false, 'low', 6000, 2500, 1, 'cashew', 'ทนแล้ง พื้นที่ต่ำ'),
  P('avocado', 'อะโวคาโด', 'Avocado', '🥑', 'canopy', 'ผลไม้', 400, 1200, true, 4, 7, 60, 1200, 0.3, 0.7, false, 'high', 10000, 4500, 1, 'avocado', 'ตลาดสุขภาพโตเร็ว'),
  P('macadamia', 'แมคคาเดเมีย', 'Macadamia', '🌰', 'canopy', 'ผลไม้เปลือกแข็ง', 700, 1300, true, 5, 8, 200, 160, 0.3, 0.6, false, 'med', 12000, 3500, 1, 'macadamia', 'ราคาสูงมาก ให้ร่มกาแฟได้'),
  P('maikhwaen', 'มะแขว่น', 'Mai khwaen', '🌶', 'canopy', 'เครื่องเทศพื้นถิ่น', 600, 1300, true, 4, 7, 300, 120, 0.4, 0.4, false, 'low', 6000, 2000, 1, 'maikhwaen', 'เครื่องเทศเอกลักษณ์น่าน ราคาสูง'),
  P('bamboo', 'ไผ่ซางหม่น', 'Bamboo', '🎋', 'canopy', 'ไม้เศรษฐกิจ', 200, 1000, true, 3, 4, 15, 1800, 0.4, 0.5, false, 'med', 5000, 1500, 1, 'bamboo', 'โตเร็ว ยึดดินลาดชัน ขายหน่อ+ลำ'),
  P('teak', 'สัก', 'Teak', '🌳', 'canopy', 'ไม้เศรษฐกิจ', 200, 900, true, 15, 20, 40, 4000, 0.2, 0.7, false, 'med', 5000, 1200, 1, 'teak', 'ออมระยะยาว มูลค่าไม้สูงเมื่อโต'),

  // ── ไม้พุ่ม (shrub) ──
  P('coffee', 'กาแฟอาราบิก้า', 'Arabica coffee', '☕', 'shrub', 'กาแฟ', 700, 1400, true, 3, 5, 150, 220, 0.7, 0.35, false, 'med', 9000, 4000, 1, 'coffee', 'ชอบร่มเงา ราคาดี ตลาดน่านแข็งแรง'),
  P('chili', 'พริก', 'Chili', '🌶️', 'shrub', 'พืชผัก', 200, 1000, false, 1, 1, 45, 1200, 0.3, 0.2, false, 'med', 3000, 3500, 2, undefined, 'รายได้ดี เก็บได้หลายรอบ ต้องการแดดพอควร'),
  P('tea', 'ชาเมี่ยง', 'Assam tea', '🍵', 'shrub', 'เครื่องดื่ม', 600, 1500, true, 4, 6, 60, 350, 0.6, 0.3, false, 'med', 7000, 2500, 2, undefined, 'พืชใต้ร่มดั้งเดิมภาคเหนือ เก็บได้หลายรอบ'),
  P('lemongrass', 'ตะไคร้', 'Lemongrass', '🌾', 'shrub', 'สมุนไพร', 100, 1000, false, 1, 1, 15, 2000, 0.4, 0.15, false, 'low', 2500, 1500, 1, undefined, 'ปลูกง่าย ทนแล้ง ไล่แมลง'),

  // ── ไม้คลุมดิน (groundcover) ──
  P('peanut', 'ถั่วลิสง', 'Peanut', '🥜', 'groundcover', 'พืชตระกูลถั่ว', 200, 1200, false, 1, 1, 35, 250, 0.35, 0, true, 'low', 1200, 1500, 2, undefined, 'ตรึงไนโตรเจนบำรุงดิน คลุมหน้าดิน'),
  P('pumpkin', 'ฟักทอง', 'Pumpkin', '🎃', 'groundcover', 'พืชเลื้อย', 200, 1000, false, 1, 1, 14, 1800, 0.25, 0, false, 'med', 2500, 2000, 1, undefined, 'เลื้อยคลุมดิน เก็บง่าย'),
  P('sweetpotato', 'มันเทศ', 'Sweet potato', '🍠', 'groundcover', 'พืชเลื้อย/หัว', 100, 1000, false, 1, 1, 18, 2200, 0.35, 0, false, 'low', 2500, 2000, 1, undefined, 'คลุมดินดี หัวขายได้ ทนแล้ง'),
  P('pineapple', 'สับปะรด', 'Pineapple', '🍍', 'groundcover', 'ไม้ผลล้มลุก', 100, 800, false, 2, 2, 14, 4000, 0.25, 0, false, 'low', 5000, 1500, 1, undefined, 'คลุมดินกันวัชพืช ทนแล้ง'),

  // ── ไม้ลงดิน (root) ──
  P('ginger', 'ขิง', 'Ginger', '🫚', 'root', 'พืชหัว', 300, 1000, false, 1, 1, 30, 2000, 0.6, 0, false, 'high', 6000, 4000, 1, undefined, 'ชอบร่มรำไร รายได้ต่อไร่สูง'),
  P('turmeric', 'ขมิ้น', 'Turmeric', '🟡', 'root', 'พืชหัว/สมุนไพร', 200, 900, false, 1, 1, 18, 2500, 0.65, 0, false, 'med', 3500, 2500, 1, undefined, 'ทนร่มเงาดีมาก ตลาดสมุนไพรต่อเนื่อง'),
  P('taro', 'เผือก', 'Taro', '🟣', 'root', 'พืชหัว', 200, 900, false, 1, 1, 22, 2500, 0.5, 0, false, 'high', 3000, 2500, 1, undefined, 'ชอบดินชื้น เหมาะที่ลุ่มใต้ร่ม'),
  P('galangal', 'ข่า', 'Galangal', '🌱', 'root', 'พืชหัว/เครื่องเทศ', 200, 1000, true, 1, 2, 25, 2000, 0.6, 0, false, 'med', 3000, 2000, 1, undefined, 'ทนร่ม ปลูกครั้งเดียวเก็บได้นาน'),
];

// aboveground + soil carbon sequestration during the productive phase
// (tCO2e / rai / yr). Literature-based estimate: tropical agroforestry ≈ 3–8
// tCO2e/ha/yr; ×0.16 ha/rai. Woody perennials store carbon; annuals ≈ soil only.
export const CO2_PER_RAI_YR: Record<string, number> = {
  bamboo: 1.3, teak: 1.1, macadamia: 0.85, avocado: 0.85, longan: 0.8, mango: 0.8,
  cashew: 0.7, maikhwaen: 0.65, banana: 0.35,
  coffee: 0.35, tea: 0.35, chili: 0.06, lemongrass: 0.06,
  peanut: 0.08, pumpkin: 0.05, sweetpotato: 0.05, pineapple: 0.05,
  ginger: 0.05, turmeric: 0.05, taro: 0.05, galangal: 0.07,
};
export const co2Of = (id: string) => CO2_PER_RAI_YR[id] ?? 0.05;

export const byLayer = (layer: Layer) => PLANTS.filter((p) => p.layer === layer);
export const plantById = (id: string) => PLANTS.find((p) => p.id === id)!;
export const CANOPY = byLayer('canopy');
