// Unified plant icon set — covers every species with one consistent style.
// Hand-drawn SVGs are keyed by botanical archetype, with a per-layer fallback
// so any plant, now or future, gets a matching glyph.
import type { Layer } from '../data/types';

type Arche = 'tree' | 'timber' | 'banana' | 'bamboo' | 'shrub' | 'chili' | 'grass'
  | 'pod' | 'gourd' | 'tuber' | 'pineapple' | 'rhizome' | 'corm' | 'leaf';

const O = '#5a3f2a'; // shared outline → makes the set feel cohesive

const MAP: Record<string, { a: Arche; c: string }> = {
  banana: { a: 'banana', c: '#e7b84d' },
  mango: { a: 'tree', c: '#e8923c' },
  longan: { a: 'tree', c: '#b9824a' },
  cashew: { a: 'tree', c: '#d98a52' },
  avocado: { a: 'tree', c: '#6f9d4e' },
  macadamia: { a: 'tree', c: '#bf9a6e' },
  maikhwaen: { a: 'tree', c: '#c46f57' },
  bamboo: { a: 'bamboo', c: '#86ad5f' },
  teak: { a: 'timber', c: '#9c8161' },
  coffee: { a: 'shrub', c: '#b14a30' },
  tea: { a: 'shrub', c: '#5f7f3c' },
  chili: { a: 'chili', c: '#d2443a' },
  lemongrass: { a: 'grass', c: '#9fbe5c' },
  peanut: { a: 'pod', c: '#caa46b' },
  pumpkin: { a: 'gourd', c: '#e2872a' },
  sweetpotato: { a: 'tuber', c: '#c27a4a' },
  pineapple: { a: 'pineapple', c: '#e6c33c' },
  ginger: { a: 'rhizome', c: '#cfa468' },
  turmeric: { a: 'rhizome', c: '#dca52f' },
  galangal: { a: 'rhizome', c: '#cbab9c' },
  taro: { a: 'corm', c: '#a48fd0' },
};

const LAYER_FALLBACK: Record<Layer, { a: Arche; c: string }> = {
  canopy: { a: 'tree', c: '#8fb567' },
  shrub: { a: 'shrub', c: '#6f9d4e' },
  groundcover: { a: 'leaf', c: '#9fbe5c' },
  root: { a: 'rhizome', c: '#cfa468' },
};

