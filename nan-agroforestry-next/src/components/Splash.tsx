'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

// Cute loading splash shown on every page load / refresh: big rounded app name
// "น่านไง" with a progress bar that fills to 100%, then fades into the app.
export function Splash() {
  const [pct, setPct] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let p = 0;
    const id = window.setInterval(() => {
      p = Math.min(100, p + Math.random() * 11 + 5);
      setPct(Math.round(p));
      if (p >= 100) {
        window.clearInterval(id);
        window.setTimeout(() => setHidden(true), 500);
      }
    }, 110);
    return () => window.clearInterval(id);
  }, []);

  if (hidden) return null;

  return (
    <div className={`agro-splash ${pct >= 100 ? 'done' : ''}`} role="status" aria-label="กำลังโหลด">
      <div className="agro-splash-inner">
        <span className="agro-splash-mark"><Icon name="tree" size={68} strokeWidth={1.6} /></span>
        <div className="agro-splash-name">น่านไง</div>
        <div className="agro-splash-tag thai">วางแผนวนเกษตรน่าน จากข้อมูลดาวเทียมจริง</div>
        <div className="agro-splash-bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="agro-splash-pct">{pct}%</div>
      </div>
    </div>
  );
}
