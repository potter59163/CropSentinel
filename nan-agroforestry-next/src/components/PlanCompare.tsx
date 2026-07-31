import type { SystemPlan, FarmInput } from '../data/types';
import { Icon } from './Icon';
import { baht, bahtK, pct } from '../lib/format';
import {
  type PinnedPlan, type MetricDelta,
  plotIdentity, metricsOf, comparabilityIssues, diffPicks, metricDeltas, deltaDirection,
} from '../lib/comparison';

const fmt = (v: number | null, f: MetricDelta['format']) => {
  if (v === null || !Number.isFinite(v)) return f === 'year' ? 'ไม่คืนทุนใน 10 ปี' : '—';
  if (f === 'baht') return baht(v);
  if (f === 'year') return `ปีที่ ${v}`;
  if (f === 'pct') return pct(v);
  return `${v.toFixed(1)} tCO₂e`;
};

const fmtDelta = (d: number, f: MetricDelta['format']) => {
  const sign = d > 0 ? '+' : '−';
  const a = Math.abs(d);
  if (f === 'baht') return sign + bahtK(a);
  if (f === 'year') return `${sign}${a} ปี`;
  if (f === 'pct') return `${sign}${Math.round(a * 100)}%`;
  return `${sign}${a.toFixed(1)} tCO₂e`;
};

/**
 * Side-by-side comparison of a pinned plan against the one on screen.
 *
 * Exists because the app previously made swapping one species a destructive act: you re-ran,
 * the old numbers were gone, and the only way to compare was to write them on paper. That is
 * exactly the decision a farmer is making — "durian or longan in the canopy" — so it should
 * be the thing the tool is best at.
 *
 * The comparability guard is not a nicety. If the pinned run was for a different plot or
 * under different price overrides, the delta column is BLANKED and the reason stated,
 * because a ฿200k difference that actually came from resizing the plot from 5 to 12 rai
 * would otherwise read as "this species earns ฿200k more".
 */
export function PlanCompare({ pinned, sys, input, rank, onUnpin }: {
  pinned: PinnedPlan | null;
  sys: SystemPlan;
  input: FarmInput;
  rank: number;
  onUnpin: () => void;
}) {
  if (!pinned) return null;

  const current = plotIdentity(input);
  const issues = comparabilityIssues(pinned.plot, current);
  const comparable = issues.length === 0;

  const currentPicks = sys.picks.map((p) => ({
    layer: p.layer, plantId: p.plant.id, nameTh: p.plant.nameTh, suitability: p.suitability,
  }));
  const diff = diffPicks(pinned.picks, currentPicks);
  const deltas = metricDeltas(pinned.metrics, metricsOf(sys));

  // Comparing a plan against itself is the state right after pinning, before the farmer has
  // changed anything. Say so plainly instead of rendering a table of zeros.
  const samePlan = diff.identical && pinned.rank === rank && comparable;

  return (
    <section className="agro-compare" aria-label="เปรียบเทียบแผน">
      <div className="agro-compare-head">
        <span className="agro-impact-k">เปรียบเทียบแผน</span>
        <b className="thai">
          แผนที่เก็บไว้ (แผน {pinned.rank}{pinned.badge ? ` · ${pinned.badge}` : ''}) เทียบกับแผนที่ดูอยู่ (แผน {rank})
        </b>
        <button type="button" className="agro-compare-unpin thai" onClick={onUnpin}>
          <Icon name="arrowLeft" size={14} /> เลิกเทียบ
        </button>
      </div>

      {samePlan && (
        <p className="thai agro-compare-lead">
          ตอนนี้เทียบกับ<b>แผนเดียวกัน</b> · กลับไปหน้า “แก้ไขข้อมูล” เปลี่ยนพืชที่เลือก แล้วกดออกแบบระบบใหม่
          ตัวเลขทั้งสองฝั่งจะขึ้นมาให้เทียบกันตรงนี้
        </p>
      )}

      {!comparable && (
        <div className="agro-compare-invalid thai" role="alert">
          <Icon name="warning" size={16} />
          <span>
            <b>สองแผนนี้เทียบตัวเลขกันตรง ๆ ไม่ได้</b> เพราะ {issues.join(' · ')}
            {' '}— ส่วนต่างที่เห็นไม่ได้มาจากการเปลี่ยนพืชอย่างเดียว
            {' '}จึงแสดงเฉพาะค่าของแต่ละฝั่ง ไม่แสดงผลต่าง
          </span>
        </div>
      )}

      {/* What actually changed in the mix — the reason for the comparison. */}
      {!diff.identical && (
        <div className="agro-compare-swap">
          {diff.removed.length > 0 && (
            <div className="agro-compare-swap-row out">
              <span className="thai agro-compare-swap-k">เอาออก</span>
              <b className="thai">{diff.removed.map((p) => p.nameTh).join(' · ')}</b>
            </div>
          )}
          {diff.added.length > 0 && (
            <div className="agro-compare-swap-row in">
              <span className="thai agro-compare-swap-k"><Icon name="checkCircle" size={13} /> ใส่เข้ามา</span>
              <b className="thai">{diff.added.map((p) => p.nameTh).join(' · ')}</b>
            </div>
          )}
          {diff.kept.length > 0 && (
            <div className="agro-compare-swap-row same">
              <span className="thai agro-compare-swap-k">เหมือนเดิม</span>
              <span className="thai">{diff.kept.map((p) => p.nameTh).join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      <div className="agro-compare-table" role="table">
        <div className="agro-compare-r agro-compare-hdr" role="row">
          <span role="columnheader" className="thai">ตัวชี้วัด</span>
          <span role="columnheader" className="thai">แผนที่เก็บไว้</span>
          <span role="columnheader" className="thai">แผนที่ดูอยู่</span>
          <span role="columnheader" className="thai">ต่างกัน</span>
        </div>
        {deltas.map((d) => {
          const dir = deltaDirection(d);
          return (
            <div className="agro-compare-r" role="row" key={d.key}>
              <span role="cell" className="thai agro-compare-k">{d.label}</span>
              <span role="cell" className="agro-compare-v">{fmt(d.pinned, d.format)}</span>
              <span role="cell" className="agro-compare-v">{fmt(d.current, d.format)}</span>
              <span role="cell" className={`agro-compare-d ${comparable ? dir : 'void'}`}>
                {!comparable ? '—'
                  : d.delta === null ? '—'
                    // A sub-display-precision delta reads as "เท่ากัน", not as "−0%".
                    : dir === 'flat' ? 'เท่ากัน'
                      : fmtDelta(d.delta, d.format)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="thai agro-compare-foot">
        ตัวเลขทั้งหมดเป็น<b>ค่าประมาณจากราคาและผลผลิตอ้างอิง</b> ไม่ใช่การรับประกันรายได้
        · ส่วนต่างเล็กน้อย (หลักพันบาทใน 10 ปี) ถือว่า<b>ไม่ต่างกันจริง</b> ให้เลือกจากสิ่งที่ปลูกไหวและมีคนรับซื้อมากกว่า
      </p>
    </section>
  );
}
