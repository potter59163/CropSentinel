import type { SystemPlan, FarmInput } from '../data/types';
import { Icon } from './Icon';
import { baht, bahtK, pct } from '../lib/format';
import {
  type PinnedPlan, type MetricDelta,
  plotIdentity, metricsOf, comparabilityIssues, diffPicks, metricDeltas, deltaDirection,
  verdictOf,
} from '../lib/comparison';

const fmt = (v: number | null, f: MetricDelta['format']) => {
  if (v === null || !Number.isFinite(v)) return f === 'year' ? 'ไม่คืนทุนใน 10 ปี' : '—';
  if (f === 'baht') return baht(v);
  if (f === 'year') return `ปีที่ ${v}`;
  if (f === 'pct') return pct(v);
  return `${v.toFixed(1)} tCO₂e`;
};

/** Unsigned magnitude, for prose like "กำไรเพิ่ม ฿478k" where the word carries the sign. */
const mag = (d: number, f: MetricDelta['format']) => {
  const a = Math.abs(d);
  if (f === 'baht') return bahtK(a);
  if (f === 'year') return `${a} ปี`;
  if (f === 'pct') return `${Math.round(a * 100)}%`;
  return `${a.toFixed(1)} tCO₂e`;
};

const fmtDelta = (d: number, f: MetricDelta['format']) => (d > 0 ? '+' : '−') + mag(d, f);

/** "กำไรสะสม 10 ปี" -> "กำไร" etc. Keeps the verdict sentence short enough to read. */
const SHORT_LABEL: Record<string, string> = {
  profit10: 'กำไร 10 ปี',
  annualAvg: 'รายได้ต่อปี',
  paybackYear: 'ปีคืนทุน',
  transitionCost: 'ต้นทุนเริ่มต้น',
  suitability: 'ความเหมาะสม',
  agroforestry: 'คะแนนวนเกษตร',
  carbon10: 'คาร์บอน',
};

/** "ได้กำไร 10 ปี เพิ่ม ฿478k" / "เสียความเหมาะสม ลด 1%" — direction in words, not just colour. */
const phrase = (d: MetricDelta) => {
  const label = SHORT_LABEL[d.key] ?? d.label;
  const grew = (d.delta ?? 0) > 0;
  // For payback and cost, "more" is the bad direction, so say sooner/later and more/less
  // rather than up/down — "ปีคืนทุนเพิ่ม" reads as good news to a skim.
  if (d.key === 'paybackYear') return `${label}${grew ? 'ช้าลง' : 'เร็วขึ้น'} ${mag(d.delta!, d.format)}`;
  if (d.key === 'transitionCost') return `${label}${grew ? 'สูงขึ้น' : 'ถูกลง'} ${mag(d.delta!, d.format)}`;
  return `${label}${grew ? 'เพิ่ม' : 'ลด'} ${mag(d.delta!, d.format)}`;
};

/**
 * Side-by-side comparison of a pinned plan against the one on screen.
 *
 * The first version of this panel was a bare table and testers could not tell what it was
 * for. Three things changed:
 *   1. The ANSWER comes first. Most people will not read seven rows of numbers, so the
 *      swap and its consequence are stated as a sentence at the top.
 *   2. The columns are named by the species that differs ("แผนเดิม · ขมิ้น" vs
 *      "แผนนี้ · ขิง") instead of by mechanism, because that is the actual question.
 *   3. Right after pinning, nothing has changed yet, so the panel shows what to DO next
 *      with a button that goes straight to the plant picker — rather than a table of zeros.
 *
 * The verdict refuses to name a winner when the two plans trade off (see verdictOf).
 *
 * The comparability guard is not a nicety. If the pinned run was for a different plot or
 * under different price overrides, the delta column is BLANKED and the reason stated,
 * because a ฿200k difference that actually came from resizing the plot from 5 to 12 rai
 * would otherwise read as "this species earns ฿200k more".
 */
