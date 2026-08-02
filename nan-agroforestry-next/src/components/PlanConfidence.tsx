import type { SystemPlan } from '../data/types';
import { Icon } from './Icon';
import { baht } from '../lib/format';

/**
 * What the headline number is, and is not.
 *
 * The app prints a ten-year profit figure in large type. Read alone that is a promise, and
 * the project is exposed if a farmer plants on it and loses money. The honest framing is
 * that it is one point inside a range, computed under assumptions the farmer can check —
 * so this block does three things and nothing else:
 *
 *   1. Shows the DOWNSIDE in baht, right next to the headline. The engine already computes a
 *      −30% price scenario, but it lived in a "Price sensitivity" panel far below where a
 *      farmer would never connect it to the big number. Price is the variable that flips an
 *      agroforestry plan from profit to loss fastest, and a range is a fundamentally
 *      different claim from a figure.
 *   2. Says plainly that this is an estimate, not guaranteed income and not financial advice.
 *   3. Names the three things to verify locally BEFORE spending money.
 *
 * Deliberately not a wall of legal text. The user is a farmer; a disclaimer nobody reads
 * protects nobody. The full assumptions, formulas and limitations live in docs/METHODOLOGY.md
 * and the in-app "วิธีการ" tab.
 */
export function PlanConfidence({ sys }: { sys: SystemPlan }) {
  const down = sys.sensitivity.find((s) => s.id === 'down30');
  const up = sys.sensitivity.find((s) => s.id === 'up30');

  // A plan can be profitable at the reference price and lossmaking 30% below it. That flip is
  // the single most decision-relevant fact on the page, so it gets its own line.
  const turnsNegative = down != null && down.profit10 < 0 && sys.profit10 >= 0;

  return (
    <section className="agro-confidence" aria-label="ความแน่นอนของตัวเลข">
      <div className="agro-confidence-head">
        <span className="agro-impact-k">ตัวเลขนี้แน่นอนแค่ไหน</span>
        <b className="thai">กำไร 10 ปี เป็น<span className="agro-confidence-em">ช่วง</span> ไม่ใช่ตัวเลขเดียว</b>
      </div>

      {down && up && (
        <div className="agro-confidence-range">
          <div className="agro-confidence-cell down">
            <span className="thai">ถ้าราคาตก 30%</span>
            <b className={down.profit10 < 0 ? 'is-neg' : ''}>{baht(down.profit10)}</b>
          </div>
          <div className="agro-confidence-cell base">
            <span className="thai">ราคาอ้างอิงวันนี้</span>
            <b>{baht(sys.profit10)}</b>
          </div>
          <div className="agro-confidence-cell up">
            <span className="thai">ถ้าราคาขึ้น 30%</span>
            <b>{baht(up.profit10)}</b>
          </div>
        </div>
      )}

      {turnsNegative && (
        <div className="agro-confidence-flip thai" role="alert">
          <Icon name="warning" size={16} />
          <span>
            <b>ระวัง: ถ้าราคาตก 30% แผนนี้ขาดทุน</b>
            {' '}· ราคาสินค้าเกษตรผันผวนได้มากกว่าผลผลิต ควรเผื่อเงินสำรองหรือเลือกแผนที่ทนราคาตกได้ดีกว่า
          </span>
        </div>
      )}

      <p className="thai agro-confidence-what">
        ตัวเลขทั้งหมดเป็น<b>ค่าประมาณจากราคาและผลผลิตอ้างอิง</b> ไม่ใช่รายได้ที่รับประกัน
        และไม่ใช่คำแนะนำการลงทุน · แปลงจริงให้ผลต่างจากนี้ได้ตามการดูแล สภาพอากาศแต่ละปี และราคาที่ขายได้จริง
      </p>

      <div className="agro-confidence-check">
        <b className="thai">ก่อนลงเงินจริง ตรวจ 3 อย่างนี้ในพื้นที่</b>
        <ol className="thai">
          <li><b>ราคารับซื้อจริง</b> — ถามพ่อค้าในพื้นที่ว่ารับซื้อเท่าไร แล้วใส่ทับในแอปได้เลย</li>
          <li><b>สิทธิ์ที่ดิน</b> — ยืนยันกับเจ้าหน้าที่ป่าไม้หรือเกษตรอำเภอก่อนปลูกไม้ยืนต้น</li>
          <li><b>ต้นกล้าและคนให้คำแนะนำ</b> — หาแหล่งต้นกล้าและถามเกษตรอำเภอว่าพืชที่เลือกเหมาะกับแปลงจริงไหม</li>
        </ol>
      </div>
    </section>
  );
}
