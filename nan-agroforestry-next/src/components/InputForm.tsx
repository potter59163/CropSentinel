import { useState } from 'react';
import type { CropAssumption, FarmInput, Goal, Layer } from '../data/types';
import { byLayer, LAYER_META, PLANTS } from '../data/plants';
import { NAN_AMPHOE, NAN_CENTER } from '../data/nan';
import { Card, Field } from './ui';
import { PlantGlyph } from './PlantGlyph';
import { Icon } from './Icon';
import { getGeolocation, fetchElevation } from '../lib/elevation';
import { GoogleMapPicker } from './GoogleMapPicker';

const goals: Array<{ id: Goal; label: string; desc: string }> = [
  { id: 'balanced', label: 'สมดุล', desc: 'เห็นผลไว + กำไรดี' },
  { id: 'fast', label: 'เห็นผลไว', desc: 'คืนทุนเร็วที่สุด' },
  { id: 'profit', label: 'กำไรสูงสุด', desc: 'มองยาว 10 ปี' },
];

const CURRENT_CROPS = ['ข้าวโพดเลี้ยงสัตว์', 'ข้าวไร่', 'ยางพารา', 'มันสำปะหลัง', 'พื้นที่ว่าง/เพิ่งถาง'];
const LAYERS: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

export function InputForm({ value, onChange, step, invalidFields = [] }: {
  value: FarmInput; onChange: (v: FarmInput) => void; step: number; invalidFields?: string[];
}) {
  const [gps, setGps] = useState<'idle' | 'loading' | 'error'>('idle');
  const [osm, setOsm] = useState<'idle' | 'loading' | 'error'>('idle');
  const set = (patch: Partial<FarmInput>) => onChange({ ...value, ...patch });
  const invalid = (field: string) => invalidFields.includes(field);
  const numberValue = (n: number) => Number.isFinite(n) ? n : '';
  const selectedByLayer = value.selectedByLayer ?? { canopy: [], shrub: [], groundcover: [], root: [] };
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

  const useMapPoint = async (lat: number, lng: number) => {
    setOsm('loading');
    try {
      const elev = await fetchElevation(lat, lng);
      set({ lat, lng, elevationM: elev, locationLabel: `แผนที่ (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setOsm('idle');
    } catch {
      set({ lat, lng, locationLabel: `แผนที่ (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setOsm('error');
    }
  };

  return (
    <Card className="agro-form">
      <div className="agro-step" key={step}>
        {step === 0 && (<>
          <div className="agro-form-grid agro-form-grid-2">
            <Field label="ขนาดแปลง (ไร่)">
              <input
                type="number"
                min={0.5}
                step={0.5}
                className={`agro-input ${invalid('sizeRai') ? 'is-invalid' : ''}`}
                value={numberValue(value.sizeRai)}
                aria-invalid={invalid('sizeRai') || undefined}
                onChange={(e) => set({ sizeRai: e.target.value.trim() === '' ? Number.NaN : Number(e.target.value) })}
              />
            </Field>
            <Field label="ตอนนี้ปลูกอะไร" hint="ถ้ามี">
              <select className="agro-input" value={value.currentCropId ?? ''} onChange={(e) => set({ currentCropId: e.target.value || null })}>
                <option value="">— เลือก / ยังไม่ได้ปลูก —</option>
                {CURRENT_CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="agro-step-hint thai">บอกข้อมูลแปลงคร่าวๆ ก่อน เดี๋ยวขั้นถัดไปค่อยปักตำแหน่งบนแผนที่</div>
        </>)}

        {step === 1 && (<>
          <div className={invalid('location') ? 'agro-field-invalid' : ''}>
            <Field label="ปักหมุดแปลงบนแผนที่ดาวเทียม" hint="แตะบนแผนที่เพื่อกำหนดจุด — ระบบดึงพิกัด + ความสูงให้อัตโนมัติ">
              <GoogleMapPicker
                lat={value.lat ?? NAN_CENTER.lat}
                lng={value.lng ?? NAN_CENTER.lng}
                elevationM={value.elevationM}
                loading={osm === 'loading'}
                onPick={useMapPoint}
              />
              {osm === 'error' && (
                <div className="agro-gps-err thai">ดึงความสูงจากแผนที่ไม่สำเร็จ — ใช้พิกัดจากแผนที่แล้ว แต่คงค่าความสูงเดิมไว้</div>
              )}
            </Field>
          </div>

          <div className="agro-loc-tools">
            <button type="button" className="agro-gps-btn agro-gps-wide" onClick={useGps} disabled={gps === 'loading'}>
              <Icon name="crosshair" size={18} /> {gps === 'loading' ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งปัจจุบัน (GPS)'}
            </button>
            {gps === 'error' && <div className="agro-gps-err thai">ขอตำแหน่งไม่สำเร็จ — ปักหมุดบนแผนที่ หรือเลือกอำเภอด้านล่าง</div>}
          </div>

          <Field label="หรือเลือกอำเภอในน่าน" hint="ตั้งพิกัด + ความสูงอัตโนมัติ">
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

          <Field label="ระดับความสูง (เมตร รทก.)" hint="ระบบดึงให้อัตโนมัติ · ปรับเองได้">
            <input
              type="number"
              className={`agro-input ${invalid('elevationM') ? 'is-invalid' : ''}`}
              value={numberValue(value.elevationM)}
              aria-invalid={invalid('elevationM') || undefined}
              onChange={(e) => set({ elevationM: e.target.value.trim() === '' ? Number.NaN : Number(e.target.value), locationLabel: 'กำหนดเอง' })}
            />
          </Field>
        </>)}

        {step === 2 && (
          <Field label="พืชที่อยากให้ระบบนำไปออกแบบ" hint="เลือกได้ทุกชั้น · เว้นว่างชั้นไหน ระบบจะเติมชนิดที่เหมาะกับพื้นที่ให้">
            <div className="agro-pick">
              {LAYERS.map((layer) => {
                const m = LAYER_META[layer];
                const selected = selectedByLayer[layer] ?? [];
                return (
                  <div key={layer} className={`agro-pick-layer layer-${layer}`}>
                    <div className="agro-pick-head">
                      <b className="thai"><span className="agro-pick-headglyph"><PlantGlyph plantId="" layer={layer} size={20} /></span> {m.th}</b>
                      <span className="thai">{selected.length ? `เลือก ${selected.length}` : 'อัตโนมัติ'}</span>
                    </div>
                    <div className="agro-chips">
                      {byLayer(layer).map((p) => {
                        const on = selected.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={on}
                            className={`agro-chip agro-pick-chip ${on ? 'on' : ''}`}
                            onClick={() => togglePlant(layer, p.id)}
                          >
                            <span className="agro-pick-icon"><PlantGlyph plantId={p.id} layer={layer} size={22} /></span>
                            <span className="thai">{p.nameTh}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>
        )}

        {step === 3 && (<>
          <Field label="เป้าหมายรายได้ต่อปี" hint="ถ้ามี — ใช้เทียบกับแผนที่ระบบออกแบบ">
            <input
              type="number"
              min={0}
              className="agro-input"
              value={value.targetAnnualIncome ?? ''}
              placeholder="เช่น 180000 บาท/ปี"
              onChange={(e) => set({ targetAnnualIncome: Number(e.target.value) || undefined })}
            />
          </Field>

          <Field label="เป้าหมายของคุณ">
            <div className={`agro-goals ${invalid('goal') ? 'is-invalid' : ''}`}>
              {goals.map((g) => (
                <button key={g.id} type="button" className={`agro-goal ${value.goal === g.id ? 'on' : ''}`} onClick={() => set({ goal: g.id })}>
                  <div className="agro-goal-label thai">{g.label}</div>
                  <div className="agro-goal-desc thai">{g.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          {selectedPlantIds.length > 0 && (
            <details className="agro-advanced">
              <summary className="thai"><Icon name="gear" size={17} /> ปรับราคา/ผลผลิต/อัตรารอด รายชนิด (ไม่บังคับ)</summary>
              <div className="agro-calc-grid">
                {selectedPlantIds.map((id) => {
                  const plant = PLANTS.find((p) => p.id === id);
                  if (!plant) return null;
                  const a = assumption(id);
                  return (
                    <div key={id} className="agro-calc-row">
                      <b className="thai agro-calc-name"><PlantGlyph plantId={plant.id} layer={plant.layer} size={20} /> {plant.nameTh}</b>
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
            </details>
          )}
        </>)}
      </div>
    </Card>
  );
}
