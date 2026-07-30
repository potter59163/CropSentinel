import type { SystemPlan, Layer } from '../data/types';
import { LAYER_META } from '../data/plants';
import { Card } from './ui';
import { PlantGlyph } from './PlantGlyph';
import { CashflowChart } from './CashflowChart';
import { Icon, type IconName } from './Icon';
import { bahtK, pct, nf0 } from '../lib/format';

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
  const bestOtherCarbon = Math.max(...others.map(({ plan }) => plan.carbon10));
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
    sys.carbon10 >= bestOtherCarbon ? `คาร์บอนสูงสุด ${sys.carbon10.toLocaleString('en-US')} tCO₂e/10 ปี` : '',
    sys.scoreParts.riskFit >= bestOtherRisk ? `รับมือความเสี่ยง GISTDA ดีสุด ${pct(sys.scoreParts.riskFit)}` : '',
    sys.scoreParts.suitability >= bestOtherSuit ? `ความเหมาะสมพืชสูงสุด ${pct(sys.scoreParts.suitability)}` : '',
  ].filter(Boolean);
  if (strengths.length) rows.push({ tone: 'ok', text: `จุดที่ชนะทุกแท็บ: ${strengths.join(' · ')}` });

  others.forEach(({ plan, index }) => {
    const wins = [
      sys.profit10 > plan.profit10 + 1000 ? `กำไร ${signedMoney(sys.profit10 - plan.profit10)}` : '',
      paybackValue(sys) < paybackValue(plan) ? `คืนทุนเร็วกว่า ${paybackValue(plan) - paybackValue(sys)} ปี` : '',
      sys.carbon10 > plan.carbon10 + 0.5 ? `คาร์บอน ${signedNumber(Math.round(sys.carbon10 - plan.carbon10), ' tCO₂e')}` : '',
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

export function ResultPlan({ sys, rank, allSystems = [sys] }: { sys: SystemPlan; rank: number; allSystems?: SystemPlan[] }) {
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
                      <div className="agro-plant-name thai">{p.plant.nameTh}</div>
                      {/* shareRai is computed for every pick by the engine but was never
                          rendered, so a farmer was told to plant 4 layers on 10 rai with no
                          idea how much land each one gets. */}
                      <div className="agro-plant-area thai">
                        <Icon name="plot" size={13} /> ปลูกประมาณ <b>{p.shareRai.toFixed(1)} ไร่</b>
                        {p.totalPlants ? ` · ~${nf0(p.totalPlants)} ต้น` : p.plantsPerRai ? ` · ~${nf0(p.plantsPerRai)} ต้น/ไร่` : ''}
                      </div>
                      <div className="agro-plant-yp">ผลผลิต {nf0(p.plant.yieldKgPerRai)} กก./ไร่ · ฿{p.plant.pricePerKg}/กก.</div>
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

      {/* Thai labels: an older farmer reading this on a phone cannot be expected to parse
          "Water fit" or "GISTDA risk". */}
      <div className="agro-score-parts">
        <ScorePart label="ความเป็นวนเกษตร" value={sys.scoreParts.agroforestry} />
        <ScorePart label="ความเหมาะกับพื้นที่" value={sys.scoreParts.suitability} />
        <ScorePart label="ความคุ้มค่าทางเศรษฐกิจ" value={sys.scoreParts.economics} />
        <ScorePart label="ความเหมาะกับปริมาณน้ำ" value={sys.scoreParts.waterFit} />
        <ScorePart label="รับมือความเสี่ยงภัยพิบัติ" value={sys.scoreParts.riskFit} />
        <ScorePart label="การกักเก็บคาร์บอน" value={sys.scoreParts.carbon} />
      </div>

      <div className="agro-system-fit">
        <span>ครบ 4 ชั้น {pct(sys.agroforestryParts.strata)}</span>
        <span>ความหลากหลาย {pct(sys.agroforestryParts.diversity)}</span>
        <span>ร่มเงาเข้ากัน {pct(sys.agroforestryParts.shade)}</span>
        <span>คลุมหน้าดิน {pct(sys.agroforestryParts.soilCover)}</span>
        <span>เป็นแนวกันชน {pct(sys.agroforestryParts.riskBuffer)}</span>
      </div>

      <div className="agro-carbon">
        <span className="agro-carbon-icon"><Icon name="carbon" size={24} /></span>
        <div className="agro-carbon-copy thai">
          <div>กักคาร์บอน ~<b>{sys.carbonPerYear}</b> tCO₂e/ปี · 10 ปีรวม ~<b>{sys.carbon10}</b> tCO₂e</div>
          <span>สินค้าเกษตร 10 ปี {bahtK(sys.productProfit10)} · มูลค่าคาร์บอนอ้างอิง {bahtK(sys.ecosystemValue10)} · ไม่ใช่เครดิตรับรอง</span>
        </div>
      </div>

      {sys.transitionCost > 0 && (
        <div className="agro-transition-strip">
          <span className="agro-carbon-icon"><Icon name="plot" size={23} /></span>
          <div className="agro-carbon-copy thai">
            <div>ต้นทุนเปลี่ยนผ่านแปลงเดิม ~<b>{bahtK(sys.transitionCost)}</b> หักในปีที่ 1</div>
            <span>{sys.transitionNotes[0]}</span>
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
