import { useState } from 'react';
import type { CropAssumption, ExistingZone, FarmInput, Goal, Layer } from '../data/types';
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

const CURRENT_CROPS = [
  'ข้าวโพดเลี้ยงสัตว์', 'ข้าวไร่', 'มันสำปะหลัง', 'ยางพารา',
  'ไม้ผลผสม', 'สวนผสม', 'ป่า/ไม้ยืนต้นเดิม', 'พื้นที่ว่าง/เพิ่งถาง', 'พื้นที่เสื่อมโทรม', 'อื่นๆ',
];
const LAYERS: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

export function InputForm({ value, onChange, step, invalidFields = [] }: {
  value: FarmInput; onChange: (v: FarmInput) => void; step: number; invalidFields?: string[];
}) {
  const [gps, setGps] = useState<'idle' | 'loading' | 'error' | 'elev-error'>('idle');
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | undefined>(undefined);
  const [osm, setOsm] = useState<'idle' | 'loading' | 'error'>('idle');
  const set = (patch: Partial<FarmInput>) => onChange({ ...value, ...patch });
  const invalid = (field: string) => invalidFields.includes(field);
  const numberValue = (n: number) => Number.isFinite(n) ? n : '';
  const existingZones = value.existingZones?.length
    ? value.existingZones
    : [{ id: 'zone-1', cropId: value.currentCropId ?? 'ข้าวโพดเลี้ยงสัตว์', areaRai: Number.isFinite(value.sizeRai) ? value.sizeRai : 1 }];
  const zoneTotal = existingZones.reduce((sum, z) => sum + (Number.isFinite(z.areaRai) ? z.areaRai : 0), 0);
  const zoneGap = Number.isFinite(value.sizeRai) ? zoneTotal - value.sizeRai : 0;
  const setZones = (zones: ExistingZone[]) => {
    const clean = zones.map((z) => ({
      ...z,
      cropId: z.cropId || CURRENT_CROPS[0],
      areaRai: Number.isFinite(z.areaRai) ? z.areaRai : 0,
    }));
    set({ existingZones: clean, currentCropId: clean[0]?.cropId ?? value.currentCropId });
  };
  const updateZone = (id: string, patch: Partial<ExistingZone>) => {
    setZones(existingZones.map((z) => z.id === id ? { ...z, ...patch } : z));
  };
  const addZone = () => {
    const remaining = Number.isFinite(value.sizeRai) ? Math.max(0.5, Math.round((value.sizeRai - zoneTotal) * 10) / 10) : 1;
    setZones([...existingZones, { id: `zone-${Date.now()}`, cropId: CURRENT_CROPS[0], areaRai: remaining }]);
  };
  const removeZone = (id: string) => {
    if (existingZones.length <= 1) return;
    setZones(existingZones.filter((z) => z.id !== id));
  };
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
    // Two separate try blocks on purpose. Previously both awaits shared one try and the
    // catch never called set(), so a 9s elevation timeout or a 502 from the proxy threw
    // away a perfectly good GPS fix AND reported it as "อาจไม่ได้อนุญาต GPS" — diagnosing
    // a network fault as a permissions problem, on the button we tell officers to use first.
    let fix: { lat: number; lng: number; accuracyM?: number };
    try {
      fix = await getGeolocation();
    } catch {
      setGps('error');
      return;
    }
    const { lat, lng, accuracyM } = fix;
    setGpsAccuracyM(accuracyM);
    // Keep the coordinates the moment we have them, whatever elevation does next.
    set({ lat, lng, locationLabel: `GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
    try {
      const elev = await fetchElevation(lat, lng);
      set({ lat, lng, elevationM: elev, locationLabel: `GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setGps('idle');
    } catch {
      // Coordinates are already saved; only elevation is missing, and the user can type it.
      setGps('elev-error');
    }
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
            <Field label="ขนาดแปลง (ไร่)" htmlFor="farm-size">
              <input
                id="farm-size"
                type="number"
                inputMode="decimal"
                min={0.5}
                max={500}
                step={0.5}
                className={`agro-input ${invalid('sizeRai') ? 'is-invalid' : ''}`}
                value={numberValue(value.sizeRai)}
                aria-invalid={invalid('sizeRai') || undefined}
                onChange={(e) => set({ sizeRai: e.target.value.trim() === '' ? Number.NaN : Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="agro-zone-panel">
            <div className="agro-zone-head">
              <div>
                <b className="thai">การใช้พื้นที่เดิม / โซนในแปลง</b>
                <span className="thai">ถ้าแปลงเดียวแบ่งหลายส่วน ให้แยกเป็นหลายโซน ระบบจะเอาไปคิดต้นทุนเปลี่ยนผ่านปีแรก</span>
              </div>
              <button type="button" className="agro-zone-add thai" onClick={addZone}><Icon name="plot" size={16} /> เพิ่มโซน</button>
            </div>

            <div className="agro-zone-list">
              {existingZones.map((zone, index) => (
                <div key={zone.id} className="agro-zone-row">
                  <span className="agro-zone-index">{index + 1}</span>
                  <label>
                    <span className="thai">พืช/สภาพพื้นที่เดิม</span>
                    <select className="agro-input" value={zone.cropId} onChange={(e) => updateZone(zone.id, { cropId: e.target.value })}>
                      {CURRENT_CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="thai">พื้นที่โซน (ไร่)</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      className="agro-input"
                      value={numberValue(zone.areaRai)}
                      onChange={(e) => updateZone(zone.id, { areaRai: e.target.value.trim() === '' ? Number.NaN : Number(e.target.value) })}
                    />
                  </label>
                  <button type="button" className="agro-zone-remove thai" onClick={() => removeZone(zone.id)} disabled={existingZones.length <= 1}>ลบ</button>
                </div>
              ))}
            </div>

            <div className={`agro-zone-total thai ${Math.abs(zoneGap) > 0.2 ? 'warn' : 'ok'}`}>
              รวมโซน {zoneTotal.toLocaleString('en-US')} / {Number.isFinite(value.sizeRai) ? value.sizeRai.toLocaleString('en-US') : '-'} ไร่
              {Math.abs(zoneGap) > 0.2 ? ` · ${zoneGap > 0 ? 'เกินขนาดแปลง' : 'ยังไม่ครบขนาดแปลง'} ${Math.abs(zoneGap).toFixed(1)} ไร่` : ' · สอดคล้องกับขนาดแปลง'}
            </div>
          </div>
          <div className="agro-step-hint thai">ข้อมูลนี้จะถูกใช้เป็นต้นทุนเตรียมพื้นที่/เปลี่ยนผ่าน ไม่ใช่แค่ข้อความประกอบผลลัพธ์</div>
        </>)}

        {step === 1 && (<>
          {/* Primary, recommended: one tap gets coordinates + elevation. Best for a
              farmer standing in their own plot on a phone. */}
          <div className={`agro-gps-primary ${invalid('location') ? 'agro-field-invalid' : ''}`}>
            <button type="button" data-tour="gps" className="agro-gps-hero" onClick={useGps} disabled={gps === 'loading'}>
              <span className="agro-gps-hero-badge thai">แนะนำ</span>
              <span className="agro-gps-hero-ic"><Icon name="crosshair" size={26} /></span>
              <span className="agro-gps-hero-t thai">{gps === 'loading' ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งปัจจุบัน (GPS)'}</span>
              <span className="agro-gps-hero-d thai">ยืนอยู่ในแปลง? กดปุ่มนี้ปุ่มเดียว ระบบดึงพิกัดและความสูงให้อัตโนมัติ</span>
            </button>
            {gps === 'error' && <div className="agro-gps-err thai">ขอตำแหน่งไม่สำเร็จ (อาจไม่ได้อนุญาต GPS) · เลือกอำเภอ หรือปักหมุดบนแผนที่ด้านล่างแทนได้</div>}
            {gps === 'elev-error' && (
              <div className="agro-gps-err thai">
                ได้พิกัด GPS แล้ว แต่ดึง<b>ความสูง</b>ไม่สำเร็จ (เน็ตอาจช้า) · พิกัดถูกบันทึกไว้แล้ว
                กรอกความสูงเองใน “ตัวเลือกเพิ่มเติม” ด้านล่าง หรือกด GPS อีกครั้ง
              </div>
            )}
            {Number.isFinite(value.lat) && Number.isFinite(value.lng) && (
              <div className="agro-gps-current thai">
                <Icon name="pin" size={15} /> ตำแหน่งที่เลือก: <b>{value.locationLabel || `${value.lat!.toFixed(3)}, ${value.lng!.toFixed(3)}`}</b>
                {Number.isFinite(value.elevationM) ? <> · ความสูง <b>{value.elevationM.toLocaleString('en-US')} ม.</b></> : null}
              </div>
            )}
            {/* A coarse fix changes the elevation band, and elevation gates the whole
                species ranking — so say so rather than rendering it as an exact pin. */}
            {gpsAccuracyM !== undefined && gpsAccuracyM > 150 && (
              <div className="agro-gps-warn thai">
                <Icon name="warning" size={14} /> สัญญาณ GPS หยาบ (คลาดเคลื่อน ~{gpsAccuracyM.toLocaleString('en-US')} ม.)
                · ความสูงที่ได้อาจไม่ตรงกับแปลงจริง ควรปักหมุดบนแผนที่ดาวเทียมเพื่อความแม่นยำ
              </div>
            )}
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

          {/* Optional/advanced: pick on the satellite map or fine-tune elevation.
              For planning a remote plot, on desktop, or when GPS is denied. */}
          <details className="agro-advanced agro-loc-advanced">
            <summary className="thai"><Icon name="pin" size={17} /> ปักหมุดบนแผนที่ดาวเทียม หรือปรับความสูงเอง (ไม่บังคับ)</summary>
            <div className="agro-loc-advanced-body">
              <Field label="ปักหมุดแปลงบนแผนที่ดาวเทียม" hint="แตะบนแผนที่เพื่อกำหนดจุด · ระบบดึงพิกัด + ความสูงให้อัตโนมัติ">
                <GoogleMapPicker
                  lat={value.lat ?? NAN_CENTER.lat}
                  lng={value.lng ?? NAN_CENTER.lng}
                  elevationM={value.elevationM}
                  loading={osm === 'loading'}
                  onPick={useMapPoint}
                />
                {osm === 'error' && (
                  <div className="agro-gps-err thai">ดึงความสูงจากแผนที่ไม่สำเร็จ · ใช้พิกัดจากแผนที่แล้ว แต่คงค่าความสูงเดิมไว้</div>
                )}
              </Field>

              <Field label="ระดับความสูง (เมตร รทก.)" hint="ระบบดึงให้อัตโนมัติ · ปรับเองได้" htmlFor="farm-elev">
                <input
                  id="farm-elev"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={2600}
                  step={10}
                  className={`agro-input ${invalid('elevationM') ? 'is-invalid' : ''}`}
                  value={numberValue(value.elevationM)}
                  aria-invalid={invalid('elevationM') || undefined}
                  onChange={(e) => set({ elevationM: e.target.value.trim() === '' ? Number.NaN : Number(e.target.value), locationLabel: 'กำหนดเอง' })}
                />
              </Field>
            </div>
          </details>
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
                            {/* Name and วิสัย stack in their own column. Putting the habit
                                directly in the chip's flex row made it a third sibling and
                                squeezed the name into a one-letter-per-line column. */}
                            <span className="agro-pick-text">
                              <span className="thai">{p.nameTh}</span>
                              <span className="agro-pick-habit thai">{p.habit}</span>
                            </span>
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
          <Field label="เป้าหมายรายได้ต่อปี" hint="ถ้ามี · ใช้เทียบกับแผนที่ระบบออกแบบ" htmlFor="farm-target">
            <input
              id="farm-target"
              type="number"
              min={0}
              max={20000000}
              step={1000}
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

          {/* Framed as "your numbers beat ours", not as advanced settings. The old summary
              said "(ไม่บังคับ)", which reads as skippable — but the defaults are national
              reference figures, and a farmer who knows what their own buyer pays holds
              strictly better information about their own plot than any national average.
              Every ฿ figure in the result is downstream of these five numbers. */}
          {selectedPlantIds.length > 0 && (
            <details className="agro-advanced">
              <summary className="thai">
                <Icon name="gear" size={17} /> ใส่ราคาและต้นทุนของคุณเอง ({selectedPlantIds.length} ชนิด)
              </summary>
              <p className="thai agro-calc-lead">
                ตัวเลขที่ใส่ไว้ให้เป็น<b>ค่าอ้างอิงกลาง</b> ถ้าคุณรู้ราคาที่ขายได้จริงในพื้นที่
                หรือต้นทุนที่จ่ายจริง <b>ใส่ทับได้เลย — จะแม่นกว่า</b>
                {' '}เพราะรายได้ทุกตัวในผลลัพธ์คำนวณจากช่องเหล่านี้
              </p>
              <div className="agro-calc-grid">
                {selectedPlantIds.map((id) => {
                  const plant = PLANTS.find((p) => p.id === id);
                  if (!plant) return null;
                  const a = assumption(id);
                  return (
                    <div key={id} className="agro-calc-row">
                      <b className="thai agro-calc-name"><PlantGlyph plantId={plant.id} layer={plant.layer} size={20} /> {plant.nameTh}</b>
                      {/* Labelled in Thai, not "฿/kg / kg/rai / survival". These three boxes
                          are otherwise indistinguishable, they feed the cashflow directly,
                          and a farmer who types a price into the yield box gets a plan that
                          is wrong by orders of magnitude. */}
                      <label>
                        <span className="thai">ราคา ฿/กก.</span>
                        <input type="number" className="agro-input" value={a.pricePerKg ?? plant.pricePerKg}
                          onChange={(e) => setAssumption(id, { pricePerKg: Number(e.target.value) || plant.pricePerKg })} />
                      </label>
                      <label>
                        <span className="thai">ผลผลิต กก./ไร่</span>
                        <input type="number" className="agro-input" value={a.yieldKgPerRai ?? plant.yieldKgPerRai}
                          onChange={(e) => setAssumption(id, { yieldKgPerRai: Number(e.target.value) || plant.yieldKgPerRai })} />
                      </label>
                      {/* Cost, not just price. The engine, the schema and CropAssumption have
                          supported establishCostPerRai / annualCostPerRai since the start
                          (engine.ts:258) — there was simply never an input for them, so the
                          cashflow always used a national default cost against a price the
                          farmer could correct. Half an override is worse than none: it let a
                          farmer lower the price and still be charged someone else's costs. */}
                      <label>
                        <span className="thai">ต้นทุนปลูก ฿/ไร่</span>
                        <input type="number" min={0} className="agro-input" value={a.establishCostPerRai ?? plant.establishCostPerRai}
                          onChange={(e) => setAssumption(id, { establishCostPerRai: Number(e.target.value) || plant.establishCostPerRai })} />
                      </label>
                      <label>
                        <span className="thai">ต้นทุนดูแล ฿/ไร่/ปี</span>
                        <input type="number" min={0} className="agro-input" value={a.annualCostPerRai ?? plant.annualCostPerRai}
                          onChange={(e) => setAssumption(id, { annualCostPerRai: Number(e.target.value) || plant.annualCostPerRai })} />
                      </label>
                      <label>
                        <span className="thai">อัตรารอด (0–1)</span>
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
