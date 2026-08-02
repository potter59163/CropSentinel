import type { SystemPlan, Layer } from '../data/types';
import { HABIT_META, LAYER_META } from '../data/plants';
import { Card } from './ui';
import { PlantGlyph } from './PlantGlyph';
import { CashflowChart } from './CashflowChart';
import { Icon, type IconName } from './Icon';
import { PlanConfidence } from './PlanConfidence';
import { provenanceOf, provenanceNote, TIER_META } from '../lib/provenance';
import { bahtK, pct, nf0 } from '../lib/format';
import { incomeGoalStatus } from '../lib/incomeGoal';

const ORDER: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

type CompareTone = 'ok' | 'data' | 'warn';

function suitBadge(p: { suitability: number; source: 'model' | 'envelope'; auc?: number; modelConfidence: 'high' | 'medium' | 'low' | 'expert' }) {
  const cls = p.suitability >= 0.6 ? 'ok' : p.suitability >= 0.4 ? 'warn' : 'risk';
  // A Thai word carries the verdict, so it survives a phone screen in sunlight where
  // the pale tints are indistinguishable and the percentage alone reads as noise.
  const word = p.suitability >= 0.6 ? 'เหมาะ' : p.suitability >= 0.4 ? 'พอได้' : 'เสี่ยง';
  const tag = p.source === 'model'
    ? `SDM · AUC ${p.auc?.toFixed(2)}`
    : p.modelConfidence === 'low'
      // Reachable only when climate is missing, so it is the WEATHER that is absent —
      // blaming the model's AUC here mis-attributed an outage to a bad model.
      ? 'ไม่มีข้อมูลอากาศ · ใช้เกณฑ์ความสูง'
      : 'เกณฑ์ผู้เชี่ยวชาญ (ไม่มีโมเดล)';
  return (
    <span className={`agro-suit ${cls}`}>
      <Icon name={cls === 'ok' ? 'check' : 'warning'} size={12} strokeWidth={2.6} />
      <span className="agro-suit-word thai">{word}</span>
      <span className="agro-suit-pct">{pct(p.suitability)}</span>
      <i className="thai">{tag}</i>
    </span>
  );
}

