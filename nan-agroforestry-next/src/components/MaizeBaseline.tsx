import type { MaizeBaseline as Baseline } from '../lib/nabc';
import { maizeTenYear, MAIZE_COST_PER_RAI_NAN_STUDY } from '../lib/nabc';
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
 * The headline used to be a MULTIPLE — "8x what maize earns". It is now the per-rai
 * difference, because the multiple turned out to be the least stable number on the card.
 * Putting the maize cost on OAE's 2567 full-economic-cost basis, the same one the crop data now
 * uses, dropped maize net from 1,587 to 574 THB/rai/yr and sent the ratio from 13x to 35x. Both
 * inputs got more honest and the headline got less believable: that is what dividing by a
 * near-zero denominator does. The difference is stable under the same change and is the number
 * a farmer can act on.
 *
 * It also does something uncomfortable and necessary: it says on this screen that the plan side
 * is too high. Measured Thai agroforestry plots return 64-7,665 THB/rai/yr (กรมป่าไม้ 2558) and
 * the plans here sit around 20,000. The maize side is much the better grounded of the two; the
 * plan side rests on assumptions set out in docs/METHODOLOGY.md §7, §16 and §17, and most of
 * its income comes from species with no official statistics at all.
 */
export function MaizeBaseline({ baseline, sizeRai, planProfit10 }: {
  baseline: Baseline | null;
  sizeRai: number;
  planProfit10: number;
}) {
  if (!baseline || !Number.isFinite(sizeRai) || sizeRai <= 0) return null;

  const maize10 = maizeTenYear(baseline, sizeRai);
  const planPerRaiYear = planProfit10 / sizeRai / 10;
  const gapPerRaiYear = planPerRaiYear - baseline.netPerRaiYear;

  /**
   * The multiple is only shown when the denominator can carry it.
   *
   * Moving the maize cost onto OAE's 2567 figure — the same full-economic-cost basis the crop
   * data now uses — dropped maize net from 1,587 to 574 THB/rai/yr, and the ratio promptly went
   * from 13x to 35x. Both sides got MORE honest and the headline got less believable, which is
   * the tell that the ratio was never the right headline: dividing by a number close to zero
   * amplifies noise, not signal.
   *
   * The per-rai difference is stable under the same change, and it is the number a farmer can
   * act on — "ได้มากกว่าปีละ X บาท/ไร่" answers the question they actually have.
   */
  const MULTIPLE_NEEDS = 2000; // THB/rai/yr of maize net, below which a ratio is meaningless
  const ratio = baseline.netPerRaiYear >= MULTIPLE_NEEDS && maize10 > 0 ? planProfit10 / maize10 : null;
  // Past this the difference stops being a comparison and becomes a claim needing defence.
  const HIGHEST_MEASURED_TH = 7_665;
  const gapImplausible = planPerRaiYear > HIGHEST_MEASURED_TH;

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
          <span className="thai">
            ต่างกัน <b>{baht(Math.round(gapPerRaiYear))}/ไร่/ปี</b>
            {ratio != null ? ` · ≈ ${ratio.toFixed(0)} เท่า` : ''}
          </span>
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
        {/* Without this line the maize number reads as implausibly low and the farmer has no way
            to know why. OAE prices family labour at the local wage and imputes land rent, so
            this is profit ON TOP OF paying yourself — not cash in hand. Both sides of the
            comparison are on that basis; saying so is what makes them comparable. */}
        <span className="agro-baseline-basis">
          ต้นทุนนี้<b>คิดค่าแรงของครอบครัวเป็นเงินด้วย</b> ตามวิธีของ สศก. — ถ้าท่านลงแรงเอง เงินสดที่ต้องจ่ายจริงจะน้อยกว่านี้มาก
          {' '}และกำไรที่เหลือคือ<b>ส่วนที่ได้เกินค่าแรงตัวเอง</b> · ต้นทุนของแผนวนเกษตรคิดแบบเดียวกัน จึงเทียบกันได้
          {' '}· มีงานวัดจริงในน่าน (บ้านปางปุก อ.สองแคว) ได้ <b>{nf0(MAIZE_COST_PER_RAI_NAN_STUDY)} บาท/ไร่</b> สูงกว่าค่าเฉลี่ยประเทศ
        </span>
      </div>

      {gapImplausible && (
        <div className="agro-baseline-warn thai" role="alert">
          <Icon name="warning" size={16} />
          <span>
            <b>ตัวเลขฝั่งแผนสูงเกินกว่าจะเชื่อได้ทั้งหมด</b> — แผนนี้ให้ <b>{baht(Math.round(planPerRaiYear))}/ไร่/ปี</b>
            {' '}ขณะที่แปลงวนเกษตรที่<b>วัดจริง</b>ในไทยได้ราว <b>64–{nf0(HIGHEST_MEASURED_TH)} บาท/ไร่/ปี</b> (กรมป่าไม้ 2558)
            {' '}· ฝั่งข้าวโพดมีที่มาชัดกว่าฝั่งแผนมาก และรายได้ส่วนใหญ่ของแผนมาจากพืชที่<b>ไม่มีสถิติราชการรองรับ</b>
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
        {' '}· ต้นทุน: สศก. ปี 2567 (คิดค่าแรงครอบครัวและค่าเช่าที่ดินรวมด้วย)
        {baseline.fetchedAt ? ` · ดึงข้อมูลเมื่อ ${baseline.fetchedAt}` : ''}
      </div>
    </section>
  );
}
