import type { SystemPlan, Layer } from '../data/types';
import { LAYER_META } from '../data/plants';
import { Card } from './ui';
import { CashflowChart } from './CashflowChart';
import { bahtK, pct, nf0 } from '../lib/format';

const ORDER: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

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

export function ResultPlan({ sys, rank }: { sys: SystemPlan; rank: number }) {
  const best = rank === 1;
  return (
    <Card className={`agro-plan ${best ? 'agro-plan-best' : ''}`}>
      <div className="agro-plan-head">
        <span className={`agro-rank ${best ? 'best' : ''}`}>อันดับ {rank}</span>
        <span className="agro-badge thai">{sys.badge}</span>
        <span className="agro-compat">เหมาะสมรวม {pct(sys.suitability)}</span>
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
        <ScorePart label="Suitability" value={sys.scoreParts.suitability} />
        <ScorePart label="Economics" value={sys.scoreParts.economics} />
        <ScorePart label="Water fit" value={sys.scoreParts.waterFit} />
        <ScorePart label="GISTDA risk" value={sys.scoreParts.riskFit} />
        <ScorePart label="Carbon" value={sys.scoreParts.carbon} />
      </div>

      <div className="agro-carbon">
        🌍 กักคาร์บอน ~<b>{sys.carbonPerYear}</b> tCO₂e/ปี · 10 ปีรวม ~<b>{sys.carbon10}</b> tCO₂e
        <span>≈ ดูดซับเท่ารถยนต์ {Math.max(1, Math.round(sys.carbonPerYear / 2.4))} คัน/ปี</span>
      </div>

      <CashflowChart cashflow={sys.cashflow} paybackYear={sys.paybackYear} />

      <div className="agro-reasons">
        {sys.reasons.map((r, i) => <div key={i} className="agro-reason thai"><span className="agro-reason-icon ok">✓</span>{r}</div>)}
        {sys.warnings.map((w, i) => <div key={i} className="agro-reason thai"><span className="agro-reason-icon warn">!</span>{w}</div>)}
      </div>
    </Card>
  );
}
