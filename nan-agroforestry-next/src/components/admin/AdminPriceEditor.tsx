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
}

const LAYERS = Object.keys(LAYER_META) as Layer[];

export function AdminPriceEditor() {
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [asOfDrafts, setAsOfDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      setRows((prev) =>
        prev
          ? prev.map((r) => (r.plantId === plantId ? { ...r, currentPricePerKg: price, updatedAt: asOf ?? new Date().toISOString() } : r))
          : prev,
      );
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
      {LAYERS.map((layer) => {
        const layerRows = rows.filter((r) => r.layer === layer);
        if (!layerRows.length) return null;
        return (
          <section key={layer} className="admin-layer-group">
            <h2>{LAYER_META[layer].th}</h2>
            <div className="admin-table-scroll">
              <table className="admin-price-table">
                <thead>
                  <tr>
                    <th>พืช</th>
                    <th>ราคาตั้งต้น (บาท/กก.)</th>
                    <th>ราคาปัจจุบัน</th>
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
                      <td>{r.defaultPricePerKg}</td>
                      <td>{r.currentPricePerKg}</td>
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