function shape(a: Arche, c: string) {
  switch (a) {
    case 'tree':
      return (<>
        <rect x="14" y="18" width="4" height="11" rx="2" fill="#8a6a47" />
        <circle cx="16" cy="13" r="10" fill={c} stroke={O} strokeWidth="1.3" />
        <circle cx="12" cy="10" r="2.6" fill="#fff" opacity="0.3" />
        <circle cx="20" cy="16" r="2.3" fill="#000" opacity="0.14" />
      </>);
    case 'timber':
      return (<>
        <rect x="14.5" y="17" width="3" height="12" rx="1.5" fill="#8a6a47" />
        <ellipse cx="16" cy="12" rx="8" ry="11" fill={c} stroke={O} strokeWidth="1.3" />
        <path d="M16 4 V 24" stroke="#000" opacity="0.08" strokeWidth="2" />
        <circle cx="13" cy="9" r="2" fill="#fff" opacity="0.28" />
      </>);
    case 'banana':
      return (<>
        <path d="M9 20 Q 7 9 17 7" fill="none" stroke="#6f8f4a" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 6 Q 26 13 21 24 Q 19 26 17.5 24.5 Q 22 14 17 8 Q 18 5.5 20 6 Z" fill={c} stroke={O} strokeWidth="1.2" />
        <path d="M15 8 Q 20 14 16 24 Q 14.5 25.5 13 24 Q 17 15 12.5 9 Q 13.5 7 15 8 Z" fill={c} stroke={O} strokeWidth="1.2" opacity="0.95" />
      </>);
    case 'bamboo':
      return (<>
        <rect x="13" y="5" width="6" height="22" rx="2.5" fill={c} stroke={O} strokeWidth="1.2" />
        <line x1="13" y1="12" x2="19" y2="12" stroke={O} strokeWidth="1.2" />
        <line x1="13" y1="19" x2="19" y2="19" stroke={O} strokeWidth="1.2" />
        <path d="M19 9 Q 26 8 27 12" fill="none" stroke="#86ad5f" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M13 15 Q 6 14 5 18" fill="none" stroke="#86ad5f" strokeWidth="1.8" strokeLinecap="round" />
      </>);
    case 'shrub':
      return (<>
        <rect x="15" y="22" width="2" height="6" fill="#7a5a3a" />
        <circle cx="11" cy="16" r="6.5" fill="#6f9148" stroke={O} strokeWidth="1.2" />
        <circle cx="21" cy="16" r="6.5" fill="#6f9148" stroke={O} strokeWidth="1.2" />
        <circle cx="16" cy="12" r="7" fill="#7aa052" stroke={O} strokeWidth="1.2" />
        <circle cx="13" cy="14" r="1.8" fill={c} />
        <circle cx="19" cy="15" r="1.8" fill={c} />
        <circle cx="16" cy="18" r="1.8" fill={c} />
      </>);
    case 'chili':
      return (<>
        <path d="M14 7 Q 15 11 14 14" stroke="#6f8f4a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M13 13 Q 22 13 23 22 Q 23 27 18 26 Q 11 24 11 16 Q 11 13 13 13 Z" fill={c} stroke={O} strokeWidth="1.3" />
        <path d="M15 16 Q 20 17 20.5 22" stroke="#fff" opacity="0.3" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>);
    case 'grass':
      return (<g stroke={c} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M16 27 Q 14 16 10 8" />
        <path d="M16 27 Q 16 15 16 7" strokeWidth="2.8" />
        <path d="M16 27 Q 18 16 22 8" />
        <path d="M16 27 Q 12 18 7 13" opacity="0.7" />
        <path d="M16 27 Q 20 18 25 13" opacity="0.7" />
      </g>);
    case 'pod':
      return (<>
        <ellipse cx="16" cy="11" rx="6.5" ry="6" fill={c} stroke={O} strokeWidth="1.3" />
        <ellipse cx="16" cy="21" rx="7" ry="6.5" fill={c} stroke={O} strokeWidth="1.3" />
        <circle cx="16" cy="16" r="2.6" fill="#000" opacity="0.08" />
        <circle cx="13" cy="9" r="1.6" fill="#fff" opacity="0.3" />
      </>);
    case 'gourd':
      return (<>
        <path d="M16 11 Q 13 7 15 6" stroke="#6f8f4a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="16" cy="19" rx="11" ry="9" fill={c} stroke={O} strokeWidth="1.3" />
        <path d="M16 11 V 27 M10 12 Q 8 19 10 26 M22 12 Q 24 19 22 26" stroke="#000" opacity="0.12" strokeWidth="1.4" fill="none" />
      </>);
    case 'tuber':
      return (<>
        <path d="M19 10 Q 20 5 23 5" stroke="#6f8f4a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M8 14 Q 10 9 18 11 Q 26 13 25 19 Q 24 25 16 25 Q 7 24 8 14 Z" fill={c} stroke={O} strokeWidth="1.3" />
        <circle cx="13" cy="16" r="1.3" fill="#000" opacity="0.12" />
        <circle cx="19" cy="18" r="1.3" fill="#000" opacity="0.12" />
      </>);
    case 'pineapple':
      return (<>
        <path d="M16 11 L 12 4 M16 11 L 16 3 M16 11 L 20 4" stroke="#6f9148" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="16" cy="20" rx="8" ry="9" fill={c} stroke={O} strokeWidth="1.3" />
        <path d="M11 16 L 16 21 M21 16 L 16 21 M16 14 L 16 21 M11 22 L 16 24 M21 22 L 16 24" stroke="#000" opacity="0.14" strokeWidth="1.2" />
      </>);
    case 'rhizome':
      return (<>
        <path d="M17 10 Q 18 5 21 5" stroke="#6f8f4a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M9 18 Q 7 13 12 12 Q 13 8 17 10 Q 22 8 23 13 Q 27 15 24 19 Q 25 24 20 23 Q 16 27 13 23 Q 8 23 9 18 Z" fill={c} stroke={O} strokeWidth="1.2" />
        <circle cx="14" cy="16" r="1.3" fill="#000" opacity="0.1" />
        <circle cx="20" cy="17" r="1.3" fill="#000" opacity="0.1" />
      </>);
    case 'corm':
      return (<>
        <path d="M16 11 Q 15 5 19 3 Q 18 7 19 9" fill="#6f9148" stroke={O} strokeWidth="1" />
        <path d="M16 27 Q 8 26 9 17 Q 10 11 16 11 Q 22 11 23 17 Q 24 26 16 27 Z" fill={c} stroke={O} strokeWidth="1.3" />
        <path d="M11 16 Q 16 18 21 16 M11 20 Q 16 22 21 20" stroke="#000" opacity="0.12" strokeWidth="1.2" fill="none" />
      </>);
    default: // leaf
      return (<>
        <path d="M16 27 Q 7 20 9 10 Q 18 8 23 14 Q 25 22 16 27 Z" fill={c} stroke={O} strokeWidth="1.3" />
        <path d="M16 26 Q 15 16 20 12" stroke="#000" opacity="0.12" strokeWidth="1.3" fill="none" />
      </>);
  }
}

export function PlantGlyph({ plantId, layer, size = 22 }: { plantId: string; layer?: Layer; size?: number }) {
  const def = MAP[plantId] ?? (layer ? LAYER_FALLBACK[layer] : { a: 'leaf' as Arche, c: '#8fb567' });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="agro-glyph" role="img" aria-hidden="true">
      {shape(def.a, def.c)}
    </svg>
  );
}
