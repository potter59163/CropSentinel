import type { SystemPlan, Layer } from '../data/types';
import { LAYER_META } from '../data/plants';
import { Card } from './ui';
import { CashflowChart } from './CashflowChart';
import { bahtK, pct, nf0 } from '../lib/format';

const ORDER: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

type CompareTone = 'ok' | 'data' | 'warn';

function suitBadge(p: { suitability: number; source: 'model' | 'envelope'; auc?: number; modelConfidence: 'high' | 'medium' | 'low' | 'expert' }) {
  const cls = p.suitability >= 0.6 ? 'ok' : p.suitability >= 0.4 ? 'warn' : 'risk';
  const tag = p.source === 'model'
    ? `SDM ${p.modelConfidence} · AUC ${p.auc?.toFixed(2)}`
    : p.modelConfidence === 'low'
      ? `AUC ${p.auc?.toFixed(2)} ต่ำ · ใช้เกณฑ์`
      : 'เกณฑ์ผู้เชี่ยวชาญ';
  return <span className={`agro-suit ${cls}`}>{pct(p.suitability)} <i>{tag}</i></span>;
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
              <div className="agro-layer-tag">{m.emoji} {m.th}{layer === 'canopy' ? ` ×${rows.length}` : ''}</div>
              <div className="agro-layer-plants">
                {rows.map((p) => (
                  <div key={p.plant.id} className="agro-plant-row">
                    <span className="agro-plant-emoji">{p.plant.emoji}</span>
                    <div className="agro-plant-main">
                      <div className="agro-plant-name thai">{p.plant.nameTh}</div>
                      <div className="agro-plant-yp">ผลผลิต {nf0(p.plant.yieldKgPerRai)} กก./ไร่ · ฿{p.plant.pricePerKg}/กก.</div>
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

      <div className="agro-kpis">
        <div className="agro-kpi"><div className="agro-kpi-k thai">คืนทุน</div><div className="agro-kpi-v">{sys.paybackYear ? `ปีที่ ${sys.paybackYear}` : '> 10 ปี'}</div></div>
        <div className="agro-kpi"><div className="agro-kpi-k thai">กำไรสะสม 10 ปี</div><div className="agro-kpi-v" style={{ color: sys.profit10 >= 0 ? 'var(--ok)' : 'var(--risk)' }}>{bahtK(sys.profit10)}</div></div>
        <div className="agro-kpi"><div className="agro-kpi-k thai">เฉลี่ย/ปี</div><div className="agro-kpi-v">{bahtK(sys.annualAvg)}</div></div>
      </div>

      <div className="agro-score-parts">
        <ScorePart label="Agroforest" value={sys.scoreParts.agroforestry} />
        <ScorePart label="Suitability" value={sys.scoreParts.suitability} />
        <ScorePart label="Economics" value={sys.scoreParts.economics} />
        <ScorePart label="Water fit" value={sys.scoreParts.waterFit} />
        <ScorePart label="GISTDA risk" value={sys.scoreParts.riskFit} />
        <ScorePart label="Carbon" value={sys.scoreParts.carbon} />
      </div>

      <div className="agro-system-fit">
        <span>4-layer {pct(sys.agroforestryParts.strata)}</span>
        <span>Diversity {pct(sys.agroforestryParts.diversity)}</span>
        <span>Shade {pct(sys.agroforestryParts.shade)}</span>
        <span>Soil cover {pct(sys.agroforestryParts.soilCover)}</span>
        <span>Buffer {pct(sys.agroforestryParts.riskBuffer)}</span>
      </div>

      <div className="agro-carbon">
        🌍 กักคาร์บอน ~<b>{sys.carbonPerYear}</b> tCO₂e/ปี · 10 ปีรวม ~<b>{sys.carbon10}</b> tCO₂e
        <span>≈ ดูดซับเท่ารถยนต์ {Math.max(1, Math.round(sys.carbonPerYear / 2.4))} คัน/ปี</span>
      </div>

      <CashflowChart cashflow={sys.cashflow} paybackYear={sys.paybackYear} />

      <div className="agro-compare">
        <div className="agro-compare-head">
          <span className="agro-impact-k">Compare tabs</span>
          <b className="thai">แท็บนี้ดีกว่าแผนอื่นยังไง</b>
        </div>
        <div className="agro-reasons">
          {comparisons.map((row, i) => (
            <div key={i} className="agro-reason thai">
              <span className={`agro-reason-icon ${row.tone}`}>{row.tone === 'warn' ? '!' : row.tone === 'data' ? 'i' : '✓'}</span>
              {row.text}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
