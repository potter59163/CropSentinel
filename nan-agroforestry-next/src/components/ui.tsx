import type { ReactNode } from 'react';

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function Chip({ kind = 'data', children }: { kind?: string; children: ReactNode }) {
  return <span className={`chip ${kind} thai`}><span className="dot" />{children}</span>;
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="agro-field">
      <label className="agro-label thai" htmlFor={htmlFor}>{label}{hint && <span className="agro-hint"> · {hint}</span>}</label>
      {children}
    </div>
  );
}

export function SelectChips<T extends { id: string }>({ items, selected, onToggle, label }: {
  items: T[]; selected: string[]; onToggle: (id: string) => void; label: (it: T) => ReactNode;
}) {
  return (
    <div className="agro-chips">
      {items.map((it) => (
        <button key={it.id} type="button" className={`agro-chip ${selected.includes(it.id) ? 'on' : ''}`} onClick={() => onToggle(it.id)}>
          {label(it)}
        </button>
      ))}
    </div>
  );
}
