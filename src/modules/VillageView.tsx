import { useState } from 'react';
import { useData } from '../data/store';
import { haversineM, bearingDeg, compass, compassTh } from '../lib/geo';
import type { RiskLevel } from '../data/types';

// ── plain-language mappings ─────────────────────────────────────────────────
const fireStatus: Record<RiskLevel, { word: string; sub: string; emoji: string; cls: string }> = {
  LOW: { word: 'วันนี้ปลอดภัย', sub: 'ยังไม่มีอันตรายจากไฟ', emoji: '🙂', cls: 'safe' },
  MEDIUM: { word: 'วันนี้ต้องระวัง', sub: 'อากาศแห้ง ไฟติดง่าย อย่าจุดไฟ', emoji: '😐', cls: 'warn' },
  HIGH: { word: 'วันนี้อันตราย', sub: 'เสี่ยงไฟป่าสูง เฝ้าระวังใกล้ชิด', emoji: '⚠️', cls: 'danger' },
  CRITICAL: { word: 'อันตรายมาก!', sub: 'ไฟป่ารุนแรง เตรียมพร้อมอพยพ', emoji: '🔥', cls: 'critical' },
};

function pm25Info(v: number) {
  if (v <= 37) return { face: '😊', word: 'อากาศดี', advice: 'หายใจได้ตามปกติ', cls: 'safe' };
  if (v <= 50) return { face: '😐', word: 'อากาศปานกลาง', advice: 'คนที่แพ้ง่าย ใส่หน้ากากเมื่อออกนอกบ้าน', cls: 'warn' };
  if (v <= 90) return { face: '😷', word: 'อากาศไม่ดี', advice: 'ใส่หน้ากาก ลดการอยู่กลางแจ้ง', cls: 'danger' };
  return { face: '🤢', word: 'อากาศเป็นพิษ', advice: 'งดออกนอกบ้าน ปิดประตูหน้าต่าง ใส่หน้ากาก', cls: 'critical' };
}

export function VillageView({ onExit }: { onExit: () => void }) {
  const { province, districts, hotspots } = useData();
  const [areaId, setAreaId] = useState<string>(districts[0].id);
  const area = districts.find((d) => d.id === areaId)!;

  // nearest fire to the chosen area centre
  let nearest: { km: number; dirTh: string } | null = null;
  if (hotspots.length) {
    let best = Infinity, bestH = hotspots[0];
    for (const h of hotspots) {
      const d = haversineM({ lat: h.lat, lng: h.lng }, area);
      if (d < best) { best = d; bestH = h; }
    }
    nearest = { km: Math.round((best / 1000) * 10) / 10, dirTh: compassTh[compass(bearingDeg(area, { lat: bestH.lat, lng: bestH.lng }))] };
  }
  const fireNear = nearest !== null && nearest.km <= 5;

  const st = fireStatus[area.fireRisk];
  const air = pm25Info(area.pm25);

  // today's to-dos, prioritised by situation
  const todos: Array<{ icon: string; text: string }> = [];
  todos.push({ icon: '🚫', text: 'ห้ามเผาป่า เผาไร่ เผาขยะ วันนี้' });
  if (area.fireRisk === 'HIGH' || area.fireRisk === 'CRITICAL' || fireNear)
    todos.push({ icon: '💧', text: 'เตรียมน้ำ ผ้าชุบน้ำ และของสำคัญให้พร้อม' });
  if (area.fireRisk === 'CRITICAL' || fireNear)
    todos.push({ icon: '📢', text: 'ฟังประกาศผู้ใหญ่บ้าน เตรียมพร้อมอพยพ' });
  if (area.pm25 > 50) todos.push({ icon: '😷', text: 'ใส่หน้ากาก ปิดประตูหน้าต่างกันฝุ่น' });
  if (todos.length < 3) todos.push({ icon: '👀', text: 'ช่วยกันเฝ้าระวัง เห็นควันไฟรีบแจ้งทันที' });

  const calls = [
    { icon: '🔥', label: 'แจ้งไฟไหม้ / เหตุฉุกเฉิน', num: '199' },
    { icon: '🌲', label: 'สายด่วนพิทักษ์ป่า', num: '1362' },
    { icon: '🚑', label: 'เจ็บป่วยฉุกเฉิน', num: '1669' },
  ];

  return (
    <div className={`village village-${st.cls}`}>
      <header className="vlg-top">
        <div className="vlg-brand">🔥 เตือนภัยไฟป่า · เชียงใหม่</div>
        <button className="vlg-exit" onClick={onExit}>สำหรับเจ้าหน้าที่ ▸</button>
      </header>

      <div className="vlg-area">
        <div className="vlg-area-label">เลือกอำเภอของท่าน</div>
        <div className="vlg-area-btns">
          {districts.map((d) => (
            <button key={d.id} className={`vlg-area-btn ${d.id === areaId ? 'on' : ''}`} onClick={() => setAreaId(d.id)}>
              {d.nameTh}
            </button>
          ))}
        </div>
      </div>

      {/* GIANT status */}
      <section className={`vlg-status vlg-${st.cls}`}>
        <div className="vlg-status-emoji">{st.emoji}</div>
        <div className="vlg-status-text">
          <div className="vlg-status-word">{st.word}</div>
          <div className="vlg-status-sub">{st.sub}</div>
          <div className="vlg-status-area">พื้นที่ อ.{area.nameTh}</div>
        </div>
      </section>

      <div className="vlg-cards">
        {/* nearest fire */}
        <div className={`vlg-card ${fireNear ? 'vlg-danger' : ''}`}>
          <div className="vlg-card-icon">📍</div>
          <div className="vlg-card-title">ไฟที่ใกล้ที่สุด</div>
          {nearest ? (
            <div className="vlg-card-big">
              อยู่ทาง<b>{nearest.dirTh}</b><br />ห่าง <b>{nearest.km}</b> กิโลเมตร
            </div>
          ) : (
            <div className="vlg-card-big">วันนี้<b>ยังไม่พบไฟ</b>ใกล้หมู่บ้าน</div>
          )}
          {fireNear && <div className="vlg-card-flag">ไฟอยู่ใกล้ ระวังตัว!</div>}
        </div>

        {/* air quality */}
        <div className={`vlg-card vlg-${air.cls}`}>
          <div className="vlg-card-icon">{air.face}</div>
          <div className="vlg-card-title">อากาศวันนี้</div>
          <div className="vlg-card-big">{air.word}<br />ค่าฝุ่น <b>{area.pm25}</b></div>
          <div className="vlg-card-advice">{air.advice}</div>
        </div>
      </div>

      {/* what to do today */}
      <section className="vlg-todo">
        <div className="vlg-section-title">📋 วันนี้ต้องทำอะไร</div>
        {todos.slice(0, 4).map((t, i) => (
          <div key={i} className="vlg-todo-row">
            <span className="vlg-todo-icon">{t.icon}</span>
            <span className="vlg-todo-text">{t.text}</span>
          </div>
        ))}
      </section>

      {/* call for help */}
      <section className="vlg-calls">
        <div className="vlg-section-title">📞 โทรขอความช่วยเหลือ</div>
        {calls.map((c) => (
          <a key={c.num} className="vlg-call" href={`tel:${c.num}`}>
            <span className="vlg-call-icon">{c.icon}</span>
            <span className="vlg-call-label">{c.label}</span>
            <span className="vlg-call-num">{c.num}</span>
          </a>
        ))}
      </section>

      <footer className="vlg-foot">
        อัปเดต {province.lastUpdate} · ข้อมูลจากดาวเทียมเฝ้าระวังไฟป่า
      </footer>
    </div>
  );
}
