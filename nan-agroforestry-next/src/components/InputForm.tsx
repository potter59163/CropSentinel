import { useState } from 'react';
import type { CropAssumption, FarmInput, Goal, Layer } from '../data/types';
import { byLayer, LAYER_META, PLANTS } from '../data/plants';
import { NAN_AMPHOE, NAN_CENTER } from '../data/nan';
import { Card, Field, SelectChips } from './ui';
import { PlantSection } from './PlantButton';
import { getGeolocation, fetchElevation } from '../lib/elevation';
import { OsmPicker } from './OsmPicker';

const goals: Array<{ id: Goal; label: string; desc: string }> = [
  { id: 'balanced', label: 'สมดุล', desc: 'เห็นผลไว + กำไรดี' },
  { id: 'fast', label: 'เห็นผลไว', desc: 'คืนทุนเร็วที่สุด' },
  { id: 'profit', label: 'กำไรสูงสุด', desc: 'มองยาว 10 ปี' },
];

const CURRENT_CROPS = ['ข้าวโพดเลี้ยงสัตว์', 'ข้าวไร่', 'ยางพารา', 'มันสำปะหลัง', 'พื้นที่ว่าง/เพิ่งถาง'];
const LAYERS: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

export function InputForm({ value, onChange, onSubmit, busy }: {
  value: FarmInput; onChange: (v: FarmInput) => void; onSubmit: () => void; busy: boolean;
}) {
  const [gps, setGps] = useState<'idle' | 'loading' | 'error'>('idle');
  const [osm, setOsm] = useState<'idle' | 'loading' | 'error'>('idle');
  const set = (patch: Partial<FarmInput>) => onChange({ ...value, ...patch });
  const selectedByLayer = value.selectedByLayer ?? { canopy: [], shrub: [], groundcover: [], root: [] };
  const selectedTotal = LAYERS.reduce((sum, layer) => sum + (selectedByLayer[layer]?.length ?? 0), 0);
  const selectedPlantIds = LAYERS.flatMap((layer) => selectedByLayer[layer] ?? []);
  const assumption = (plantId: string) => value.cropAssumptions?.find((a) => a.plantId === plantId) ?? { plantId };
  const setAssumption = (plantId: string, patch: Partial<CropAssumption>) => {
    const current = value.cropAssumptions ?? [];
    const found = current.some((a) => a.plantId === plantId);
    set({
      cropAssumptions: found
        ? current.map((a) => a.plantId === plantId ? { ...a, ...patch } : a)
        : [...current, { plantId, ...patch }],
    });
  };
  const togglePlant = (layer: Layer, id: string) => {
    const a = selectedByLayer[layer] ?? [];
    set({
      selectedByLayer: {
        ...selectedByLayer,
        [layer]: a.includes(id) ? a.filter((x) => x !== id) : [...a, id],
      },
    });
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

  const useOsmPoint = async (lat: number, lng: number) => {
    setOsm('loading');
    try {
      const elev = await fetchElevation(lat, lng);
      set({ lat, lng, elevationM: elev, locationLabel: `OSM (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setOsm('idle');
    } catch {
      set({ lat, lng, locationLabel: `OSM (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setOsm('error');
    }
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

      <Field label="เลือกพิกัดจาก OpenStreetMap" hint="คลิกบนแผนที่เพื่อกำหนด lat/lng และดึงความสูงอัตโนมัติ">
        <OsmPicker
          lat={value.lat ?? NAN_CENTER.lat}
          lng={value.lng ?? NAN_CENTER.lng}
          elevationM={value.elevationM}
          loading={osm === 'loading'}
          onPick={useOsmPoint}
        />
        {osm === 'error' && (
          <div className="agro-gps-err thai">ดึงความสูงจากแผนที่ไม่สำเร็จ — ใช้พิกัด OSM แล้ว แต่คงค่าความสูงเดิมไว้</div>
        )}
      </Field>

      <div className="space-y-4 my-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">🌿 พืชที่อยากให้ระบบนำไปออกแบบ</h2>
          <p className="text-sm text-gray-600">เลือกได้ทุกชั้น · เว้นว่างชั้นไหน ระบบจะเติมชนิดที่เหมาะกับพื้นที่ให้</p>
        </div>

        {LAYERS.map((layer) => {
          const m = LAYER_META[layer];
          const selected = selectedByLayer[layer] ?? [];
          const layerPlants = byLayer(layer).map((p) => ({
            id: p.id,
            nameTh: p.nameTh,
            nameEn: p.nameEn,
          }));

          return (
            <PlantSection
              key={layer}
              layer={layer}
              title={m.th}
              subtitle={m.desc}
              plants={layerPlants}
              selected={selected}
              onSelect={(id) => togglePlant(layer, id)}
            />
          );
        })}
      </div>

      <Field label="เครื่องคิดเลขรายได้ภาคสนาม" hint="ปรับสมมติฐานของพืชที่เลือกไว้ เพื่อคุยกับเกษตรกร/ReCorp">
        <div className="agro-calculator">
          <div className="agro-calc-target">
            <span className="thai">เป้าหมายรายได้/ปี</span>
            <input
              type="number"
              min={0}
              className="agro-input"
              value={value.targetAnnualIncome ?? ''}
              placeholder="เช่น 180000"
              onChange={(e) => set({ targetAnnualIncome: Number(e.target.value) || undefined })}
            />
          </div>
          {selectedPlantIds.length === 0 ? (
            <div className="agro-calc-empty thai">เลือกพืชด้านบนก่อน ระบบจะแสดงช่องปรับราคา ผลผลิต และ survival rate รายชนิด</div>
          ) : (
            <div className="agro-calc-grid">
              {selectedPlantIds.map((id) => {
                const plant = PLANTS.find((p) => p.id === id);
                if (!plant) return null;
                const a = assumption(id);
                return (
                  <div key={id} className="agro-calc-row">
                    <b className="thai">{plant.emoji} {plant.nameTh}</b>
                    <label>
                      <span>฿/kg</span>
                      <input type="number" className="agro-input" value={a.pricePerKg ?? plant.pricePerKg}
                        onChange={(e) => setAssumption(id, { pricePerKg: Number(e.target.value) || plant.pricePerKg })} />
                    </label>
                    <label>
                      <span>kg/rai</span>
                      <input type="number" className="agro-input" value={a.yieldKgPerRai ?? plant.yieldKgPerRai}
                        onChange={(e) => setAssumption(id, { yieldKgPerRai: Number(e.target.value) || plant.yieldKgPerRai })} />
                    </label>
                    <label>
                      <span>survival</span>
                      <input type="number" min={0.1} max={1.2} step={0.05} className="agro-input" value={a.survivalRate ?? 1}
                        onChange={(e) => setAssumption(id, { survivalRate: Number(e.target.value) || 1 })} />
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
