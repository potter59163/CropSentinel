import type { SystemPlan } from '../data/types';
import { Icon } from './Icon';
import { baht } from '../lib/format';
import {
  beePlan, HIVE_RETURN_THB, FORAGE_RADIUS_M, HIVES_PER_RAI,
  CATTLE_WARNING, PESTICIDE_WARNING,
} from '../lib/bees';

/**
 * ชันโรง — optional, and the only animal component in the tool.
 *
 * Presented as a return SPLIT rather than a single figure, because 60% of the published
 * 2,500 ฿/hive/yr is selling split colonies. A farmer with no colony buyer earns 1,000. Every
 * other number in this app has been rebuilt to stop presenting conditional income as though
 * it were certain; showing "2,500 บาท/รัง/ปี" here would reintroduce exactly that.
 */
export function BeeCard({ sys, sizeRai }: { sys: SystemPlan; sizeRai: number }) {
  const b = beePlan(sizeRai, sys.picks);

  return (
    <details className="agro-bees">
      <summary className="thai">
        <Icon name="sprout" size={17} /> เลี้ยงชันโรงเสริมในแปลงนี้ได้ไหม (ไม่ใช้พื้นที่เพิ่ม)
      </summary>

      {b.noForage ? (
        <p className="thai agro-bees-lead">
          แผนนี้ยังไม่มีพืชที่ชันโรงเก็บน้ำหวานได้ · ถ้าอยากเลี้ยง ควรเพิ่มไม้ผลหรือพืชดอก เช่น ลำไย มะม่วง กาแฟ พริก ฟักทอง
        </p>
      ) : (
        <>
          <p className="thai agro-bees-lead">
            ชันโรงบินหาอาหารรัศมี <b>{FORAGE_RADIUS_M} เมตร</b> จึงครอบคลุมทั้งแปลงโดยไม่ต้องกันพื้นที่เพิ่ม
            {' '}· ในแผนนี้ช่วยผสมเกสร <b>{b.pollinates.join(' · ')}</b>
          </p>

          <div className="agro-bees-start">
            <div>
              <span className="thai">เริ่มที่</span>
              <b className="thai">{b.starterHives} รัง</b>
              <span className="thai">ลงทุน {baht(b.setupCost)} ครั้งเดียว</span>
            </div>
            <div>
              <span className="thai">แปลงนี้รองรับได้ถึง</span>
              <b className="thai">~{b.fullHives} รัง</b>
              <span className="thai">{HIVES_PER_RAI} รัง/ไร่ (สวนผสม) · แยกรังเองได้ ไม่ต้องซื้อเพิ่ม</span>
            </div>
          </div>

          {/* The split, not the headline. */}
          <div className="agro-bees-split">
            <b className="thai">รายได้ต่อรัง ต่อปี — มาจากไหนบ้าง</b>
            <div className="agro-bees-bars">
              <div className="agro-bees-bar honey"><span className="thai">น้ำผึ้ง</span><b>{baht(HIVE_RETURN_THB.honey)}</b></div>
              <div className="agro-bees-bar propolis"><span className="thai">ชันโรง (propolis)</span><b>{baht(HIVE_RETURN_THB.propolis)}</b></div>
              <div className="agro-bees-bar colony"><span className="thai">ขายรังที่แยกได้</span><b>{baht(HIVE_RETURN_THB.colonies)}</b></div>
            </div>
            <div className="agro-bees-flag thai">
              <Icon name="warning" size={15} />
              <span>
                <b>60% ของรายได้มาจากการขายรัง ไม่ใช่น้ำผึ้ง</b>
                {' '}· ถ้าไม่มีคนรับซื้อรัง จะเหลือราว {baht(b.returnFloor)} ต่อปี แทนที่จะเป็น {baht(b.returnFull)}
                {' '}— <b>หาคนรับซื้อรังให้ได้ก่อนซื้อรังแรก</b>
              </span>
            </div>
          </div>

          <ul className="thai agro-bees-risks">
            <li>{PESTICIDE_WARNING}</li>
            <li>{CATTLE_WARNING}</li>
          </ul>

          <div className="agro-gistda-src">
            ที่มา: กรมส่งเสริมการเกษตร — ข้อมูลแมลงเศรษฐกิจ (ชันโรง) · RECOFTC ทดลองเลี้ยงชันโรงที่ อ.สันติสุข จ.น่าน
            · ตัวเลขไม่รวมในกราฟรายได้ของแผน
          </div>
        </>
      )}
    </details>
  );
}
