// Line-style UI icon set. Uses currentColor so each icon inherits the
// surrounding text colour and keeps the whole app on one cohesive tone.
import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'plot' | 'pin' | 'crosshair' | 'leaf' | 'target' | 'check' | 'tree'
  | 'shieldX' | 'shield' | 'checkCircle' | 'drop' | 'fire' | 'satellite'
  | 'key' | 'soil' | 'sprout' | 'gear' | 'warning' | 'edit' | 'carbon'
  | 'info' | 'arrowLeft' | 'arrowRight' | 'copy' | 'print';

const P: Record<IconName, ReactNode> = {
  plot: (<>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M9 5v14M15 5v14M3 12h18" />
  </>),
  pin: (<>
    <path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.4" />
  </>),
  crosshair: (<>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </>),
  leaf: (<>
    <path d="M5 19c8 2 14-3 14-13 0 0-2-1-6-1-5 0-8 3-8 7 0 3 2 5 4 6" />
    <path d="M5 19c2-5 5-7 9-8" />
  </>),
  target: (<>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>),
  check: (<path d="M5 12.5l4.5 4.5L19 7" />),
  tree: (<>
    <path d="M12 22v-5" />
    <path d="M12 17a6 6 0 0 0 4-10.5A4.5 4.5 0 0 0 8 4.2 5 5 0 0 0 8 14a6 6 0 0 0 4 3z" />
  </>),
  shieldX: (<>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
    <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
  </>),
  shield: (<>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
    <path d="M9 11.5l2 2 4-4.5" />
  </>),
  checkCircle: (<>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </>),
  drop: (<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />),
  fire: (<>
    <path d="M12 3c1 3-1 4-2 6-1.4 2.8 0 5 2 5 1.6 0 2.5-1 2.5-2.5 1.5 1 2 2.6 2 4A6.5 6.5 0 1 1 7 13c.6 1 1.5 1.5 2.3 1.5C8 12 9.5 9 12 3z" />
  </>),
  satellite: (<>
    <path d="M6 14l4-4M9 7l8 8M13 4l7 7" />
    <rect x="3.5" y="11.5" width="5" height="5" rx="1" transform="rotate(45 6 14)" />
    <path d="M14 20a6 6 0 0 0 6-6" />
  </>),
  key: (<>
    <circle cx="8" cy="8" r="4.2" />
    <path d="M11 11l8 8M16 16l2-2M18.5 18.5l1.5-1.5" />
  </>),
  soil: (<>
    <path d="M4 8c2.5 1.5 4 1.5 8 0s5.5-1.5 8 0" />
    <path d="M4 13c2.5 1.5 4 1.5 8 0s5.5-1.5 8 0" />
    <path d="M4 18c2.5 1.5 4 1.5 8 0s5.5-1.5 8 0" />
  </>),
  sprout: (<>
    <path d="M12 21v-8" />
    <path d="M12 13c0-3-2.5-5-6-5 0 3.5 2.5 5 6 5z" />
    <path d="M12 11c0-2.5 2-4.5 5.5-4.5C17.5 9.5 15 11 12 11z" />
  </>),
  gear: (<>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v2.5M12 18v2.5M20.5 12H18M6 12H3.5M17.5 6.5l-1.7 1.7M8.2 15.8l-1.7 1.7M17.5 17.5l-1.7-1.7M8.2 8.2L6.5 6.5" />
  </>),
  warning: (<>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </>),
  edit: (<>
    <path d="M14 5l5 5M4 20l1-4L16 5l3 3L8 19l-4 1z" />
  </>),
  carbon: (<>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14.5c1.4 1.8 4.8 2.2 6.8.3M15.5 8.8c-1.5-1.3-4.3-1.5-6 .2" />
    <path d="M8 9.5h3M13 14.5h3" />
  </>),
  info: (<>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none" />
  </>),
  arrowLeft: (<>
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </>),
  arrowRight: (<>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </>),
  copy: (<>
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>),
  print: (<>
    <path d="M7 17H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2" />
    <path d="M7 8V3h10v5M7 14h10v7H7z" />
  </>),
};

export function Icon({ name, size = 22, className = '', style, strokeWidth = 1.9 }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties; strokeWidth?: number;
}) {
  return (
    <svg
      className={`ui-icon ${className}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={style} role="img" aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
