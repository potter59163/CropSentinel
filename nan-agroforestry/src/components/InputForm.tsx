import { useState } from 'react';
import type { FarmInput, Goal } from '../data/types';
import { CANOPY } from '../data/plants';
import { NAN_AMPHOE } from '../data/nan';
import { Card, Field, SelectChips } from './ui';
import { getGeolocation, fetchElevation } from '../lib/elevation';

const goals: Array<{ id: Goal; label: string; desc: string }> = [
  { id: 'balanced', label: 'สมดุล', desc: 'เห็นผลไว + กำไรดี' },
  { id: 'fast', label: 'เห็นผลไว', desc: 'คืนทุนเร็วที่สุด' },
  { id: 'profit', label: 'กำไรสูงสุด', desc: 'มองยาว 10 ปี' },
];

const CURRENT_CROPS = ['ข้าวโพดเลี้ยงสัตว์', 'ข้าวไร่', 'ยางพารา', 'มันสำปะหลัง', 'พื้นที่ว่าง/เพิ่งถาง'];

export function InputForm({ value, onChange, onSubmit, busy }: {
  value: FarmInput; onChange: (v: FarmInput) => void; onSubmit: () => void; busy: boolean;
}) {
  const [gps, setGps] = useState<'idle' | 'loading' | 'error'>('idle');
  const set = (patch: Partial<FarmInput>) => onChange({ ...value, ...patch });
  const toggleCanopy = (id: string) => {
    const a = value.selectedCanopyIds;
    set({ selectedCanopyIds: a.includes(id) ? a.filter((x) => x !== id) : [...a, id] });
  };

  const useGps = async () => {
    setGps('loading');
    try {
      const { lat, lng } = await getGeolocation();
      const elev = await fetchElevation(lat, lng);
      set({ lat, lng, elevationM: elev, locationLabel: `GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setGps('idle');
    } catch { setGps('error'); }
  };

  return (
    <Card className="agro-form">
      <div className="agro-form-grid">
        <Field label="ขนาดแปลง (ไร่)">
          <input type="number" min={0.5} step={0.5} className="agro-input" value={value.sizeRai}
            onChange={(e) => set({ sizeRai: Math.max(0.5, Number(e.target.value) || 0) })} />
        </Field>
        <Field label="ตอนนี้ปลูกอะไร" hint="ถ้ามี">
          <select className="agro-input" value={value.currentCropId ?? ''} onChange={(e) => set({ currentCropId: e.target.value || null })}>
            <option value="">— เลือก / ยังไม่ได้ปลูก —</option>
            {CURRENT_CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="ระดับความสูง (เมตร รทก.)">
          <div className="agro-elev-row">
            <input type="number" className="agro-input" value={value.elevationM}
              onChange={(e) => set({ elevationM: Number(e.target.value) || 0, locationLabel: 'กำหนดเอง' })} />
            <button type="button" className="agro-gps-btn" onClick={useGps} disabled={gps === 'loading'}>
              📍 {gps === 'loading' ? 'กำลังหา…' : 'GPS'}
            </button>
          </div>
          {gps === 'error' && <div className="agro-gps-err thai">ขอตำแหน่งไม่สำเร็จ — เลือกอำเภอด้านล่าง</div>}
          <div className="agro-loc thai">ตำแหน่ง: {value.locationLabel}</div>
        </Field>
      </div>

      <Field label="หรือเลือกอำเภอในน่าน" hint="ตั้งพิกัด+ความสูงอัตโนมัติ (ใช้ตรวจ GISTDA)">
        <div className="agro-amphoe">
          {NAN_AMPHOE.map((a) => (
            <button key={a.id} type="button"
              className={`agro-chip ${value.locationLabel === a.nameTh ? 'on' : ''}`}
              onClick={() => set({ elevationM: a.elevationM, lat: a.lat, lng: a.lng, locationLabel: a.nameTh })}>
              {a.nameTh} <span className="agro-amphoe-elev">{a.elevationM}ม.</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="ไม้ยืนต้นที่สนใจ" hint="เลือกได้หลายอย่าง · เว้นว่าง = ให้ระบบเลือกที่เหมาะที่สุด (บังคับ ≥2 ชนิดในแผน)">
        <SelectChips items={CANOPY} selected={value.selectedCanopyIds} onToggle={toggleCanopy}
          label={(t) => <>{t.emoji} {t.nameTh}</>} />
      </Field>

      <Field label="เป้าหมายของคุณ">
        <div className="agro-goals">
          {goals.map((g) => (
            <button key={g.id} type="button" className={`agro-goal ${value.goal === g.id ? 'on' : ''}`} onClick={() => set({ goal: g.id })}>
              <div className="agro-goal-label thai">{g.label}</div>
              <div className="agro-goal-desc thai">{g.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      <button type="button" className="btn primary thai agro-submit" onClick={onSubmit} disabled={busy}>
        {busy ? '⏳ กำลังวิเคราะห์ข้อมูลดาวเทียม…' : '🌱 ออกแบบระบบวนเกษตร'}
      </button>
    </Card>
  );
}
