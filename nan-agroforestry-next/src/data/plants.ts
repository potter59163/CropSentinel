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

/**
 * How each วิสัย is shown to a farmer, and what it means.
 *
 * `chip` exists because two habits are surprising enough that the bare term misleads. ไผ่ is a
 * grass — Bambusoideae is a subfamily of Poaceae, the same family as ข้าว and ตะไคร้ — so it is
 * listed here as "ไผ่ (หญ้า)". Keeping ไผ่ as its own habit alongside หญ้า is not a competing
 * taxonomic claim: วิสัย describes GROWTH FORM, and a woody clumping culm that lives decades
 * behaves nothing like ข้าวไร่ in a planting plan even though the two are relatives.
 *
 * This is also the fix for a promise the layer rewrite made but did not keep. Naming the layers
 * positionally means nothing on screen says what a plant IS, so a farmer seeing ไผ่ grouped with
 * สัก and มะม่วง had no way to learn it is not a tree — the exact confusion the advisory meeting
 * raised. `note` is what a farmer gets when they ask why.
 */
export const HABIT_META: Record<Habit, { chip: string; note: string }> = {
  'ไม้ต้น': {
    chip: 'ไม้ต้น',
    note: 'ไม้เนื้อแข็ง ลำต้นหลักต้นเดียว มีแก่นและวงปี โตทางความสูงและความหนาไปเรื่อย ๆ',
  },
  'ไม้พุ่ม': {
    chip: 'ไม้พุ่ม',
    note: 'ไม้เนื้อแข็งเหมือนกัน แต่แตกหลายลำจากโคน ไม่มีลำต้นหลักต้นเดียว และเตี้ยกว่าไม้ต้น',
  },
  'ไผ่': {
    chip: 'ไผ่ (หญ้า)',
    note: 'ไผ่อยู่ในวงศ์หญ้า (Poaceae) วงศ์เดียวกับข้าวและตะไคร้ ลำแข็งแต่เป็นลำกลวงมีข้อ ไม่ใช่เนื้อไม้ '
      + 'และไม่มีวงปี จึงไม่ใช่ไม้ยืนต้น แม้จะสูงพอ ๆ กัน · โตเต็มลำภายในฤดูเดียว แล้วแตกหน่อใหม่ทุกปีจากเหง้าเดิม',
  },
  'ไม้ล้มลุก': {
    chip: 'ไม้ล้มลุก',
    note: 'ลำต้นอวบน้ำ ไม่มีเนื้อไม้ ส่วนใหญ่ตายลงหลังให้ผลผลิตแล้วปลูกใหม่',
  },
  'ไม้ล้มลุกขนาดใหญ่': {
    chip: 'ไม้ล้มลุกขนาดใหญ่',
    note: 'สูงเท่าต้นไม้แต่ไม่ใช่ต้นไม้ — เช่นกล้วย ที่ "ลำต้น" จริง ๆ คือกาบใบซ้อนกันแน่น ไม่มีเนื้อไม้ '
      + 'ตัดด้วยมีดพร้าได้ และตายทั้งต้นหลังตกเครือ แล้วหน่อข้างขึ้นแทน',
  },
  'ไม้เถา': {
    chip: 'ไม้เถา',
    note: 'ทอดเลื้อยหรือพันหลัก ต้องมีค้างหรือไม้ใหญ่ให้เกาะ จึงเบียดพื้นที่น้อยแต่แย่งแสงชั้นบนได้',
  },
  'หญ้า': {
    chip: 'หญ้า',
    note: 'วงศ์หญ้า (Poaceae) ใบยาวแคบ แตกกอจากเหง้าหรือไหล รากฝอยหนาแน่นจึงยึดหน้าดินได้ดี',
  },
  'เฟิร์น': {
    chip: 'เฟิร์น',
    note: 'ไม่ใช่พืชดอก ขยายพันธุ์ด้วยสปอร์ไม่ใช่เมล็ด ชอบร่มและความชื้นสูง',
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

/**
 * ECONOMIC CORRECTIONS, checked against กรมวิชาการเกษตร field trials and OAE statistics after
 * the maize baseline exposed the plan totals as implausible:
 *
 *   พริก   price 45 -> 20 THB/kg, yield 1,200 -> 900 kg/rai.
 *          DOA multi-year, multi-site trials measured 819-1,044 kg/rai and sold at 11-20
 *          THB/kg (the 20 is taken, i.e. the generous end). The old pair implied 54,000
 *          THB/rai per cycle against a measured ~18,000 — a 3x overstatement on the single
 *          species contributing 46% of the plan's income.
 *   สับปะรด yield 4,000 -> 3,362 kg/rai, price 14 -> 13.5 THB/kg (OAE 2563: 3,362 kg/rai,
 *          13.07 factory / 13.81 fresh).
 *
 * ขมิ้น was NOT changed: the DOA turmeric monograph is a scanned document and no usable Thai
 * yield or price figure could be extracted, so its numbers remain unverified rather than
 * being adjusted on a guess.
 */
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
  P('chili', 'พริก', 'Chili', 'shrub', 'ไม้ล้มลุก', 'พืชผัก', 0, 1200, false, 1, 1, 20, 900, 0.3, 0.2, false, 'med', 3000, 3500, 2, 'chili', 'รายได้ดี เก็บได้หลายรอบ พื้นที่สูงเกินไปจะช้าลงและต้องการแดดพอควร'),
  P('tea', 'ชาเมี่ยง', 'Assam tea', 'shrub', 'ไม้ต้น', 'เครื่องดื่ม', 800, 1600, true, 4, 6, 60, 350, 0.6, 0.3, false, 'med', 7000, 2500, 2, 'tea', 'พืชใต้ร่มดั้งเดิมภาคเหนือ เหมาะภูเขาเย็นชื้น เก็บได้หลายรอบ'),
  P('lemongrass', 'ตะไคร้', 'Lemongrass', 'shrub', 'หญ้า', 'สมุนไพร', 0, 1200, false, 1, 1, 15, 2000, 0.4, 0.15, false, 'low', 2500, 1500, 1, 'lemongrass', 'ปลูกง่าย ทนแล้ง ไล่แมลง เหมาะพื้นที่แดดดีต่ำ-กลาง'),

  // ── พืชคลุมดิน (groundcover) ──
  P('peanut', 'ถั่วลิสง', 'Peanut', 'groundcover', 'ไม้ล้มลุก', 'พืชตระกูลถั่ว', 0, 1500, false, 1, 1, 35, 250, 0.35, 0, true, 'low', 1200, 1500, 2, 'peanut', 'ตรึงไนโตรเจนบำรุงดิน คลุมหน้าดิน เหมาะอากาศอุ่นและดินไม่แฉะ'),
  P('pumpkin', 'ฟักทอง', 'Pumpkin', 'groundcover', 'ไม้เถา', 'พืชเลื้อย', 0, 1200, false, 1, 1, 14, 1800, 0.25, 0, false, 'med', 2500, 2000, 1, 'pumpkin', 'เลื้อยคลุมดิน เก็บง่าย ต้องการแดดและพื้นที่โปร่ง'),
  P('sweetpotato', 'มันเทศ', 'Sweet potato', 'groundcover', 'ไม้เถา', 'พืชเลื้อย/หัว', 0, 1600, false, 1, 1, 18, 2200, 0.35, 0, false, 'low', 2500, 2000, 1, 'sweetpotato', 'คลุมดินดี หัวขายได้ ทนแล้ง ปรับตัวได้กว้าง'),
  P('pineapple', 'สับปะรด', 'Pineapple', 'groundcover', 'ไม้ล้มลุก', 'ไม้ผลล้มลุก', 0, 1000, false, 2, 2, 13.5, 3362, 0.25, 0, false, 'low', 5000, 1500, 1, 'pineapple', 'คลุมดินกันวัชพืช ทนแล้ง เหมาะพื้นที่ร้อนและดินระบายน้ำดี'),

  // ── พืชหัวใต้ดิน (root) ──
  P('ginger', 'ขิง', 'Ginger', 'root', 'ไม้ล้มลุก', 'พืชหัว', 300, 1200, false, 1, 1, 30, 2000, 0.6, 0, false, 'high', 6000, 4000, 1, 'ginger', 'ชอบร่มรำไร รายได้ต่อไร่สูง ต้องการความชื้นสม่ำเสมอ'),
  P('turmeric', 'ขมิ้น', 'Turmeric', 'root', 'ไม้ล้มลุก', 'พืชหัว/สมุนไพร', 200, 1200, false, 1, 1, 18, 2500, 0.65, 0, false, 'med', 3500, 2500, 1, 'turmeric', 'ทนร่มเงาดีมาก เหมาะใต้ไม้ผล/กล้วย ดินต้องไม่แฉะ'),
  P('taro', 'เผือก', 'Taro', 'root', 'ไม้ล้มลุก', 'พืชหัว', 0, 1200, false, 1, 1, 22, 2500, 0.5, 0, false, 'high', 3000, 2500, 1, 'taro', 'ชอบดินชื้น เหมาะที่ลุ่ม/ร่องน้ำใต้ร่ม ไม่เหมาะแล้งจัด'),
  P('galangal', 'ข่า', 'Galangal', 'root', 'ไม้ล้มลุก', 'พืชหัว/เครื่องเทศ', 100, 1200, true, 1, 2, 25, 2000, 0.6, 0, false, 'med', 3000, 2000, 1, 'galangal', 'ทนร่ม ปลูกครั้งเดียวเก็บได้นาน เหมาะต่ำ-กลางถึงพื้นที่สูงไม่หนาวจัด'),

  // ══ Added after the advisory meeting asked for 40+ species and real Nan coverage ══
  // Every record below was researched and then independently verified: scientific name and
  // author against IPNI/GBIF, growth form, elevation band against Thai occurrence records,
  // and — most importantly — the economics. The verification pass caught several fabricated
  // incomes that would have looked entirely plausible on screen: ทองหลางป่า was proposed at
  // 8 THB/kg x 350 kg/rai (5,600 THB/rai/yr, comparable to the maize the app is trying to
  // replace) for a tree with no market at all, now priced at 0 as a service tree; แคบ้าน was
  // proposed at 20,000 THB/rai/yr, three times Nan maize gross, using a Bangkok wholesale
  // price for a flower too perishable to travel 660 km.
  //
  // Species with pricePerKg 0 are SERVICE plants — nitrogen fixers, mulch, erosion control.
  // They earn nothing directly and must not be given an invented price to satisfy the model;
  // their value shows up as the yield of what grows beside them.

  // ── new: canopy ──
  P('krathinyak', 'กระถินยักษ์', 'Giant leucaena (giant ipil-ipil)', 'canopy', 'ไม้ต้น', 'ไม้ใช้สอย/อาหารสัตว์/บำรุงดิน', 0, 800, true, 1, 4, 5.5, 400, 0.2, 0.45, true, 'low', 1000, 1500, 3, undefined, 'ตัดที่ความสูง 50-100 ซม. ก่อนติดฝัก เพื่อกันการแพร่ระบาด และผสมในอาหารสัตว์ไม่เกิน 30%'),
  P('thonglangpa', 'ทองหลางป่า (ทองบก)', 'Forest coral tree', 'canopy', 'ไม้ต้น', 'ไม้บำรุงดิน', 300, 1300, true, 2, 6, 0, 0, 0.3, 0.5, true, 'med', 700, 400, 2, undefined, 'ไม้บังร่มตรึงไนโตรเจนสำหรับแปลงกาแฟ ปลูกด้วยท่อนพันธุ์ใหญ่ปักชำ ตัดแต่งกิ่ง 2 ครั้ง/ปี แล้วสับใบคลุมโคนแทนปุ๋ย ไม่ใช่พืชขาย รายได้มาจากพืชที่ปลูกใต้ร่ม'),
  P('khae-ban', 'แคบ้าน', 'Vegetable hummingbird (Agati)', 'canopy', 'ไม้ต้น', 'ผักพื้นบ้าน/ไม้พี่เลี้ยง', 0, 800, true, 1, 3, 20, 60, 0.15, 0.35, true, 'med', 500, 300, 2, undefined, 'ไม้พี่เลี้ยงโตเร็วที่ตรึงไนโตรเจน เก็บดอกกินและขายตลาดท้องถิ่นได้ตั้งแต่ปีแรก แต่ไม่ทนอากาศต่ำกว่า 10 องศา จึงควรปลูกเฉพาะพื้นที่ต่ำกว่า 800 เมตร'),
  P('jackfruit', 'ขนุน', 'Jackfruit', 'canopy', 'ไม้ต้น', 'ผลไม้', 0, 1200, true, 4, 8, 12, 2000, 0.3, 0.75, false, 'med', 6000, 3000, 1, undefined, 'ปลูกริมแปลงไม่กี่ต้นพอกินพอขายตลาดท้องถิ่น อย่าลงแปลงใหญ่จนกว่าจะมีพ่อค้ารับซื้อแน่นอน'),
  P('tamarindsweet', 'มะขามหวาน', 'Sweet tamarind', 'canopy', 'ไม้ต้น', 'ไม้ผล', 0, 800, true, 4, 8, 45, 550, 0.15, 0.75, false, 'low', 6000, 3000, 1, undefined, 'ปลูกด้วยกิ่งทาบหรือกิ่งเสียบยอด ระยะ 8x8 เมตร (~25 ต้น/ไร่) เริ่มเก็บผลปีที่ 4 ถ้าเพาะเมล็ดต้องรอ 7-10 ปี และทรงพุ่มทึบมาก ต้องเว้นระยะให้พืชชั้นล่างได้แสง'),
  P('tamarindsour', 'มะขามเปรี้ยวยักษ์', 'Giant sour tamarind', 'canopy', 'ไม้ต้น', 'ผลไม้แปรรูป', 0, 800, true, 3, 7, 20, 1400, 0.2, 0.7, false, 'low', 6000, 7600, 1, undefined, 'ปลูกด้วยกิ่งทาบ/เสียบยอด จะเริ่มให้ฝักปีที่ 3 (เพาะเมล็ดต้องรอ 6-8 ปี) ระยะปลูก 8x8 ม. ตากฝักแห้งขายได้ 20-30 บาท/กก. ดีกว่าขายฝักสด เหมาะที่ต่ำ-กลางที่อบอุ่น ไม่เหมาะที่สูงหนาว'),
  P('papaya', 'มะละกอ', 'Papaya', 'canopy', 'ไม้ล้มลุกขนาดใหญ่', 'ไม้ผล', 0, 800, true, 1, 2, 13, 4000, 0.15, 0.3, false, 'high', 25000, 10000, 1, undefined, 'เก็บผลได้ใน 8 เดือน ใช้เป็นรายได้เร็วระหว่างรอไม้ยืนต้นโต แต่ต้องรื้อปลูกใหม่ทุก 2-3 ปี เพราะโรคใบด่างจุดวงแหวน'),
  P('lychee', 'ลิ้นจี่', 'Lychee', 'canopy', 'ไม้ต้น', 'ผลไม้', 200, 1000, true, 4, 8, 15, 372, 0.15, 0.7, false, 'med', 8000, 4000, 1, undefined, 'ต้องการแดดเต็มวัน อย่าปลูกใต้ร่มไม้อื่น และควรหาผู้รับซื้อไว้ล่วงหน้าเพราะราคาตกแรงในปีที่ผลผลิตล้นตลาด'),
  P('somsithong', 'ส้มสีทอง', 'Nan Golden Tangerine', 'canopy', 'ไม้ต้น', 'ไม้ผล', 200, 1200, true, 3, 6, 30, 1021, 0.2, 0.5, false, 'high', 20000, 18000, 1, undefined, 'ต้องมีน้ำรดช่วงแล้ง และใช้กิ่งพันธุ์ปลอดโรคกรีนนิ่งจากสวนส้มในน่าน จึงจะขอใช้ตรา GI ส้มสีทองน่านได้'),
  P('rambutan', 'เงาะ', 'Rambutan', 'canopy', 'ไม้ต้น', 'ผลไม้', 0, 600, true, 4, 8, 20, 900, 0.25, 0.7, false, 'high', 8000, 5700, 1, undefined, 'เงาะปลูกได้เฉพาะที่ราบลุ่มต่ำกว่า 600 ม. และต้องมีน้ำรดตลอดหน้าแล้ง 5 เดือน (พ.ย.-มี.ค.) ถ้าไม่มีระบบน้ำ อย่าปลูก'),

  // ── new: shrub ──
  P('chaom', 'ชะอม (ผักหละ / ผักขา)', 'Cha-om (climbing wattle)', 'shrub', 'ไม้เถา', 'ผักพื้นบ้าน', 0, 1200, true, 1, 2, 40, 35, 0.35, 0.3, true, 'med', 9000, 3500, 30, undefined, 'ปลูกเป็นแนวรั้วขอบแปลง ตัดแต่งไม่ให้สูงเกิน 2 เมตร กันเถาเลื้อยคลุมไม้อื่น และอย่าปลูกเกิน 1 ไร่ เพราะตลาดในพื้นที่รับซื้อจำกัด'),
  P('thuamahae', 'ถั่วมะแฮะ', 'Pigeon pea', 'shrub', 'ไม้พุ่ม', 'ถั่วและพืชบำรุงดิน', 200, 1600, true, 1, 2, 30, 110, 0.15, 0.25, true, 'low', 800, 900, 1, undefined, 'ปลูกกลางแดด อย่าปลูกใต้ร่มไม้ใหญ่เพราะจะไม่ติดฝัก เน้นบำรุงดินและกินในครัวเรือน เพราะยังไม่มีตลาดรับซื้อแน่นอนในน่าน'),
  P('sunnhemp', 'ปอเทือง', 'Sunn hemp', 'shrub', 'ไม้ล้มลุก', 'พืชปุ๋ยสด', 0, 1200, false, 1, 1, 22, 80, 0.2, 0.5, true, 'low', 800, 900, 1, undefined, 'ปลูกฟื้นดินไร่ข้าวโพดเก่า ไถกลบตอนออกดอก 50-60 วันได้ไนโตรเจน หรือปล่อยถึง 120-150 วันเก็บเมล็ดขาย เลือกอย่างใดอย่างหนึ่ง'),
  P('pakwanban', 'ผักหวานบ้าน', 'Katuk (Sweet Leaf)', 'shrub', 'ไม้พุ่ม', 'ผักพื้นบ้าน', 0, 800, true, 1, 2, 50, 40, 0.6, 0.25, false, 'med', 6000, 8000, 24, undefined, 'เก็บยอดขายได้ทุก 10-15 วันตลอดปี ปลูกใต้ร่มเงาไม้ผลได้ดี แต่ต้องทำให้สุกก่อนกินทุกครั้ง ห้ามกินดิบหรือคั้นน้ำดื่ม'),
  P('pakwanpa', 'ผักหวานป่า', 'Wild sweet leaf (pak wan pa)', 'shrub', 'ไม้ต้น', 'ผักพื้นบ้าน', 200, 600, true, 3, 6, 180, 100, 0.6, 0.35, false, 'low', 15000, 3000, 1, undefined, 'ต้องปลูกใต้ไม้พี่เลี้ยง เช่น แค ตะขบ มะขามเทศ ให้ร่มรำไรราว 50% ใน 2-3 ปีแรก ห้ามปลูกใกล้ไผ่หรือมะขาม และห้ามพรวนดินรอบโคนเพราะรากตื้นลอยหน้าดิน'),
  P('pakchiangda', 'ผักเชียงดา', 'Chiang Da (Gymnema)', 'shrub', 'ไม้เถา', 'ผักพื้นบ้าน/สมุนไพร', 200, 1300, true, 1, 3, 40, 80, 0.5, 0.3, false, 'med', 15000, 4000, 10, undefined, 'ปลูกใต้ร่มไม้ผลได้ ทนร่มรำไร แต่ตลาดผักสดยังแคบ ควรหาผู้รับซื้อหรือกลุ่มแปรรูปชาให้ได้ก่อนขยายเกิน 1-2 ไร่'),
  P('longkong', 'ลองกอง', 'Longkong', 'shrub', 'ไม้ต้น', 'ไม้ผล', 0, 600, true, 5, 9, 30, 400, 0.65, 0.55, false, 'high', 10000, 3500, 1, undefined, 'ปลูกเฉพาะพื้นที่ต่ำกว่า 600 เมตร ต้องมีน้ำรดช่วงแล้ง 5-6 เดือน และตัดแต่งทรงพุ่มไม่ให้สูงเกิน 6-8 เมตร เพื่อให้อยู่ใต้ไม้เรือนยอด'),
  P('waidong', 'หวายดง', 'Rattan (wai dong)', 'shrub', 'ไม้เถา', 'ของป่า/ผักพื้นบ้าน', 0, 600, true, 2, 6, 16, 300, 0.6, 0.35, false, 'high', 10000, 3000, 1, undefined, 'ปลูกใต้ร่มไม้ในที่ต่ำกว่า 600 ม. ที่มีน้ำรดช่วงแล้ง ตัดหน่อขายได้ตั้งแต่ปีที่ 2 และต้องหมั่นตัดลำไม่ให้เลื้อยขึ้นคลุมต้นไม้อื่น'),
  P('reao', 'เร่วดง (เร่วใหญ่)', 'Bastard cardamom (Tavoy cardamom)', 'shrub', 'ไม้ล้มลุกขนาดใหญ่', 'สมุนไพร/เครื่องเทศ', 300, 1200, true, 3, 5, 400, 25, 0.8, 0.3, false, 'high', 12000, 3000, 1, undefined, 'ปลูกแซมใต้ร่มยางหรือไม้ผลได้โดยไม่ต้องโค่นต้นเดิม แต่ต้องหาผู้รับซื้อก่อนและเริ่มแค่ 1 ไร่ เพราะติดผลยากถ้าไม่มีแมลงผสมเกสร'),
  P('cacao', 'โกโก้', 'Cacao', 'shrub', 'ไม้ต้น', 'ไม้ผล/พืชอุตสาหกรรม', 200, 700, true, 3, 5, 8, 2400, 0.45, 0.4, false, 'high', 9000, 3500, 1, undefined, 'ปลูกแซมใต้ไม้ผลเดิมได้ ต้องการแสง 50-80% และน้ำสม่ำเสมอในหน้าแล้ง เก็บผลขายได้ทุกเดือนหลังปีที่ 3 แต่ต้องหาผู้รับซื้อให้แน่นอนก่อนปลูก'),

  // ── new: groundcover ──
  P('calopo', 'ถั่วคาโลโปโกเนียม', 'Calopo', 'groundcover', 'ไม้เถา', 'พืชคลุมดิน/ปุ๋ยพืชสด', 0, 1500, false, 1, 1, 0, 0, 0.2, 0.4, true, 'med', 600, 250, 0, undefined, 'ปลูกคลุมดินช่วง 1-4 ปีแรกเพื่อกันดินพังทลายและเพิ่มไนโตรเจน หมั่นตัดเถาที่พันต้นกล้า และจะโรยราเองเมื่อเรือนยอดปิด จึงไม่ใช่พืชถาวร'),
  P('jackbean', 'ถั่วพร้า', 'Jack bean', 'groundcover', 'ไม้ล้มลุก', 'พืชปุ๋ยสด', 0, 1500, false, 1, 1, 0, 0, 0.5, 0, true, 'low', 1000, 700, 1, undefined, 'หว่าน 10-12 กก./ไร่ ต้นฤดูฝน ไถกลบตอนอายุ 30-40 วัน ได้ไนโตรเจนบำรุงดินแทนปุ๋ยเคมี ปลูกไว้ใช้เอง ไม่ใช่พืชขาย และเมล็ดดิบมีพิษ ห้ามให้คนหรือสัตว์กิน'),
  P('centro', 'ถั่วลาย', 'Centro', 'groundcover', 'ไม้เถา', 'พืชคลุมดิน/ปุ๋ยพืชสด', 0, 600, true, 1, 2, 0, 0, 0.8, 0.3, true, 'med', 900, 300, 0, undefined, 'ปลูกคลุมดินใต้ยางหรือไม้ผล ทนร่มได้ถึง 80% ช่วยตรึงไนโตรเจนและกันดินพังบนพื้นที่ลาด แต่ตั้งตัวช้า 4-8 เดือน ต้องดายหญ้าช่วงแรก และไม่มีรายได้ขาย ปลูกเพื่อบำรุงดินเท่านั้น'),
  P('hamata', 'ถั่วฮามาต้า', 'Caribbean stylo', 'groundcover', 'ไม้ล้มลุก', 'พืชอาหารสัตว์/ปรับปรุงดิน', 0, 1000, true, 0, 1, 0, 300, 0.15, 0.2, true, 'low', 1700, 800, 5, undefined, 'หว่านเมล็ด 2 กก./ไร่ เฉพาะที่แดดจัด เช่น แนวกันไฟหรือช่องว่างระหว่างแถวไม้ในช่วง 1-3 ปีแรก เพราะไม่ทนร่มเงา แล้วตัดเลี้ยงวัวได้ทุก 45-60 วัน'),
  P('mungbean', 'ถั่วเขียว (ผิวมัน)', 'Mungbean', 'groundcover', 'ไม้ล้มลุก', 'พืชไร่/ถั่วบำรุงดิน', 0, 1000, false, 1, 1, 22, 150, 0.2, 0.2, true, 'low', 0, 2270, 1, undefined, 'ปลูกคลุมดินช่วง 1-3 ปีแรกก่อนไม้ยืนต้นแตกร่ม คลุกเชื้อไรโซเบียมก่อนหยอดเมล็ด และไถกลบต้นหลังเก็บเกี่ยวเพื่อเพิ่มไนโตรเจนให้ดิน'),
  P('uplandrice', 'ข้าวไร่', 'Upland rice', 'groundcover', 'หญ้า', 'ธัญพืช', 200, 1200, false, 1, 1, 11, 350, 0.2, 0, false, 'med', 1500, 1500, 1, undefined, 'ปลูกแซมช่วงปีที่ 1-3 ที่ไม้ใหญ่ยังไม่คลุม เน้นไว้กินในครัวเรือนไม่ใช่พืชรายได้ และเตรียมแปลงแบบไม่เผา'),
  P('sesame', 'งาดำ', 'Black sesame', 'groundcover', 'ไม้ล้มลุก', 'พืชน้ำมัน', 0, 900, false, 1, 1, 50, 70, 0.1, 0, false, 'low', 1200, 1200, 1, undefined, 'งาต้องการแดดเต็มที่ ปลูกได้เฉพาะแถวว่างช่วง 1-2 ปีแรกก่อนไม้ใหญ่คลุม และต้องยกร่องระบายน้ำเพราะงาตายง่ายเมื่อน้ำขัง'),
  P('pakkut', 'ผักกูด', 'Vegetable fern (paco fern)', 'groundcover', 'เฟิร์น', 'ผักพื้นบ้าน/ผักป่า', 200, 1500, true, 1, 2, 50, 60, 0.6, 0.3, false, 'high', 40000, 13000, 24, undefined, 'ปลูกใต้ร่มกล้วยหรือไม้ผลให้พรางแสงราว 50% ต้องมีน้ำรดตลอดปี เริ่มแค่ 0.5-1 ไร่ และหาผู้รับซื้อให้ได้ก่อนลงมือปลูก'),
  P('vetiver', 'หญ้าแฝก', 'Vetiver', 'groundcover', 'หญ้า', 'อนุรักษ์ดินและน้ำ', 0, 1600, true, 1, 2, 0, 0, 0.2, 0.1, false, 'low', 700, 200, 0, undefined, 'ปลูกขวางความลาดชันเป็นแถวตามแนวระดับ ระยะห่างแถวตามแนวดิ่งไม่เกิน 2 เมตร ขอกล้าฟรีได้ที่สถานีพัฒนาที่ดินน่าน แล้วตัดใบมาคลุมโคนไม้ปีละ 2-3 ครั้ง'),

  // ── ไม้ใช้สอยรอบยาว — ไม่ให้รายได้เลยใน 10 ปี ──
  // ตั้ง price/yield = 0 โดยตั้งใจ: ไม้ท่อนขายเป็น ลบ.ม. ตัดครั้งเดียวรอบ 20-40 ปี ไม่ใช่ กก./ปี
  // การใส่ราคาต่อ กก. แบบรายปีเคยทำให้ประดู่ป่าออกมา 137,500 บาท/ไร่/ปี ซึ่งเป็นไปไม่ได้
  P('yangna', 'ยางนา', 'Yang na (gurjun / keruing)', 'canopy', 'ไม้ต้น', 'ไม้ใช้สอย', 0, 600, true, 25, 40, 0, 0, 0.5, 0.8, false, 'high', 2000, 400, 1, undefined, 'ปลูกเฉพาะที่ลุ่มริมห้วย ริมลำธาร และเชิงเขาตอนล่าง สูงไม่เกิน 600 ม. ต้องเป็นดินลึก ระบายน้ำดี ไม่เอาดินเหนียว อย่าปลูกบนไหล่เขาสูงชันที่แห้ง — ยางนาเป็นไม้ริมน้ำ ไม่ทนแล้ง ปลูกผิด'),
  P('pradu-pa', 'ประดู่ป่า', 'Burma padauk', 'canopy', 'ไม้ต้น', 'ไม้เศรษฐกิจ', 100, 850, true, 20, 30, 0, 0, 0.2, 0.45, true, 'low', 1000, 350, 1, undefined, 'ไม้ชั้นบน โตช้า 20 ปีแรกไม่มีรายได้ ปลูกเป็นเงินออมระยะยาว ไม่ใช่พืชหาเงิน ผลัดใบหน้าแล้ง พืชข้างล่างจึงได้แสงช่วงแล้ง ตรึงไนโตรเจน ทนแล้ง ขอกล้าฟรีได้ที่สถานีเพาะชำกล้าไม้จังหวัดน'),
  P('makhamong', 'มะค่าโมง', 'Makhamong (Afzelia / Makha)', 'canopy', 'ไม้ต้น', 'ไม้เศรษฐกิจเนื้อแข็ง', 150, 650, true, 30, 40, 0, 0, 0.25, 0.65, false, 'med', 1800, 800, 1, undefined, 'ไม้เนื้อแข็งระยะยาว ไม่ใช่พืชสร้างรายได้รายปี — ไม่มีรายได้เลยจนกว่าจะตัดขายได้ ราว 30-40 ปี ปลูกเป็น "เงินออม" และใช้ค้ำประกันเงินกู้ได้ (อยู่ในบัญชีไม้ 58 ชนิด ลำดับที่ 10) ไม่คว'),
  P('daeng', 'แดง', 'Burma Ironwood (Daeng)', 'canopy', 'ไม้ต้น', 'ไม้ใช้สอย', 100, 900, true, 25, 35, 0, 0, 0.2, 0.45, true, 'low', 1600, 700, 1, undefined, 'ไม้ยืนต้นโตช้า ปลูกเป็นเงินก้อนระยะยาวและช่วยยึดหน้าดินบนที่ลาดชัน ไม่ใช่พืชสร้างรายได้ ตัดขายได้เร็วที่สุดราว 25–35 ปี เครื่องมือจึงตั้งรายได้ต่อปี = 0 (ราคาไม้กลุ่มเบญจพรรณซึ่งรว'),
  P('rang', 'รัง', 'Rang (Siamese sal)', 'canopy', 'ไม้ต้น', 'ไม้ใช้สอย/ไม้ทนไฟ', 50, 1000, true, 20, 40, 0, 0, 0.15, 0.5, false, 'low', 1600, 300, 1, undefined, 'ไม้ใช้สอยระยะยาว ไม่ใช่พืชขาย ทนแล้งและทนไฟได้ดีมาก เหมาะปลูกเป็นแนวกันไฟและยึดดินบนที่ลาดชัน ในแผน 10 ปีนี้ไม้รังยังไม่ให้รายได้เลย มีแต่ต้นทุน ต้องรออย่างน้อย 20 ปีจึงตัดใช้ได้ แ'),
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
  krathinyak: 0.55,
  thonglangpa: 0.55,
  'khae-ban': 0.55,
  yangna: 0.9, 'pradu-pa': 0.9, makhamong: 0.9, daeng: 0.9, rang: 0.9,
  jackfruit: 0.55,
  tamarindsweet: 0.55,
  tamarindsour: 0.55,
  papaya: 0.27,
  lychee: 0.55,
  somsithong: 0.55,
  rambutan: 0.55,
  chaom: 0.1,
  thuamahae: 0.27,
  sunnhemp: 0.05,
  pakwanban: 0.27,
  pakwanpa: 0.55,
  pakchiangda: 0.1,
  longkong: 0.55,
  waidong: 0.1,
  reao: 0.27,
  cacao: 0.55,
  calopo: 0.1,
  jackbean: 0.05,
  centro: 0.1,
  hamata: 0.05,
  mungbean: 0.05,
  uplandrice: 0.05,
  sesame: 0.05,
  pakkut: 0.05,
  vetiver: 0.05,
};
export const woodyOf = (id: string) => WOODY_STRUCTURE_INDEX[id] ?? 0.04;

export const byLayer = (layer: Layer) => PLANTS.filter((p) => p.layer === layer);
export const plantById = (id: string) => PLANTS.find((p) => p.id === id)!;
export const CANOPY = byLayer('canopy');
