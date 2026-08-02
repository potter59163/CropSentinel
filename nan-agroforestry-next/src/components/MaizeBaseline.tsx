import type { MaizeBaseline as Baseline } from '../lib/nabc';
import { maizeTenYear } from '../lib/nabc';
import { Icon } from './Icon';
import { baht, bahtK, nf0 } from '../lib/format';

/**
 * "ถ้าปลูกข้าวโพดต่อไป จะได้เท่าไร" — the reference point the tool never had.
 *
 * The app's entire premise is converting maize land, yet it never said what that maize was
 * actually earning, so a farmer had nothing to judge a ten-year projection against. The yield
 * here is the only genuinely Nan-specific number in the whole app: 693 kg/rai from NABC's
 * province-level series, against a national ~790, so a national figure would overstate a Nan
 * harvest by about 14%.
 *
 * It also does something uncomfortable and necessary: it shows the agroforestry figure as a
 * multiple of the maize one. Successive corrections have brought that from 24x down to about
 * 8x, but the measured range for real Thai agroforestry plots is 64-7,665 THB/rai/yr (กรมป่าไม้
 * 2558), so the plan side is still high. The honest response is to say so on the same screen
 * rather than let a farmer — or a reviewer — discover it. The maize side is the
 * better-grounded of the two; the plan side rests on assumptions set out in
 * docs/METHODOLOGY.md §7, §16 and §17.
 */
export function MaizeBaseline({ baseline, sizeRai, planProfit10 }: {
  baseline: Baseline | null;
  sizeRai: number;
  planProfit10: number;
}) {
  if (!baseline || !Number.isFinite(sizeRai) || sizeRai <= 0) return null;

  const maize10 = maizeTenYear(baseline, sizeRai);
  const ratio = maize10 > 0 ? planProfit10 / maize10 : null;
  // Past this the difference stops being a comparison and becomes a claim needing defence.
  const gapImplausible = ratio != null && ratio > 5;

  const areaDropPct = baseline.areaEarliestRai && baseline.areaEarliestRai > 0
    ? Math.round((1 - baseline.areaRai / baseline.areaEarliestRai) * 100)
    : null;

  return (
    <section className="agro-baseline" aria-label="เทียบกับการปลูกข้าวโพดต่อ">
      <div className="agro-compare-head">
        <span className="agro-impact-k">จุดเปรียบเทียบ</span>
        <b className="thai">ถ้ายังปลูกข้าวโพดต่อไป 10 ปี ได้เท่าไร</b>
      </div>

      <div className="agro-baseline-grid">
        <div className="agro-baseline-cell maize">
          <span className="thai">ปลูกข้าวโพดต่อ · {sizeRai} ไร่ · 10 ปี</span>
          <b>{baht(maize10)}</b>
          <span className="thai">≈ {baht(baseline.netPerRaiYear)}/ไร่/ปี</span>
        </div>
        <div className="agro-baseline-cell plan">
          <span className="thai">แผนวนเกษตรนี้ · 10 ปี</span>
          <b>{baht(planProfit10)}</b>
          {ratio != null && <span className="thai">≈ {ratio.toFixed(0)} เท่าของข้าวโพด</span>}
        </div>
      </div>

      <div className="agro-baseline-calc thai">
        <b>ที่มาของตัวเลขข้าวโพด</b>
        <span>
          ผลผลิต <b>{nf0(baseline.yieldKgPerRai)} กก./ไร่</b> (น่าน ปี {baseline.yieldYear})
          {' × '}ราคา <b>{baseline.pricePerKg} บาท/กก.</b> ({baseline.priceMonth}/{baseline.priceYear})
          {' − '}ต้นทุน <b>{nf0(baseline.costPerRai)} บาท/ไร่/ปี</b>
          {' = '}<b>{baht(baseline.netPerRaiYear)}/ไร่/ปี</b>
        </span>
      </div>

      {gapImplausible && (
        <div className="agro-baseline-warn thai" role="alert">
          <Icon name="warning" size={16} />
          <span>
            <b>ช่องว่างนี้กว้างเกินกว่าจะเชื่อได้ทั้งหมด</b> — ตัวเลขข้าวโพดมีที่มาชัดกว่าตัวเลขแผนมาก
            {' '}· แปลงวนเกษตรที่วัดจริงในไทยได้ราว <b>64–7,665 บาท/ไร่/ปี</b> (กรมป่าไม้ 2558)
            {' '}· <b>ใช้เป็นการเปรียบเทียบทิศทาง ไม่ใช่ตัวเลขที่จะเอาไปกู้เงิน</b>
          </span>
        </div>
      )}

      {areaDropPct != null && areaDropPct > 0 && (
        <p className="thai agro-baseline-trend">
          <Icon name="info" size={14} />
          {' '}พื้นที่ปลูกข้าวโพดใน จ.น่าน ลดลง <b>{areaDropPct}%</b> ในช่วง {baseline.areaEarliestYear}–{baseline.yieldYear}
          {' '}({nf0(baseline.areaEarliestRai ?? 0)} → {nf0(baseline.areaRai)} ไร่) — เกษตรกรจำนวนมากเปลี่ยนไปแล้ว
        </p>
      )}

      {/* The snapshot date matters: yield is published annually so it ages slowly, but the
          price is a monthly series frozen at the moment the snapshot was taken. A visibly
          dated number is honest; a silently stale one is not. */}
      <div className="agro-gistda-src">
        ผลผลิต: NABC AgriAPI ระดับจังหวัด (น่าน TH55) · ราคา: สศก. รายเดือน <b>ระดับประเทศ</b> — ราคาที่จุดรับซื้อในหมู่บ้านมักต่ำกว่า
        {' '}· ต้นทุน: สศก. ธันวาคม 2563
        {baseline.fetchedAt ? ` · ดึงข้อมูลเมื่อ ${baseline.fetchedAt}` : ''}
      </div>
    </section>
  );
}
