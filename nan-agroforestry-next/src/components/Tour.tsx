'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface TourStep {
  target?: string;          // CSS selector to spotlight; omit for a centered card
  title: string;
  body: string;
  emoji?: string;
  onEnter?: () => void;     // move the wizard to the right step before we measure
  padding?: number;         // extra px around the spotlight
}

interface Rect { top: number; left: number; width: number; height: number; }

const DIM = 'rgba(10, 22, 16, 0.72)';

export function Tour({ steps, open, onClose }: {
  steps: TourStep[];
  open: boolean;
  onClose: (completed: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [, bump] = useState(0); // re-render on viewport resize so the SVG stays full-screen
  const roRef = useRef<ResizeObserver | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => { if (open) setI(0); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => bump((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // Round + de-dupe so subpixel getBoundingClientRect noise can't cause the
  // spotlight to jitter (a re-render with an identical rect is skipped).
  const applyRect = useCallback((el: HTMLElement, pad: number) => {
    const r = el.getBoundingClientRect();
    const nt = Math.round(r.top - pad), nl = Math.round(r.left - pad);
    const nw = Math.round(r.width + pad * 2), nh = Math.round(r.height + pad * 2);
    setRect((p) => (p && p.top === nt && p.left === nl && p.width === nw && p.height === nh)
      ? p : { top: nt, left: nl, width: nw, height: nh });
  }, []);

  // On step change: run onEnter, then lock onto the target. We deliberately do NOT
  // clear the previous rect — the spotlight morphs (slides+resizes) from the old
  // target to the new one via the CSS transition. A ResizeObserver keeps it exact
  // if the target's size settles late (e.g. the map).
  useEffect(() => {
    if (!open) return;
    step?.onEnter?.();
    roRef.current?.disconnect();
    if (!step?.target) { setRect(null); return; }
    const target = step.target;
    const pad = step.padding ?? 8;
    let scrolled = false;
    let tries = 0;
    let lastW = -1;
    let stableTries = 0;
    let timer = 0;
    const attempt = () => {
      const el = document.querySelector(target) as HTMLElement | null;
      if (!el || !(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) {
        if (tries++ < 40) timer = window.setTimeout(attempt, 50);
        return;
      }
      if (!scrolled) { el.scrollIntoView({ block: 'center', inline: 'nearest' }); scrolled = true; }
      // Wait for the size to settle before committing the first rect: on the very
      // first paint a full-width input can briefly measure at min-content width, and
      // committing that would make the spotlight flash at the wrong spot then slide.
      const w = el.offsetWidth;
      if (w !== lastW && stableTries < 6) { lastW = w; stableTries++; timer = window.setTimeout(attempt, 55); return; }
      applyRect(el, pad);
      const ro = new ResizeObserver(() => applyRect(el, pad)); // keep exact if it resizes later (map)
      ro.observe(el);
      roRef.current = ro;
    };
    timer = window.setTimeout(attempt, 80); // let onEnter's re-render commit first
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  // Keep the spotlight glued to the target as the page scrolls/reflows (position
  // only — never scrollIntoView here, or it would fight the user's scroll).
  useEffect(() => {
    if (!open || !step?.target) return;
    const target = step.target;
    const pad = step.padding ?? 8;
    const onMove = () => {
      const el = document.querySelector(target) as HTMLElement | null;
      if (el) applyRect(el, pad);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, step, applyRect]);

  useEffect(() => () => roRef.current?.disconnect(), []);

  const next = useCallback(() => {
    if (last) onClose(true); else setI((n) => Math.min(steps.length - 1, n + 1));
  }, [last, onClose, steps.length]);
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev, onClose]);

  if (!open) return null;

  // Callout placement: bottom sheet on phones; below the target (or above when
  // there's no room) on desktop; centred when the step has no target.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 640;
  const W = Math.min(384, vw - 28);
  const CH = 235;
  let calloutStyle: React.CSSProperties;
  let place: 'center' | 'bottom' | 'top' | 'sheet';
  if (!rect) {
    place = 'center';
    calloutStyle = { width: W, left: Math.round((vw - W) / 2), top: Math.max(24, Math.round(vh / 2 - 150)) };
  } else if (mobile) {
    place = 'sheet';
    calloutStyle = { left: 14, right: 14, bottom: 16, width: 'auto' };
  } else if (rect.top + rect.height + CH < vh) {
    place = 'bottom';
    calloutStyle = { width: W, left: clamp(rect.left, 16, vw - W - 16), top: rect.top + rect.height + 16 };
  } else if (rect.top - CH > 0) {
    place = 'top';
    calloutStyle = { width: W, left: clamp(rect.left, 16, vw - W - 16), top: rect.top - CH - 2 };
  } else {
    place = 'center';
    calloutStyle = { width: W, left: Math.round((vw - W) / 2), top: Math.max(24, Math.round(vh / 2 - 150)) };
  }

  const holeGeo: React.CSSProperties | undefined = rect
    ? { x: `${rect.left}px`, y: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` } as React.CSSProperties
    : undefined;

  // Wait for the first measurement before showing the callout on a targeted step,
  // so it opens next to its target instead of flashing centre-screen first.
  const showCallout = rect != null || !step?.target;

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="แนะนำการใช้งาน">
      {/* SVG dimmer with a crisp, rounded spotlight cut-out (mask) + glowing ring.
          Explicit px dims + userSpaceOnUse — percentage sizes are unreliable inside
          an SVG <mask>. */}
      <svg className="tour-svg" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <mask id="tour-spot-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={vw} height={vh}>
            <rect x="0" y="0" width={vw} height={vh} fill="#fff" />
            {rect && <rect className="tour-hole" rx="16" ry="16" fill="#000" style={holeGeo} />}
          </mask>
        </defs>
        <rect x="0" y="0" width={vw} height={vh} fill={DIM} mask="url(#tour-spot-mask)" />
        {rect && <rect className="tour-ring" rx="16" ry="16" fill="none" style={holeGeo} />}
      </svg>

      {/* transparent click-catcher — keeps the user on the guided Next/Back path */}
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />

      {showCallout && (
        <div className={`tour-callout tour-place-${place}`} style={calloutStyle}>
          <div className="tour-head">
            <span className="tour-emoji" aria-hidden>{step.emoji ?? '🌱'}</span>
            <span className="tour-count">{i + 1} / {steps.length}</span>
            <button type="button" className="tour-x" onClick={() => onClose(false)} aria-label="ปิดคำแนะนำ">✕</button>
          </div>

          <h3 className="tour-title thai">{step.title}</h3>
          <p className="tour-body thai">{step.body}</p>

          <div className="tour-dots" aria-hidden>
            {steps.map((_, n) => (
              <span key={n} className={`tour-dot ${n === i ? 'on' : ''} ${n < i ? 'done' : ''}`} />
            ))}
          </div>

          <div className="tour-actions">
            <button type="button" className="tour-skip thai" onClick={() => onClose(false)}>
              {last ? '' : 'ข้ามคำแนะนำ'}
            </button>
            <div className="tour-nav">
              {i > 0 && (
                <button type="button" className="tour-btn ghost thai" onClick={prev}>
                  <Icon name="arrowLeft" size={16} /> ย้อนกลับ
                </button>
              )}
              <button type="button" className="tour-btn primary thai" onClick={next}>
                {last ? <>เริ่มใช้งานเลย <Icon name="check" size={16} /></> : <>ถัดไป <Icon name="arrowRight" size={16} /></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
