import type { ReactNode } from 'react';

export function Card({ title, titleEn, sub, right, children, pad = true }: {
  title?: ReactNode; titleEn?: string; sub?: ReactNode; right?: ReactNode; children: ReactNode; pad?: boolean;
}) {
  return (
    <div className="card" style={pad ? undefined : { padding: 0, overflow: 'hidden' }}>
      {(title || right) && (
        <div className="card-h" style={pad ? undefined : { padding: '14px 16px 0' }}>
          <div>
            {title && <h3 className="thai">{title} {titleEn && <span className="card-en">{titleEn}</span>}</h3>}
            {sub && <div className="sub" style={{ marginTop: 4 }}>{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Chip({ kind = 'data', children }: { kind?: string; children: ReactNode }) {
  return <span className={`chip ${kind} thai`}><span className="dot" />{children}</span>;
}

export function Stat({ label, value, unit, delta, deltaKind, children }: {
  label: ReactNode; value: ReactNode; unit?: string; delta?: ReactNode; deltaKind?: string; children?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label thai">{label}</div>
      <div className="stat-value">{value}{unit && <span className="unit thai">{unit}</span>}</div>
      {children}
      {delta && <div className={`stat-delta ${deltaKind ?? 'neutral'} thai`}>{delta}</div>}
    </div>
  );
}

export function Sparkline({ data, color = 'var(--data)', fill = true }: { data: number[]; color?: string; fill?: boolean }) {
  const w = 120, h = 28, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / range) * (h - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const a = `${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`}>
      {fill && <path d={a} fill={color} opacity="0.15" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function Bars({ rows }: { rows: Array<[string, number, string]> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(([name, v, c]) => (
        <div key={name}>
          <div className="row space-between" style={{ marginBottom: 4 }}>
            <span className="thai" style={{ fontSize: 12, color: 'var(--fg-1)' }}>{name}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{Math.round(v * 100)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${v * 100}%`, background: c, transition: 'width 0.4s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
