import type { SystemPlan } from '../data/types';
import { Icon } from './Icon';
import { stripPlan, firebreakPlan, bambooFireWarning, ALLEY_SWITCH_YEAR, type NeighbourFuel } from '../lib/layout';

/**
 * "ตรงไหนปลูกอะไร" — the answer to the meeting's teak-over-peanut example.
 *
 * Renders one repeating strip (a tree row plus the alley beside it) rather than a plot map,
 * because the strip is the unit กรมป่าไม้'s own farmer handbook uses, it tiles to any plot
 * shape, and it needs no extra input from the farmer. See lib/layout.ts for the sourcing.
 *
 * The load-bearing content is the year split: sun crops in the alley for the first five
 * years, shade-tolerant crops from year six once the canopy closes. That is the published
 * Thai rule, expressed in years rather than in light percentages — and it is what makes the
 * plan internally possible instead of asking a farmer to grow peanuts in the dark.
 */
export function PlantingLayout({ sys, sizeRai, neighbour = 'unknown' }: {
  sys: SystemPlan;
  sizeRai: number;
  neighbour?: NeighbourFuel;
}) {
  const strip = stripPlan(sys);
  const fire = firebreakPlan(sizeRai, neighbour);
  const bamboo = bambooFireWarning(sys.picks);
  const names = (xs: typeof strip.alleyEarly) => xs.map((p) => p.plant.nameTh).join(' · ');

  return (
    <section className="agro-layout" aria-label="ผังปลูกและแนวกันไฟ">
      <div className="agro-compare-head">
        <span className="agro-impact-k">ผังปลูก</span>
        <b className="thai">ปลูกเป็นแถบ · ทำซ้ำไปทั้งแปลง</b>
      </div>

      <p className="thai agro-layout-lead">
        ปลูกไม้ใหญ่<b>เป็นแถวขวางความลาดชัน</b> (ไม่ปลูกตามแนวลาดลง) แล้วเว้นช่องว่างระหว่างแถวไว้ปลูกพืชล่าง
        · ทำแบบนี้ซ้ำไปเรื่อย ๆ จนเต็มแปลง
      </p>

      {/* The strip itself. Two bands, drawn in the order they sit on the ground. */}
      <div className="agro-strip">
        <div className="agro-strip-row">
          <span className="agro-strip-tag row">แถวไม้ใหญ่</span>
          <b className="thai">{names(strip.rowSpecies) || '—'}</b>
        </div>

        <div className="agro-strip-alley">
          <span className="agro-strip-tag alley">ช่องว่างระหว่างแถว</span>
          <div className="agro-strip-years">
            <div className="agro-strip-year">
              <span className="thai">ปีที่ 1–{ALLEY_SWITCH_YEAR - 1} · ยังมีแดด</span>
              <b className="thai">{names(strip.alleyEarly) || 'ยังไม่มีพืชชอบแดดในแผนนี้'}</b>
            </div>
            <div className="agro-strip-arrow" aria-hidden>→</div>
            <div className="agro-strip-year">
              <span className="thai">ปีที่ {ALLEY_SWITCH_YEAR}+ · ร่มเงาปิด</span>
              <b className="thai">{names(strip.alleyLate) || 'ต้องหาพืชทนร่มมาปลูกแทน'}</b>
            </div>
          </div>
        </div>
      </div>

      {strip.shadedOut.length > 0 && (
        <div className="agro-layout-warn thai" role="alert">
          <Icon name="warning" size={16} />
          <span>
            <b>{names(strip.shadedOut)} ชอบแดด</b> — พอถึงปีที่ {ALLEY_SWITCH_YEAR} เรือนยอดปิด ผลผลิตจะลดลงมาก
            {' '}· ปลูกไว้<b>ริมแปลงหรือกลางช่องว่าง</b> ให้ห่างจากแถวไม้ใหญ่ที่สุด และเตรียมเปลี่ยนเป็นพืชทนร่มในปีที่ {ALLEY_SWITCH_YEAR}
          </span>
        </div>
      )}

      {strip.canopyStaysOpen && (
        <p className="thai agro-layout-note">
          เรือนยอดของแผนนี้ไม่ทึบมาก · พืชชอบแดดในช่องว่างยังอยู่ได้ตลอด 10 ปี ไม่ต้องเปลี่ยน
        </p>
      )}

      {/* Firebreak. Separate concern, same page, because both answer "จัดแปลงยังไง". */}
      <div className="agro-firebreak">
        <div className="agro-compare-head">
          <span className="agro-impact-k">แนวกันไฟ</span>
          <b className="thai">กว้าง {fire.widthM} เมตร รอบแปลง</b>
        </div>
        <ul className="thai agro-firebreak-list">
          {fire.advice.map((a) => <li key={a}>{a}</li>)}
        </ul>
        {/* The last clause is the point. This panel used to declare the break unplantable while
            the cashflow above booked income on the whole plot — two answers about the same
            ground, on one screen, erring the profitable way. Saying the deduction happened is
            what makes the two panels one story instead of two. */}
        <p className="thai agro-firebreak-cost">
          แนวกันไฟกินพื้นที่ราว <b>{fire.areaCostRai.toFixed(1)} ไร่</b> จาก {sizeRai} ไร่
          {' '}· เป็นพื้นที่ที่เสียไปเพื่อกันไฟ ไม่ใช่พื้นที่ปลูก
          {' '}· <b>ตัวเลขรายได้ในแผนคิดจาก {Math.max(0, sizeRai - fire.areaCostRai).toFixed(1)} ไร่ที่เหลือแล้ว</b>
        </p>
        {bamboo && (
          <div className="agro-layout-warn thai" role="alert">
            <Icon name="fire" size={16} />
            <span>{bamboo}</span>
          </div>
        )}
        <div className="agro-gistda-src">ที่มา: {fire.sources.join(' · ')}</div>
      </div>
    </section>
  );
}
