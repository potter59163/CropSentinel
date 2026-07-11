'use client';

import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';

// The stages the server actually runs (planRunner fans out to these). /api/plan is
// a single request so we can't get true per-stage progress — the timed reveal just
// reflects the real work and reassures the user it isn't frozen during the ~5–15s.
const STAGES: Array<{ icon: IconName; label: string }> = [
  { icon: 'satellite', label: 'ดึงภูมิอากาศจริง (NASA POWER)' },
  { icon: 'soil', label: 'วิเคราะห์ดิน (LDD · SoilGrids)' },
  { icon: 'fire', label: 'ตรวจภัยพิบัติรอบแปลง (GISTDA)' },
  { icon: 'sprout', label: 'ออกแบบระบบวนเกษตรด้วย AI' },
];

export function PlanLoading() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Advance through the first three stages on a timer; the last ("ออกแบบด้วย AI")
    // keeps spinning until the plan arrives and this overlay unmounts.
    const timers = [
      window.setTimeout(() => setActive(1), 1500),
      window.setTimeout(() => setActive(2), 3200),
      window.setTimeout(() => setActive(3), 5200),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <div className="plan-loading-root" role="status" aria-live="polite" aria-label="กำลังออกแบบระบบวนเกษตร">
      <div className="plan-loading-card">
        <div className="plan-loading-spinner" aria-hidden>
          <Icon name="tree" size={30} strokeWidth={1.7} />
        </div>
        <h3 className="thai plan-loading-title">กำลังออกแบบระบบวนเกษตร…</h3>
        <p className="thai plan-loading-sub">ดึงข้อมูลจริงจากดาวเทียมและ AI · โดยปกติใช้เวลา 5–15 วินาที</p>

        <ul className="plan-loading-steps">
          {STAGES.map((s, i) => {
            const state = i < active ? 'done' : i === active ? 'on' : 'wait';
            return (
              <li key={i} className={`plan-loading-step is-${state}`}>
                <span className="plan-loading-step-ic">
                  <Icon name={state === 'done' ? 'check' : s.icon} size={15} />
                </span>
                <span className="thai plan-loading-step-t">{s.label}</span>
                {state === 'on' && <span className="plan-loading-dots" aria-hidden><i /><i /><i /></span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
