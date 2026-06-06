import type { CashflowPoint } from '../data/types';
import { bahtK } from '../lib/format';

export function CashflowChart({ cashflow, paybackYear }: { cashflow: CashflowPoint[]; paybackYear: number | null }) {
  const W = 520, H = 180, padL = 52, padR = 14, padT = 14, padB = 26;
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="agro-chart" preserveAspectRatio="xMidYMid meet">
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
      <text x={padL - 8} y={zeroY + 3} textAnchor="end" className="agro-axis">0</text>
      <text x={padL - 8} y={y(yMax) + 3} textAnchor="end" className="agro-axis">{bahtK(yMax)}</text>
      {/* cumulative */}
      <path d={area} fill="url(#cumGrad)" />
      <path d={line} fill="none" stroke="var(--ok)" strokeWidth="2.4" />
      {cum.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill="var(--ok)" />)}
      {/* payback marker */}
      {paybackYear && (
        <g>
          <line x1={x(paybackYear - 1)} x2={x(paybackYear - 1)} y1={padT} y2={H - padB} stroke="var(--warn)" strokeWidth="1" strokeDasharray="2 2" />
          <text x={x(paybackYear - 1)} y={padT + 2} textAnchor="middle" className="agro-axis" fill="var(--warn)">คืนทุน</text>
        </g>
      )}
      {cashflow.map((c, i) => <text key={i} x={x(i)} y={H - padB + 16} textAnchor="middle" className="agro-axis">ปี{c.year}</text>)}
    </svg>
  );
}
