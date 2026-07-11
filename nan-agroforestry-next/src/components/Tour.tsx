'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';

export interface TourStep {
  target?: string;          // CSS selector to spotlight; omit for a centered card
  title: string;
  body: string;
  emoji?: string;
  onEnter?: () => void;     // e.g. move the wizard to the right step before we measure
  padding?: number;         // extra px around the spotlight
}

interface Rect { top: number; left: number; width: number; height: number; }

const DIM = 'rgba(10, 22, 16, 0.74)';

export function Tour({ steps, open, onClose }: {
  steps: TourStep[];
  open: boolean;
  onClose: (completed: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => { if (open) setI(0); }, [open]);

  // Position-only re-measure for the reflow listeners. It must NOT scrollIntoView:
  // a scroll handler that scrolls would fight the user and loop endlessly. The
  // one-time centering scroll happens in the step-change effect below.
  const track = useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const pad = step.padding ?? 8;
    setRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
  }, [step]);

  // On step change: run onEnter (may setState in the parent), then lock onto the
  // target. Self-contained (no rAF — throttled off-screen; no captured useCallback)
  // and it keeps refining the rect for ~1s so a late-mounting target or a layout
  // that settles after the wizard advances (e.g. the map) is still caught.
  useEffect(() => {
    if (!open) return;
    setRect(null);
    const s = steps[i];
    s?.onEnter?.();
    if (!s?.target) return;
    let scrolled = false;
    let count = 0;
    let timer = 0;
    const poll = () => {
      const el = document.querySelector(s.target as string) as HTMLElement | null;
      if (el) {
        if (!scrolled) { el.scrollIntoView({ block: 'center', inline: 'nearest' }); scrolled = true; }
        const r = el.getBoundingClientRect();
        if (r.width || r.height) {
          const pad = s.padding ?? 8;
          setRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
        }
      }
      if (count++ < 12) timer = window.setTimeout(poll, 90);
    };
    timer = window.setTimeout(poll, 90);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  // Keep the spotlight glued to the target as the page reflows/scrolls.
  useEffect(() => {
    if (!open || !step?.target) return;
    const onMove = () => track();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, step, track]);

  const next = useCallback(() => { setI((n) => (n < steps.length - 1 ? n + 1 : n)); if (last) onClose(true); }, [last, onClose, steps.length]);
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

  // Place the callout: on phones pin it to the bottom; on desktop put it below the
  // target (or above when there isn't room), and centre it when there's no target.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 640;
  const W = Math.min(380, vw - 28);
  const CALLOUT_H = 240; // rough, for room checks

  let calloutStyle: React.CSSProperties;
  let place: 'center' | 'bottom' | 'top' | 'sheet';
  if (!rect) {
    place = 'center';
    calloutStyle = { width: W, left: (vw - W) / 2, top: Math.max(24, vh / 2 - 150) };
  } else if (mobile) {
    place = 'sheet';
    calloutStyle = { left: 14, right: 14, bottom: 16, width: 'auto' };
  } else if (rect.top + rect.height + CALLOUT_H < vh) {
    place = 'bottom';
    calloutStyle = { width: W, left: clamp(rect.left, 16, vw - W - 16), top: rect.top + rect.height + 14 };
  } else if (rect.top - CALLOUT_H > 0) {
    place = 'top';
    calloutStyle = { width: W, left: clamp(rect.left, 16, vw - W - 16), top: rect.top - CALLOUT_H - 6 };
  } else {
    place = 'center';
    calloutStyle = { width: W, left: (vw - W) / 2, top: Math.max(24, vh / 2 - 150) };
  }

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="แนะนำการใช้งาน">
      {/* click-blocker: forces the guided Next/Back flow */}
      <div className="tour-blocker" style={{ background: rect ? 'transparent' : DIM }} onClick={(e) => e.stopPropagation()} />

      {/* spotlight: the box-shadow paints the dim everywhere except this hole */}
      {rect && (
        <div
          className="tour-hole"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: `0 0 0 9999px ${DIM}` }}
        />
      )}

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
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
