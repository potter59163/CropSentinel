'use client';

import { useEffect, useState } from 'react';
import { LAYER_META } from '@/data/plants';
import type { Layer } from '@/data/types';

interface PriceRow {
  plantId: string;
  nameTh: string;
  nameEn: string;
  layer: Layer;
  defaultPricePerKg: number;
  currentPricePerKg: number;
  updatedAt: string | null;
  isOverridden: boolean;
  tier: 'official' | 'research' | 'estimated';
  tierLabel: string;
  tierNote: string | null;
  deviationPct: number;
}

/**
 * Past this, an override is not a refresh of a stale figure — it is a different claim about
 * what the crop is worth, and it deserves to be looked at.
 */
const LARGE_DEVIATION_PCT = 25;

const LAYERS = Object.keys(LAYER_META) as Layer[];

export function AdminPriceEditor() {
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [asOfDrafts, setAsOfDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onlyOverridden, setOnlyOverridden] = useState(false);

  useEffect(() => {
    fetch('/api/admin/prices')
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows ?? []);
        setDbReady(Boolean(data.dbConfigured));
      });
  }, []);

  async function save(plantId: string) {
    const raw = drafts[plantId];
    const price = Number(raw);
    if (!raw || !Number.isFinite(price) || price <= 0) {
      setMessage('กรอกราคาเป็นตัวเลขมากกว่า 0');
      return;
    }
    const asOf = asOfDrafts[plantId] || undefined;
    setSavingId(plantId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/prices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plantId, pricePerKg: price, asOf }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? 'บันทึกไม่สำเร็จ');
        return;
      }
      // Recompute the override flag and deviation locally too — without this the new badge
      // and the "ทับไว้ N ชนิด" summary only appeared after a reload, which is precisely the
      // kind of invisible override this screen now exists to prevent.
      setRows((prev) => prev
        ? prev.map((r) => (r.plantId === plantId
          ? {
            ...r,
            currentPricePerKg: price,
            updatedAt: asOf ?? new Date().toISOString(),
            isOverridden: true,
            deviationPct: r.defaultPricePerKg > 0
              ? Math.round(((price / r.defaultPricePerKg) - 1) * 100)
              : 0,
          }
          : r))
        : prev);
      setDrafts((d) => {
        const next = { ...d };
        delete next[plantId];
        return next;
      });
      setAsOfDrafts((d) => {
        const next = { ...d };
        delete next[plantId];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  /** Drop the override so the researched price in the code wins again. */
  async function revert(plantId: string) {
    setSavingId(plantId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/prices', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? 'คืนค่าไม่สำเร็จ');
        return;
      }
      setRows((prev) => prev
        ? prev.map((r) => (r.plantId === plantId
          ? { ...r, currentPricePerKg: r.defaultPricePerKg, updatedAt: null, isOverridden: false, deviationPct: 0 }
          : r))
        : prev);
    } finally {
      setSavingId(null);
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.reload();
  }

  if (!rows) {
    return (
      <div className="admin-editor">
        <p>กำลังโหลด…</p>
      </div>
    );
  }

  return (
    <div className="admin-editor">
      <header className="admin-editor-head">
        <h1>จัดการราคาพืชผล</h1>
        <button type="button" onClick={logout} className="admin-logout-btn">
          ออกจากระบบ
        </button>
      </header>
      {!dbReady && (
        <p className="admin-warn">
          DATABASE_URL ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์นี้ — แก้ราคาแล้วจะบันทึกถาวรไม่ได้จนกว่าจะตั้งค่า Neon
        </p>
      )}
      {message && <p className="admin-error">{message}</p>}

      {/* The whole point of this screen after the production audit: an override silently
          replaces a researched price, and until now nothing said so. */}
      {(() => {
        const overridden = rows.filter((r) => r.isOverridden);
        const big = overridden.filter((r) => Math.abs(r.deviationPct) >= LARGE_DEVIATION_PCT);
        if (!overridden.length) {
          return <p className="admin-note">ยังไม่มีการตั้งราคาทับ · ระบบใช้ราคาอ้างอิงในโค้ดทั้งหมด</p>;
        }
        return (
          <div className="admin-override-summary">
            <b>ราคาที่ตั้งทับไว้ {overridden.length} ชนิด</b> — ราคาเหล่านี้ถูกใช้แทนราคาอ้างอิงในระบบ
            {big.length > 0 && (
              <span className="admin-override-big">
                {' '}· <b>{big.length} ชนิดต่างจากค่าอ้างอิงเกิน {LARGE_DEVIATION_PCT}%</b>{' '}
                ({big.map((r) => `${r.nameTh} ${r.deviationPct > 0 ? '+' : ''}${r.deviationPct}%`).join(' · ')})
              </span>
            )}
            <label className="admin-filter">
              <input type="checkbox" checked={onlyOverridden} onChange={(e) => setOnlyOverridden(e.target.checked)} />
              แสดงเฉพาะที่ตั้งทับไว้
            </label>
          </div>
        );
      })()}
      {LAYERS.map((layer) => {
        const layerRows = rows.filter((r) => r.layer === layer && (!onlyOverridden || r.isOverridden));
        if (!layerRows.length) return null;
        return (
          <section key={layer} className="admin-layer-group">
            <h2>{LAYER_META[layer].th}</h2>
            <div className="admin-table-scroll">
              <table className="admin-price-table">
                <thead>
                  <tr>
                    <th>พืช</th>
                    <th>ราคาอ้างอิงในระบบ</th>
                    <th>ราคาที่ใช้จริง</th>
                    <th>ข้อมูล ณ วันที่</th>
                    <th>แก้ไข</th>
                    <th>วันที่ของราคา</th>
                  </tr>
                </thead>
                <tbody>
                  {layerRows.map((r) => (
                    <tr key={r.plantId}>
                      <td>
                        {r.nameTh} <span className="admin-name-en">{r.nameEn}</span>
                      </td>
                      <td>
                        {r.defaultPricePerKg}
                        {/* Overriding a local estimate is routine; overriding a figure
                            traceable to a named OAE series should be a deliberate act. */}
                        <span className={`admin-tier is-${r.tier}`} title={r.tierNote ?? undefined}>
                          {r.tierLabel}
                        </span>
                      </td>
                      <td>
                        <b>{r.currentPricePerKg}</b>
                        {r.isOverridden && (
                          <span className={`admin-dev ${Math.abs(r.deviationPct) >= LARGE_DEVIATION_PCT ? 'is-big' : ''}`}>
                            {r.deviationPct > 0 ? '+' : ''}{r.deviationPct}%
                          </span>
                        )}
                      </td>
                      <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('th-TH') : '— (ค่าตั้งต้น)'}</td>
                      <td>
                        <div className="admin-edit-cell">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder={String(r.currentPricePerKg)}
                            value={drafts[r.plantId] ?? ''}
                            onChange={(e) => setDrafts((d) => ({ ...d, [r.plantId]: e.target.value }))}
                          />
                          <button type="button" disabled={savingId === r.plantId} onClick={() => save(r.plantId)}>
                            {savingId === r.plantId ? '…' : 'บันทึก'}
                          </button>
                          {r.isOverridden && (
                            <button
                              type="button"
                              className="admin-revert-btn"
                              disabled={savingId === r.plantId}
                              title={`คืนไปใช้ราคาอ้างอิงในระบบ ${r.defaultPricePerKg} บาท/กก.`}
                              onClick={() => revert(r.plantId)}
                            >
                              คืนค่า
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-edit-cell">
                          <input
                            type="date"
                            value={asOfDrafts[r.plantId] ?? ''}
                            onChange={(e) => setAsOfDrafts((d) => ({ ...d, [r.plantId]: e.target.value }))}
                            title="วันที่ของรายงาน/แหล่งราคา — เว้นว่างถ้าใช้วันนี้"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