export function PlanCompare({ pinned, sys, input, rank, onUnpin, onEditPlants }: {
  pinned: PinnedPlan | null;
  sys: SystemPlan;
  input: FarmInput;
  rank: number;
  onUnpin: () => void;
  onEditPlants: () => void;
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
  const verdict = verdictOf(deltas);

  // Nothing has been changed yet — this is the state immediately after pinning. Showing a
  // table of zeros here is what made the feature unreadable; show the next step instead.
  if (diff.identical && pinned.rank === rank && comparable) {
    return (
      <section className="agro-compare is-waiting" aria-label="เปรียบเทียบแผน">
        <div className="agro-compare-head">
          <span className="agro-impact-k">เปรียบเทียบแผน</span>
          <b className="thai">เก็บแผน {pinned.rank} ไว้แล้ว</b>
          <button type="button" className="agro-compare-unpin thai" onClick={onUnpin}>ยกเลิก</button>
        </div>
        <p className="thai agro-compare-next-lead">
          เก็บตัวเลขของแผนนี้ไว้แล้ว (<b>{baht(pinned.metrics.profit10)}</b> ใน 10 ปี)
          · ต่อไปเลือกทางใดทางหนึ่ง แล้วตัวเลขสองฝั่งจะขึ้นมาเทียบกันตรงนี้
        </p>
        {/* Both paths are shown because testers found neither on their own: the tab path is
            invisible (the tabs look like navigation, not like a comparison), and the re-run
            path is four steps away. */}
        <div className="agro-compare-next">
          <div className="agro-compare-way">
            <span className="agro-compare-way-n">1</span>
            <div className="thai">
              <b>เปลี่ยนพืช แล้วออกแบบใหม่</b>
              <span>อยากรู้ว่าถ้าสลับพืชสักตัวจะดีขึ้นไหม</span>
            </div>
            <button type="button" className="agro-compare-cta thai" onClick={onEditPlants}>
              <Icon name="leaf" size={16} /> ไปเปลี่ยนพืช
            </button>
          </div>
          <div className="agro-compare-way">
            <span className="agro-compare-way-n">2</span>
            <div className="thai">
              <b>กดแผน 2 หรือ แผน 3 ด้านบน</b>
              <span>อยากเทียบกับอีกสองแผนที่ระบบเสนอมาแล้ว</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Name the columns by the species that actually differs — but only in the clean 1-for-1
  // swap, which is the case this feature exists for. With several changes at once a species
  // name in the header would imply it is the only difference.
  const oneForOne = diff.added.length === 1 && diff.removed.length === 1;
  const colPinned = oneForOne ? `แผนเดิม · ${diff.removed[0].nameTh}` : 'แผนที่เก็บไว้';
  const colCurrent = oneForOne ? `แผนนี้ · ${diff.added[0].nameTh}` : 'แผนที่ดูอยู่';

  const VERDICT_COPY: Record<typeof verdict.kind, string> = {
    tie: 'สองแผนนี้ให้ผลใกล้เคียงกัน',
    'current-better': 'แผนนี้ดีกว่าทุกด้านที่วัดได้',
    'pinned-better': 'แผนเดิมดีกว่าทุกด้านที่วัดได้',
    tradeoff: 'แลกกัน — ได้อย่าง เสียอย่าง',
  };

  return (
    <section className="agro-compare" aria-label="เปรียบเทียบแผน">
      <div className="agro-compare-head">
        <span className="agro-impact-k">เปรียบเทียบแผน</span>
        <b className="thai">แผน {pinned.rank} ที่เก็บไว้ เทียบกับแผน {rank} ที่ดูอยู่</b>
        <button type="button" className="agro-compare-unpin thai" onClick={onUnpin}>ยกเลิก</button>
      </div>

      {/* The answer, before the evidence. */}
      {!diff.identical && (
        <p className="thai agro-compare-swapline">
          {oneForOne ? (
            <>เอา <b className="out">{diff.removed[0].nameTh}</b> ออก ใส่ <b className="in">{diff.added[0].nameTh}</b> แทน</>
          ) : (
            <>
              {diff.removed.length > 0 && <>เอาออก <b className="out">{diff.removed.map((p) => p.nameTh).join(' · ')}</b>{' '}</>}
              {diff.added.length > 0 && <>ใส่เข้ามา <b className="in">{diff.added.map((p) => p.nameTh).join(' · ')}</b></>}
            </>
          )}
        </p>
      )}

      {comparable && (
        <div className={`agro-compare-verdict v-${verdict.kind}`}>
          <b className="thai">{VERDICT_COPY[verdict.kind]}</b>
          {(verdict.gains.length > 0 || verdict.losses.length > 0) && (
            <div className="agro-compare-verdict-list thai">
              {verdict.gains.map((d) => (
                <span key={d.key} className="agro-compare-tag up">
                  <Icon name="checkCircle" size={13} /> {phrase(d)}
                </span>
              ))}
              {verdict.losses.map((d) => (
                <span key={d.key} className="agro-compare-tag down">
                  <Icon name="warning" size={13} /> {phrase(d)}
                </span>
              ))}
            </div>
          )}
          {verdict.kind === 'tradeoff' && (
            <span className="thai agro-compare-verdict-note">
              ระบบไม่ตัดสินให้ว่าแผนไหนดีกว่า เพราะขึ้นกับว่าคุณให้น้ำหนักเรื่องไหนมากกว่า
            </span>
          )}
          {verdict.kind === 'tie' && (
            <span className="thai agro-compare-verdict-note">
              เลือกจากสิ่งที่ปลูกไหว หาต้นกล้าได้ และมีคนรับซื้อ จะตรงกว่าดูตัวเลข
            </span>
          )}
        </div>
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

      {diff.kept.length > 0 && (
        <p className="thai agro-compare-kept">
          เหมือนเดิม: {diff.kept.map((p) => p.nameTh).join(' · ')}
        </p>
      )}

      <details className="agro-compare-details">
        <summary className="thai">ดูตัวเลขทั้งหมด</summary>
        <div className="agro-compare-table" role="table">
          <div className="agro-compare-r agro-compare-hdr" role="row">
            <span role="columnheader" className="thai">ตัวชี้วัด</span>
            <span role="columnheader" className="thai">{colPinned}</span>
            <span role="columnheader" className="thai">{colCurrent}</span>
            <span role="columnheader" className="thai">ต่างกัน</span>
          </div>
          {deltas.map((d) => {
            const dir = deltaDirection(d);
            return (
              <div className="agro-compare-r" role="row" key={d.key}>
                <span role="cell" className="thai agro-compare-k">{d.label}</span>
                <span role="cell" className="agro-compare-v">
                  <span className="agro-compare-vlab thai" aria-hidden>{colPinned}</span>
                  {fmt(d.pinned, d.format)}
                </span>
                <span role="cell" className="agro-compare-v">
                  <span className="agro-compare-vlab thai" aria-hidden>{colCurrent}</span>
                  {fmt(d.current, d.format)}
                </span>
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
      </details>

      <div className="agro-compare-foot">
        <p className="thai">
          ตัวเลขเป็น<b>ค่าประมาณจากราคาและผลผลิตอ้างอิง</b> ไม่ใช่การรับประกันรายได้
          · ต่างกันหลักพันบาทใน 10 ปี ถือว่า<b>ไม่ต่างกันจริง</b>
        </p>
        <button type="button" className="agro-compare-again thai" onClick={onEditPlants}>
          <Icon name="leaf" size={15} /> เก็บแผนนี้ แล้วลองเปลี่ยนพืชอีกครั้ง
        </button>
      </div>
    </section>
  );
}