function ScorePart({ label, value }: { label: string; value: number }) {
  return (
    <div className="agro-score-part">
      <div><span>{label}</span><b>{pct(value)}</b></div>
      <i style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

/**
 * "เป้าหมายรายได้ต่อปี" has been collected in the wizard (InputForm.tsx step 3) and
 * validated in the schema since the form was built, but nothing ever read it back — a
 * farmer could type ฿180,000 and never learn whether any plan actually reached it. This is
 * the missing other half: one line, upfront, next to the numbers it is judging.
 *
 * It reports on two horizons rather than one because the blended 10-year average can
 * legitimately hide a plan that works. A canopy-heavy system with a 5-year lag to first
 * fruit drags that average down in a way that has nothing to do with whether the system
 * ultimately clears the goal — so "not there yet" (average short, mature strong) and "not
 * going to get there" (both short) are told as different, specific stories instead of one
 * verdict that would be right for one of them and false for the other.
 */
function IncomeGoalNote({ sys, targetAnnualIncome }: { sys: SystemPlan; targetAnnualIncome?: number }) {
  if (!targetAnnualIncome || targetAnnualIncome <= 0) return null;
  const g = incomeGoalStatus(targetAnnualIncome, sys.annualAvg, sys.cashflow);

  if (g.meetsOnAverage) {
    return (
      <div className="agro-goal-note is-ok thai">
        <Icon name="check" size={15} strokeWidth={2.6} />
        <span>ถึงเป้าหมายที่ตั้งไว้ — เฉลี่ย <b>{bahtK(g.annualAvg)}</b>/ปี จากเป้า {bahtK(g.target)}/ปี ({pct(g.ratioAvg)})</span>
      </div>
    );
  }
  if (g.meetsAtMaturity) {
    return (
      <div className="agro-goal-note is-warn thai">
        <Icon name="warning" size={15} strokeWidth={2.6} />
        <span>
          ยังไม่ถึงเป้าในช่วงแรก — เฉลี่ยทั้ง 10 ปีอยู่ที่ <b>{bahtK(g.annualAvg)}</b>/ปี ({pct(g.ratioAvg)} ของเป้า)
          เพราะปีแรกๆ ต้นไม้ยังไม่ให้ผล แต่เมื่อระบบโตเต็มที่ (ปีที่ 8–10) คาดว่าจะได้ประมาณ <b>{bahtK(g.matureAnnual)}</b>/ปี ซึ่งถึงเป้าหมาย {bahtK(g.target)}/ปีแล้ว
        </span>
      </div>
    );
  }
  return (
    <div className="agro-goal-note is-risk thai">
      <Icon name="warning" size={15} strokeWidth={2.6} />
      <span>
        ยังห่างจากเป้าหมาย — เมื่อระบบโตเต็มที่ (ปีที่ 8–10) คาดว่าจะได้ประมาณ <b>{bahtK(g.matureAnnual)}</b>/ปี
        ({pct(g.ratioMature)} ของเป้า {bahtK(g.target)}/ปี) ขาดอยู่ประมาณ {bahtK(g.target - g.matureAnnual)}/ปี — ลองเพิ่มพื้นที่ปลูกหรือเปลี่ยนชนิดพืชที่ให้ผลตอบแทนสูงขึ้น
      </span>
    </div>
  );
}

function paybackValue(sys: SystemPlan) {
  return sys.paybackYear ?? 99;
}

function signedMoney(value: number) {
  return `${value >= 0 ? '+' : '-'}${bahtK(Math.abs(value))}`;
}

function signedNumber(value: number, unit = '') {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toLocaleString('en-US')}${unit}`;
}

function scorePoints(value: number) {
  return Math.round(value * 100);
}

function pointGap(value: number) {
  const points = Math.round(Math.abs(value) * 100);
  return points > 0 ? `${points} จุด` : '<1 จุด';
}

function rankLabel(index: number) {
  return `แผน ${index + 1}`;
}

function layerMix(sys: SystemPlan) {
  return ORDER
    .map((layer) => {
      const picks = sys.picks.filter((p) => p.layer === layer).map((p) => p.plant.nameTh);
      if (!picks.length) return null;
      return `${LAYER_META[layer].th}: ${picks.join(', ')}`;
    })
    .filter(Boolean)
    .join(' · ');
}

function comparisonRows(sys: SystemPlan, rank: number, allSystems: SystemPlan[]) {
  const rows: { tone: CompareTone; text: string }[] = [];
  const others = allSystems
    .map((plan, index) => ({ plan, index }))
    .filter(({ plan }) => plan !== sys);

  if (!others.length) {
    return sys.reasons.slice(0, 4).map((text) => ({ tone: 'ok' as CompareTone, text }));
  }

  const bestOtherScore = Math.max(...others.map(({ plan }) => plan.score));
  const bestOtherProfit = Math.max(...others.map(({ plan }) => plan.profit10));
  const fastestOtherPayback = Math.min(...others.map(({ plan }) => paybackValue(plan)));
  const bestOtherRisk = Math.max(...others.map(({ plan }) => plan.scoreParts.riskFit));
  const bestOtherSuit = Math.max(...others.map(({ plan }) => plan.scoreParts.suitability));

  if (sys.score >= bestOtherScore) {
    rows.push({
      tone: 'ok',
      text: `ดีที่สุดภาพรวม: คะแนนรวมสูงกว่าแผนรอง ${pointGap(sys.score - bestOtherScore)} เพราะสมดุลกำไร ความเหมาะสม และความเสี่ยง GISTDA ดีกว่า`,
    });
  } else {
    rows.push({
      tone: 'data',
      text: `เป็นทางเลือกอันดับ ${rank}: คะแนนรวมตามหลังแผนที่ดีที่สุด ${pointGap(bestOtherScore - sys.score)} แต่ยังใช้ดู trade-off เฉพาะด้านได้`,
    });
  }

  if (sys.profit10 >= bestOtherProfit) {
    rows.push({ tone: 'ok', text: `กำไร 10 ปีนำทุกแผน: ${bahtK(sys.profit10)} มากกว่าแผนรอง ${bahtK(sys.profit10 - bestOtherProfit)}` });
  } else if (sys.profit10 > Math.min(...others.map(({ plan }) => plan.profit10))) {
    rows.push({ tone: 'ok', text: `กำไรยังชนะบางแผน: ${bahtK(sys.profit10)} แต่น้อยกว่าแผนที่ทำเงินสุด ${bahtK(bestOtherProfit - sys.profit10)}` });
  }

  if (paybackValue(sys) <= fastestOtherPayback) {
    rows.push({ tone: 'ok', text: `คืนทุนเร็วสุดหรือเท่าดีสุด: ${sys.paybackYear ? `ปีที่ ${sys.paybackYear}` : '> 10 ปี'} เหมาะกับคนอยากลดช่วงรอรายได้` });
  } else {
    rows.push({ tone: 'warn', text: `คืนทุนช้ากว่าแผนเร็วสุด ${paybackValue(sys) - fastestOtherPayback} ปี จึงเหมาะเมื่อยอมรอเพื่อข้อดีด้านอื่น` });
  }

  const strengths = [
    sys.scoreParts.riskFit >= bestOtherRisk ? `รับมือความเสี่ยง GISTDA ดีสุด ${pct(sys.scoreParts.riskFit)}` : '',
    sys.scoreParts.suitability >= bestOtherSuit ? `ความเหมาะสมพืชสูงสุด ${pct(sys.scoreParts.suitability)}` : '',
  ].filter(Boolean);
  if (strengths.length) rows.push({ tone: 'ok', text: `จุดที่ชนะทุกแท็บ: ${strengths.join(' · ')}` });

  others.forEach(({ plan, index }) => {
    const wins = [
      sys.profit10 > plan.profit10 + 1000 ? `กำไร ${signedMoney(sys.profit10 - plan.profit10)}` : '',
      paybackValue(sys) < paybackValue(plan) ? `คืนทุนเร็วกว่า ${paybackValue(plan) - paybackValue(sys)} ปี` : '',
      sys.scoreParts.agroforestry > plan.scoreParts.agroforestry + 0.01 ? `วนเกษตร +${scorePoints(sys.scoreParts.agroforestry - plan.scoreParts.agroforestry)} จุด` : '',
      sys.scoreParts.riskFit > plan.scoreParts.riskFit + 0.01 ? `GISTDA risk +${scorePoints(sys.scoreParts.riskFit - plan.scoreParts.riskFit)} จุด` : '',
      sys.scoreParts.suitability > plan.scoreParts.suitability + 0.01 ? `เหมาะสมพืช +${scorePoints(sys.scoreParts.suitability - plan.scoreParts.suitability)} จุด` : '',
    ].filter(Boolean);

    if (wins.length) {
      rows.push({ tone: 'ok', text: `ดีกว่า${rankLabel(index)} ตรง: ${wins.slice(0, 3).join(' · ')}` });
    } else {
      rows.push({
        tone: 'data',
        text: `${rankLabel(index)}ยังนำตัวเลขหลักบางด้าน แท็บนี้จึงเหมาะเมื่ออยากใช้ชุดพืชนี้มากกว่า: ${layerMix(sys)}`,
      });
    }
  });

  return rows.slice(0, 6);
}

function reasonIcon(tone: CompareTone): IconName {
  if (tone === 'warn') return 'warning';
  if (tone === 'data') return 'info';
  return 'check';
}

export function ResultPlan({ sys, rank, allSystems = [sys], targetAnnualIncome }: { sys: SystemPlan; rank: number; allSystems?: SystemPlan[]; targetAnnualIncome?: number }) {
  const best = rank === 1;
  const comparisons = comparisonRows(sys, rank, allSystems);
  return (
    <Card className={`agro-plan ${best ? 'agro-plan-best' : ''}`}>
      <div className="agro-plan-head">
        <span className={`agro-rank ${best ? 'best' : ''}`}>อันดับ {rank}</span>
        <span className="agro-badge thai">{sys.badge}</span>
        <span className="agro-compat">วนเกษตร fit {pct(sys.scoreParts.agroforestry)}</span>
      </div>

      <div className="agro-stack">
        {ORDER.map((layer) => {
          const rows = sys.picks.filter((p) => p.layer === layer);
          if (!rows.length) return null;
          const m = LAYER_META[layer];
          return (
            <div key={layer} className={`agro-layer layer-${layer}`}>
              <div className="agro-layer-tag"><span className="agro-layer-glyph"><PlantGlyph plantId="" layer={layer} size={18} /></span> {m.th}{layer === 'canopy' ? ` ×${rows.length}` : ''}</div>
              <div className="agro-layer-plants">
                {rows.map((p) => (
                  <div key={p.plant.id} className="agro-plant-row">
                    <span className="agro-plant-icon"><PlantGlyph plantId={p.plant.id} layer={p.layer} size={30} /></span>
                    <div className="agro-plant-main">
                      {/* วิสัย beside the name. The layer is positional now, so this is the
                          only place that says what the plant actually IS — and it is exactly
                          where a farmer who wonders why ไผ่ sits with the tall plants finds
                          out that it is a grass. It has to SAY that, though: the bare word
                          "ไผ่" answers nothing, which is why the label carries the family. */}
                      <div className="agro-plant-name thai">
                        {p.plant.nameTh}
                        <span className="agro-plant-habit" title={HABIT_META[p.plant.habit].note}>
                          {HABIT_META[p.plant.habit].chip}
                        </span>
                        {/* Where this species' money numbers came from. A longan price traceable
                            to a named OAE series and a ผักหวานป่า price inferred from scattered
                            local reports must not look identical on screen. */}
                        <span
                          className={`agro-plant-prov is-${provenanceOf(p.plant.id)}`}
                          title={provenanceNote(p.plant.id) ?? TIER_META[provenanceOf(p.plant.id)].descTh}
                        >
                          {TIER_META[provenanceOf(p.plant.id)].shortTh}
                        </span>
                      </div>
                      {/* shareRai is computed for every pick by the engine but was never
                          rendered, so a farmer was told to plant 4 layers on 10 rai with no
                          idea how much land each one gets. */}
                      <div className="agro-plant-area thai">
                        <Icon name="plot" size={13} /> ปลูกประมาณ <b>{p.shareRai.toFixed(1)} ไร่</b>
                        {p.totalPlants ? ` · ~${nf0(p.totalPlants)} ต้น` : p.plantsPerRai ? ` · ~${nf0(p.plantsPerRai)} ต้น/ไร่` : ''}
                      </div>
                      {/* Service plants (nitrogen fixers, mulch, vetiver) are priced at 0
                          because they genuinely have no market — inventing a price to fill
                          this line would be the fabricated-income error the species rebuild
                          exists to remove. But "ผลผลิต 0 กก./ไร่ · ฿0/กก." reads as a broken
                          field, so say what the plant is actually for instead. */}
                      {p.plant.yearsToYield > 10 ? (
                        // Long-rotation timber. สัก was printing "ผลผลิต 4,000 กก./ไร่ ·
                        // ฿40/กก." — an annual-looking line for a tree that is felled once
                        // after 15+ years, implying ฿160,000/rai/yr of income it never pays.
                        // Same unit error that produced the ฿137,500 ประดู่ป่า record.
                        <div className="agro-plant-yp is-longrot thai">
                          ไม้ใช้สอย · ตัดขายได้ราวปีที่ {p.plant.yearsToYield}
                          {' — '}<b>ไม่มีรายได้ใน 10 ปีนี้</b>
                        </div>
                      ) : p.plant.pricePerKg > 0 ? (
                        <div className="agro-plant-yp">ผลผลิต {nf0(p.plant.yieldKgPerRai)} กก./ไร่ · ฿{p.plant.pricePerKg}/กก.</div>
                      ) : (
                        <div className="agro-plant-yp is-service thai">
                          ไม่ได้ปลูกเพื่อขาย · {p.plant.nFixing ? 'บำรุงดินและตรึงไนโตรเจนให้พืชข้างเคียง' : 'คลุมดินและยึดหน้าดิน'}
                        </div>
                      )}
                      {/* plants.ts carries real Thai agronomy notes that rendered nowhere. */}
                      {p.plant.note && <div className="agro-plant-note thai">{p.plant.note}</div>}
                    </div>
                    {p.pickedBy === 'farmer' && <span className="agro-picked thai">คุณเลือก</span>}
                    {suitBadge(p)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* The engine computes these in Thai (engine.warningsFor) and nothing rendered them,
          so the drainage mismatch, the shade-out caution and the zone-area integrity check
          had no surface anywhere in the app. Placed before the money figures on purpose. */}
      {sys.warnings.length > 0 && (
        <div className="agro-plan-warnings">
          <div className="agro-compare-head">
            <span className="agro-impact-k">ข้อควรระวังก่อนลงมือ</span>
            <b className="thai">เรื่องที่ต้องรู้เกี่ยวกับแผนนี้ ({sys.warnings.length})</b>
          </div>
          <ul className="agro-warn-list">
            {sys.warnings.map((w, i) => (
              <li key={i} className="thai">
                <span className="agro-reason-icon warn"><Icon name="warning" size={13} strokeWidth={2.4} /></span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="agro-kpis">
        <div className="agro-kpi"><div className="agro-kpi-k thai">คืนทุน</div><div className="agro-kpi-v">{sys.paybackYear ? `ปีที่ ${sys.paybackYear}` : '> 10 ปี'}</div></div>
        <div className="agro-kpi"><div className="agro-kpi-k thai">กำไรสะสม 10 ปี</div><div className="agro-kpi-v" style={{ color: sys.profit10 >= 0 ? 'var(--ok)' : 'var(--risk)' }}>{bahtK(sys.profit10)}</div></div>
        <div className="agro-kpi"><div className="agro-kpi-k thai">เฉลี่ย/ปี</div><div className="agro-kpi-v">{bahtK(sys.annualAvg)}</div></div>
      </div>

      <IncomeGoalNote sys={sys} targetAnnualIncome={targetAnnualIncome} />

      {/* Immediately under the headline KPIs, not at the bottom of the page: the -30% price
          case is what turns that big number from a promise into a range, and it only works
          if the farmer reads the two together. */}
      <PlanConfidence sys={sys} />

      {/* Thai labels: an older farmer reading this on a phone cannot be expected to parse
          "Water fit" or "GISTDA risk". */}
      <div className="agro-score-parts">
        <ScorePart label="ความเป็นวนเกษตร" value={sys.scoreParts.agroforestry} />
        <ScorePart label="ความเหมาะกับพื้นที่" value={sys.scoreParts.suitability} />
        <ScorePart label="ความคุ้มค่าทางเศรษฐกิจ" value={sys.scoreParts.economics} />
        <ScorePart label="ความเหมาะกับปริมาณน้ำ" value={sys.scoreParts.waterFit} />
        <ScorePart label="รับมือความเสี่ยงภัยพิบัติ" value={sys.scoreParts.riskFit} />
        <ScorePart label="ความเป็นไม้ยืนยาว" value={sys.scoreParts.woodyStructure} />
      </div>

      <div className="agro-system-fit">
        <span>ครบ 4 ชั้น {pct(sys.agroforestryParts.strata)}</span>
        <span>ความหลากหลาย {pct(sys.agroforestryParts.diversity)}</span>
        <span>ร่มเงาเข้ากัน {pct(sys.agroforestryParts.shade)}</span>
        <span>คลุมหน้าดิน {pct(sys.agroforestryParts.soilCover)}</span>
        <span>เป็นแนวกันชน {pct(sys.agroforestryParts.riskBuffer)}</span>
      </div>

      {/* Replaces a panel that printed "กักคาร์บอน ~X tCO₂e" plus "มูลค่าคาร์บอนอ้างอิง ฿Y".
          Both numbers were uncited, the tonnage ran 2-4x above the only verified Thai
          smallholder figure, and the baht value monetised it at an unsourced 220 THB/tCO₂e —
          money a Nan farmer cannot actually collect. T-VER needs ≥10 rai, legal land-use
          documents (which much คทช. land in Nan lacks) and ~50,000-75,000 THB of year-one
          validation cost against a few hundred baht a year of credit value. RECOFTC, this
          project's own partner, states plainly that it does not offer carbon credits because
          certification is too expensive and it marginalises smallholders. So the claim is
          qualitative now, with no number to plant on. Full reasoning in Methodology. */}
      <div className="agro-eco-note thai">
        <span className="agro-eco-note-ic"><Icon name="tree" size={22} /></span>
        <div>
          <b>ไม้ยืนต้นในแผนนี้ช่วยฟื้นดินและยึดหน้าดินระยะยาว</b>
          <span>
            ระบบไม่แสดงตัวเลขคาร์บอนหรือมูลค่าคาร์บอน เพราะการขายคาร์บอนเครดิตยังไม่คุ้มและยังทำไม่ได้จริง
            สำหรับแปลงขนาดนี้ — ดูเหตุผลและที่มาได้ในหน้า “วิธีการ”
          </span>
        </div>
      </div>

      {/* Notes can matter with no cost attached — a maize plot needs no clearing but still
          carries a herbicide window, and standing rubber is cash-POSITIVE once the กยท.
          replanting grant lands. Gating this on cost > 0 hid exactly those cases. */}
      {(sys.transitionCost > 0 || sys.transitionNotes.length > 0) && (
        <div className="agro-transition-strip">
          <span className="agro-transition-ic"><Icon name="plot" size={23} /></span>
          <div className="agro-transition-copy thai">
            {sys.transitionCost > 0 && (
              <div>ต้นทุนเปลี่ยนผ่านแปลงเดิม ~<b>{bahtK(sys.transitionCost)}</b> หักในปีที่ 1</div>
            )}
            {/* Every note, not only the first. The engine works out the year-0 actions —
                burn window, herbicide carry-over, acid correction, the กยท. grant — and all
                but one were dropped between the model and the screen. */}
            <ul className="agro-transition-notes">
              {sys.transitionNotes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        </div>
      )}

      <CashflowChart cashflow={sys.cashflow} paybackYear={sys.paybackYear} />

      <div className="agro-sensitivity">
        <div className="agro-compare-head">
          <span className="agro-impact-k">Price sensitivity</span>
          <b className="thai">ถ้าราคาพืชแกว่ง ผลลัพธ์เปลี่ยนอย่างไร</b>
        </div>
        <div className="agro-sensitivity-grid">
          {sys.sensitivity.map((s) => (
            <div key={s.id} className={s.id === 'base' ? 'on' : ''}>
              <span className="thai">{s.label}</span>
              <b style={{ color: s.profit10 >= 0 ? 'var(--ok)' : 'var(--risk)' }}>{bahtK(s.profit10)}</b>
              <em className="thai">{s.paybackYear ? `คืนทุนปี ${s.paybackYear}` : 'ยังไม่คืนทุนใน 10 ปี'}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="agro-soil-proxy">
        <span className="agro-impact-k">Soil health proxy</span>
        <b className="thai">ดิน/ระบบนิเวศโดยประมาณ: {sys.soilHealth.label} ({pct(sys.soilHealth.score)})</b>
        <div className="thai">{sys.soilHealth.signals.slice(0, 3).join(' · ')}</div>
        <small className="thai">{sys.soilHealth.limitations.join(' · ')}</small>
      </div>

      <div className="agro-compare">
        <div className="agro-compare-head">
          <span className="agro-impact-k">Compare tabs</span>
          <b className="thai">แท็บนี้ดีกว่าแผนอื่นยังไง</b>
        </div>
        <div className="agro-reasons">
          {comparisons.map((row, i) => (
            <div key={i} className="agro-reason thai">
              <span className={`agro-reason-icon ${row.tone}`}><Icon name={reasonIcon(row.tone)} size={13} strokeWidth={2.4} /></span>
              {row.text}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
