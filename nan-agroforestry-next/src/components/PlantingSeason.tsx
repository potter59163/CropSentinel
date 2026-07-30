import { MONTH_TH, formatMonthRange, seasonContext, type Climate } from '../lib/climate';
import { Icon } from './Icon';

/**
 * Planting-season guidance from this plot's own monthly rainfall.
 *
 * Why this exists: the app computed a 10-year cashflow but never told the farmer WHEN to put
 * a seedling in the ground — and in Nan that single decision decides whether it lives. With
 * a 5-month dry season, a tree planted at the wrong end of the year dies before the rains
 * return, and no amount of correct species selection survives that.
 *
 * Scope is deliberately limited to what the data supports. NASA POWER gives real monthly
 * rainfall for this exact plot (already fetched — the annual totals were derived from it),
 * which is enough for the establishment rule common to every perennial: plant at the onset
 * of the rains. It is NOT enough for per-species planting and harvest calendars; those need
 * an agronomist and RECOFTC's existing Nan planting guides, so they are not invented here.
 */
export function PlantingSeason({ climate }: { climate: Climate | null }) {
  const season = seasonContext(climate);
  if (!season) return null;

  const mm = climate!.monthlyPrec!;
  const peak = Math.max(...mm, 1);
  const inWindow = new Set(season.plantingWindow);
  const wet = new Set(season.wetMonths);
  const dry = new Set(season.dryMonths);

  const windowLabel = season.plantingWindow.map((m) => MONTH_TH[m]).join('–');
  // formatMonthRange, not first–last: Nan's dry season crosses December, so a naive range
  // printed "ม.ค.–ธ.ค." and told the farmer the plot was dry all year.
  const dryLabel = formatMonthRange(season.dryMonths) || null;

  return (
    <section className="agro-season">
      <div className="agro-compare-head">
        <span className="agro-impact-k">ช่วงเวลาปลูก</span>
        <b className="thai">ควรลงกล้าเมื่อไหร่ · จากปริมาณฝนรายเดือนของแปลงนี้</b>
      </div>

      {season.onsetMonth !== null ? (
        <div className="agro-season-verdict thai">
          <span className="agro-season-ic"><Icon name="drop" size={22} /></span>
          <div>
            <b>ลงกล้าไม้ยืนต้นช่วง {windowLabel}</b>
            <div>
              ฝนเริ่มสม่ำเสมอเดือน {MONTH_TH[season.onsetMonth]} · ปลูกต้นฤดูฝนให้รากตั้งตัวก่อนเข้าแล้ง
              {dryLabel ? ` (แล้ง ${season.dryMonths.length} เดือน ${dryLabel})` : ''}
            </div>
          </div>
        </div>
      ) : (
        <div className="agro-season-verdict thai">
          <span className="agro-season-ic"><Icon name="info" size={22} /></span>
          <div>
            <b>ฝนกระจายทั้งปี ไม่มีต้นฤดูฝนชัดเจน</b>
            <div>เลือกช่วงปลูกตามคำแนะนำเกษตรอำเภอ และเลี่ยงเดือนที่ฝนน้อยสุด</div>
          </div>
        </div>
      )}

      <div className="agro-season-chart" role="img"
        aria-label={`ปริมาณฝนรายเดือน ${mm.map((v, i) => `${MONTH_TH[i]} ${Math.round(v)} มม.`).join(', ')}`}>
        {mm.map((v, i) => (
          <div key={i} className={`agro-season-col ${inWindow.has(i) ? 'is-plant' : ''} ${wet.has(i) ? 'is-wet' : dry.has(i) ? 'is-dry' : ''}`}>
            <span className="agro-season-mm">{Math.round(v)}</span>
            <i style={{ height: `${Math.max(3, Math.round((v / peak) * 100))}%` }} />
            <span className="agro-season-mon thai">{MONTH_TH[i]}</span>
          </div>
        ))}
      </div>

      <div className="agro-season-legend thai">
        <span><i className="sw is-plant" /> ช่วงลงกล้า</span>
        <span><i className="sw is-wet" /> ฝนดี (≥100 มม.)</span>
        <span><i className="sw is-dry" /> แล้ง (&lt;50 มม.)</span>
      </div>

      {season.needsYear1Irrigation && (
        <div className="agro-season-warn thai">
          <Icon name="warning" size={15} />
          <span>
            แล้ง {season.dryMonths.length} เดือน — <b>ปีแรกต้องมีน้ำรดช่วยช่วงแล้ง</b>
            ไม่งั้นกล้าไม้ยืนต้นมีโอกาสตายสูง · วางแผนแหล่งน้ำหรือคลุมโคนด้วยฟาง/ใบไม้ไว้ก่อนปลูก
          </span>
        </div>
      )}

      <div className="agro-gistda-src">
        คำนวณจากฝนรายเดือน NASA POWER ของพิกัดแปลงนี้ (ค่าเฉลี่ยระยะยาว)
        · เป็นคำแนะนำการตั้งตัวของกล้าโดยรวม <b>ยังไม่ใช่ปฏิทินเฉพาะพืชแต่ละชนิด</b>
        — ช่วงปลูก/เก็บเกี่ยวรายชนิดควรยืนยันกับเกษตรอำเภอหรือคู่มือของ RECOFTC
      </div>
    </section>
  );
}
