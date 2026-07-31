import type { CashflowPoint } from '../data/types';
import { bahtK } from '../lib/format';

/**
 * Ten-year cashflow, and the one graphic a farmer actually decides on — it is where the
 * payback year is read off.
 *
 * The labels are HTML, not <text>, and that is the whole point. They used to live inside
 * the SVG at `font-size: 8`, but this chart is drawn in a 520x180 viewBox and rendered into
 * a card that is ~320px wide on a phone, so everything in it is scaled by 320/520 = 0.62 —
 * including the type. Those 8-unit labels came out at 4.9 CSS px. Raising the number does
 * not fix it: the scale factor follows the container width, so any value that is legible on
 * a phone is oversized on a tablet. Text simply cannot live in a viewBox that scales.
 *
 * So the SVG keeps the geometry (which is what it is good at — it scales cleanly) and every
 * label is an absolutely positioned HTML element over the top, placed by converting user
 * units to percentages. Percentages map exactly because the box's aspect-ratio is now the
 * viewBox's own 520/180; it used to be 320/120, which both distorted nothing (the SVG
 * letterboxed itself) and wasted ~8% of the height as dead space below the plot.
 */
const W = 520, H = 180, padL = 64, padR = 14, padT = 14, padB = 26;

export function CashflowChart({ cashflow, paybackYear }: { cashflow: CashflowPoint[]; paybackYear: number | null }) {
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const cum = cashflow.map((c) => c.cumulative);
  const yMax = Math.max(...cum, 0);
  const yMin = Math.min(...cum, 0);
  const range = yMax - yMin || 1;
  const x = (i: number) => padL + (i / (cashflow.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - ((v - yMin) / range) * plotH;
  const zeroY = y(0);
  const line = cum.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const area = `${line} L ${x(cashflow.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z`;
  const pctX = (u: number) => `${(u / W) * 100}%`;
  const pctY = (u: number) => `${(u / H) * 100}%`;

  return (
    <div className="agro-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="agro-chart" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <linearGradient id="cumGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--ok)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* yearly net bars (crop + tree) */}
        {cashflow.map((c, i) => {
          const bw = plotW / cashflow.length * 0.5;
          const bx = x(i) - bw / 2;
          const top = y(Math.max(0, c.net));
          const bot = y(Math.min(0, c.net));
          return <rect key={i} x={bx} y={top} width={bw} height={Math.max(1, bot - top)} fill={c.net >= 0 ? 'var(--data)' : 'var(--risk)'} opacity="0.32" />;
        })}
        {/* zero line */}
        <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--fg-3)" strokeWidth="1" strokeDasharray="3 3" />
        {/* cumulative */}
        <path d={area} fill="url(#cumGrad)" />
        <path d={line} fill="none" stroke="var(--ok)" strokeWidth="2.4" />
        {cum.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill="var(--ok)" />)}
        {/* payback marker */}
        {paybackYear && (
          <line x1={x(paybackYear - 1)} x2={x(paybackYear - 1)} y1={padT} y2={H - padB} stroke="var(--warn)" strokeWidth="1" strokeDasharray="2 2" />
        )}
      </svg>

      <span className="agro-chart-y" style={{ top: pctY(y(yMax)), width: pctX(padL - 8) }}>{bahtK(yMax)}</span>
      <span className="agro-chart-y" style={{ top: pctY(zeroY), width: pctX(padL - 8) }}>0</span>

      {paybackYear && (
        <span className="agro-chart-payback thai" style={{ left: pctX(x(paybackYear - 1)), top: pctY(padT) }}>
          คืนทุน
        </span>
      )}

      {cashflow.map((c, i) => {
        // Ten year labels do not fit across a phone-width plot. The first, the last and
        // every fifth stay; the rest drop out below 560px (see field-override.css).
        const keep = i === 0 || i === cashflow.length - 1 || (i + 1) % 5 === 0;
        return (
          <span
            key={i}
            className={`agro-chart-x thai${keep ? '' : ' minor'}`}
            style={{ left: pctX(x(i)), top: pctY(H - padB + 6) }}
          >
            ปี{c.year}
          </span>
        );
      })}
    </div>
  );
}
