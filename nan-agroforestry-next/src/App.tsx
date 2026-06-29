'use client';

import { useEffect, useState } from 'react';
import type { FarmInput, SystemPlan } from './data/types';
import type { Climate } from './lib/climate';
import './styles/animations.css';
import type { ProtectedArea } from './lib/gistda';
import type { SatContext } from './lib/satellite';
import type { SoilContext } from './lib/soil';
import { bahtK } from './lib/format';
import { LAYER_META, PLANTS } from './data/plants';
import type { Layer } from './data/types';
import { InputForm } from './components/InputForm';
import { PlantGlyph } from './components/PlantGlyph';
import { ResultPlan } from './components/ResultPlan';
import { Methodology } from './components/Methodology';
import { Icon, type IconName } from './components/Icon';

const DEFAULT_INPUT: FarmInput = {
  currentCropId: 'ข้าวโพดเลี้ยงสัตว์', sizeRai: 10, elevationM: 420,
  locationLabel: 'ปัว', lat: 19.179, lng: 100.907,
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
  goal: 'balanced',
};

function fireNear(prot: ProtectedArea | null) {
  return Math.max(prot?.fireNearby ?? 0, prot?.disasterFire7dNear ?? 0);
}

function floodNear(prot: ProtectedArea | null) {
  return Math.max(prot?.disasterFlood7dNear ?? 0, prot?.disasterFloodFreqNear ?? 0);
}

function missionLabel(sat: SatContext | null, prot: ProtectedArea | null, climate: Climate | null) {
  if (prot?.inside || sat?.verdict === 'forest') return 'Protect first';
  if (fireNear(prot) > 0) return 'Fire buffer';
  if (floodNear(prot) > 0) return 'Flood buffer';
  if (prot?.near) return 'Forest buffer';
  if (prot?.riverNear) return 'Watershed buffer';
  if ((climate?.drym ?? 0) >= 5 && (prot?.disasterDroughtLayers?.length ?? 0) > 0) return 'Drought resilient';
  if (sat?.verdict === 'restore') return 'Restore priority';
  return 'Agroforest upgrade';
}

function missionText(sat: SatContext | null, prot: ProtectedArea | null, climate: Climate | null) {
  if (prot?.inside) return 'อยู่ในเขตอนุรักษ์: ระบบแนะนำให้หยุดการแผ้วถางและประสานหน่วยงาน';
  if (sat?.verdict === 'forest') return 'ภาพดาวเทียมชี้ว่าเป็นป่า: เป้าหมายคือคุ้มครองพื้นที่เดิม';
  if (fireNear(prot) > 0) return `พบ hotspot ไฟป่าจาก GISTDA รอบแปลง ${fireNear(prot)} จุด: วนเกษตรหลายชั้นช่วยลดเชื้อเพลิงโล่งและทำแนวกันไฟสีเขียว`;
  if (floodNear(prot) > 0) return `พบสัญญาณน้ำท่วม/น้ำท่วมซ้ำซากจาก GISTDA รอบแปลง ${floodNear(prot)} พื้นที่: ควรออกแบบแนวริมน้ำ พืชคลุมดิน และโซนรับน้ำ`;
  if (prot?.near) return 'ใกล้แนวป่า: วนเกษตรทำหน้าที่เป็น buffer ลดแรงกดดันต่อพื้นที่อนุรักษ์';
  if (prot?.riverNear) return `ใกล้ลำน้ำในระยะ ${prot.riverDistanceM?.toLocaleString('en-US')} ม.: ควรทำแนวไม้ยืนต้นกันชน ลดดินไหลลงน้ำ`;
  if ((climate?.drym ?? 0) >= 5 && (prot?.disasterDroughtLayers?.length ?? 0) > 0) return `ฤดูแล้ง ${climate?.drym} เดือน และเชื่อมชั้นภัยแล้ง GISTDA (${prot?.disasterDroughtLayers?.join(', ')}): แผนควรเน้นร่มเงา คลุมดิน และชนิดทนแล้ง`;
  if (sat?.verdict === 'restore') return 'พื้นที่เกษตร/เสื่อมโทรม: เหมาะกับการฟื้นฟูด้วยไม้ยืนต้นหลายชั้น';
  return 'พื้นที่ปลูกได้: เพิ่มความหลากหลาย รายได้ และคาร์บอนด้วยระบบหลายชั้น';
}

const STEPS: Array<{ t: string; d: string; icon: IconName }> = [
  { t: 'แปลง', d: 'ขนาดและพืชเดิม', icon: 'plot' },
  { t: 'ตำแหน่ง', d: 'แผนที่ GPS อำเภอ', icon: 'pin' },
  { t: 'เลือกพืช', d: '4 ชั้นวนเกษตร', icon: 'leaf' },
  { t: 'เป้าหมาย', d: 'รายได้และ assumptions', icon: 'target' },
];
const LAST_STEP = STEPS.length - 1;

const LAYERS: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];
function selectedRows(input: FarmInput) {
  return LAYERS.map((layer) => ({
    layer,
    meta: LAYER_META[layer],
    plants: (input.selectedByLayer[layer] ?? [])
      .map((id) => PLANTS.find((p) => p.id === id))
    .filter(Boolean),
  })).filter((row) => row.plants.length);
}

function selectedPlantCount(input: FarmInput) {
  return LAYERS.reduce((sum, layer) => sum + (input.selectedByLayer[layer]?.length ?? 0), 0);
}

function goalLabel(goal: FarmInput['goal']) {
  if (goal === 'fast') return 'คืนทุนเร็ว';
  if (goal === 'profit') return 'กำไรสูงสุด';
  return 'สมดุล';
}

export function App() {
  const [input, setInput] = useState<FarmInput>(DEFAULT_INPUT);
  const [systems, setSystems] = useState<SystemPlan[] | null>(null);
  const [activePlan, setActivePlan] = useState(0);
  const [climate, setClimate] = useState<Climate | null>(null);
  const [prot, setProt] = useState<ProtectedArea | null>(null);
  const [sat, setSat] = useState<SatContext | null>(null);
  const [soil, setSoil] = useState<SoilContext | null>(null);
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'planner' | 'method'>('planner');
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const activeSystem = systems?.[Math.min(activePlan, Math.max(systems.length - 1, 0))] ?? null;

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get('plan');
    if (!encoded) return;
    try {
      setInput(JSON.parse(decodeURIComponent(atob(encoded))) as FarmInput);
    } catch {
      setApiWarnings(['อ่าน share URL ไม่สำเร็จ']);
    }
  }, []);

  const persistPlan = (nextSystems: SystemPlan[]) => {
    const encoded = btoa(encodeURIComponent(JSON.stringify(input)));
    window.history.replaceState(null, '', `?plan=${encoded}`);
    const item = { input, createdAt: new Date().toISOString(), bestProfit10: nextSystems[0]?.profit10 ?? 0 };
    const history = JSON.parse(window.localStorage.getItem('nan-agro-history') ?? '[]') as unknown[];
    window.localStorage.setItem('nan-agro-history', JSON.stringify([item, ...history].slice(0, 12)));
  };

  const run = async () => {
    setBusy(true);
    setApiWarnings([]);
    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`plan API ${response.status}`);
      const data = await response.json() as {
        systems: SystemPlan[];
        climate: Climate | null;
        protectedArea: ProtectedArea | null;
        satellite: SatContext | null;
        soil: SoilContext | null;
        warnings: string[];
      };
      setClimate(data.climate);
      setProt(data.protectedArea);
      setSat(data.satellite);
      setSoil(data.soil);
      setApiWarnings(data.warnings ?? []);
      setActivePlan(0);
      setSystems(data.systems);
      persistPlan(data.systems);
      setShowResult(true);
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60);
    } catch (error) {
      setApiWarnings([error instanceof Error ? error.message : 'ไม่สามารถคำนวณแผนได้']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="agro-app">
      <header className="agro-header">
        <div className="agro-brand">
          <span className="agro-brand-mark"><Icon name="tree" size={34} strokeWidth={1.7} /></span>
          <div>
            <div className="agro-brand-name">
              <span>วนเกษตรน่าน</span>
              <span className="agro-brand-en">Nan Agroforestry Planner</span>
            </div>
            <div className="agro-brand-sub thai">ออกแบบระบบวนเกษตรหลายชั้น จากข้อมูลดาวเทียม GISTDA + โมเดล AI</div>
          </div>
        </div>
        <div className="agro-nav">
          <button className={tab === 'planner' ? 'on' : ''} onClick={() => setTab('planner')}>แพลนเนอร์</button>
          <button className={tab === 'method' ? 'on' : ''} onClick={() => setTab('method')}>วิธีการ &amp; ความน่าเชื่อถือ</button>
        </div>
        <span className="chip data thai agro-model-chip"><span className="dot" />Server-side SDM · GBIF + NASA POWER + GISTDA features</span>
      </header>

      {tab === 'method' && <Methodology />}

      {tab === 'planner' && !showResult && (
        <div className="agro-wizard">
          <div className="agro-wizard-shell">
            <aside className="agro-wizard-side">
              <div className="agro-side-head">
                <span className="agro-impact-k">Farm design</span>
                <b className="thai">Decision support</b>
              </div>
              <div className="agro-side-summary">
                <div><Icon name="plot" size={17} /><span className="thai">{input.sizeRai} ไร่</span></div>
                <div><Icon name="pin" size={17} /><span className="thai">{input.locationLabel}</span></div>
                <div><Icon name="target" size={17} /><span className="thai">{goalLabel(input.goal)}</span></div>
                <div><Icon name="leaf" size={17} /><span className="thai">{selectedPlantCount(input) ? `${selectedPlantCount(input)} ชนิด` : 'ให้ระบบเติมพืช'}</span></div>
              </div>
              <div className="agro-stepper">
                {STEPS.map((s, i) => (
                  <button key={i} type="button"
                    className={`agro-step-dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
                    onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
                    <span className="agro-step-ic"><Icon name={i < step ? 'check' : s.icon} size={20} /></span>
                    <span className="agro-step-copy">
                      <span className="agro-step-t thai">{s.t}</span>
                      <span className="agro-step-d thai">{s.d}</span>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="agro-wizard-main">
              <div className="agro-step-titlebar">
                <div>
                  <span className="agro-impact-k">ขั้นที่ {step + 1}/{STEPS.length}</span>
                  <div className="agro-step-title thai">{STEPS[step].t}</div>
                </div>
                <span className="agro-step-sub thai">{STEPS[step].d}</span>
              </div>

              <InputForm value={input} onChange={setInput} step={step} />

              {apiWarnings.length > 0 && (
                <div className="agro-gistda warn">
                  <span className="agro-gistda-icon"><Icon name="warning" size={24} /></span>
                  <div className="agro-gistda-body">
                    <b className="thai">ยังคำนวณไม่สำเร็จ</b>
                    <div className="thai">{apiWarnings.join(' · ')}</div>
                  </div>
                </div>
              )}

              <div className="agro-wiz-nav">
                <button type="button" className="agro-wiz-btn back" disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}><Icon name="arrowLeft" size={18} /> ย้อนกลับ</button>
                {step < LAST_STEP ? (
                  <button type="button" className="agro-wiz-btn next"
                    onClick={() => setStep((s) => Math.min(LAST_STEP, s + 1))}>ถัดไป <Icon name="arrowRight" size={18} /></button>
                ) : (
                  <button type="button" className="agro-wiz-btn submit" disabled={busy} onClick={run}>
                    {busy ? 'กำลังวิเคราะห์…' : <><Icon name="sprout" size={19} /> ออกแบบระบบ</>}
                  </button>
                )}
              </div>
            </main>
          </div>
        </div>
      )}

      {tab === 'planner' && showResult && (<>
      <div className="agro-result-top">
        <button type="button" className="agro-result-back thai" onClick={() => setShowResult(false)}><Icon name="edit" size={16} /> แก้ไขข้อมูล</button>
        <span className="agro-result-loc thai">{input.locationLabel} · {input.sizeRai} ไร่ · {input.elevationM} ม.</span>
      </div>

      {apiWarnings.length > 0 && (
        <div className="agro-gistda warn">
          <span className="agro-gistda-icon"><Icon name="warning" size={24} /></span>
          <div className="agro-gistda-body">
            <b className="thai">ข้อมูลบางส่วนไม่พร้อม</b>
            <div className="thai">{apiWarnings.join(' · ')}</div>
            <div className="agro-gistda-src">ระบบยังใช้ fallback/ข้อมูลที่มีอยู่เพื่อช่วยตัดสินใจ ไม่ใช่ตัวเลขรับรอง</div>
          </div>
        </div>
      )}

      {prot && (
        <div className={`agro-gistda ${prot.inside ? 'danger' : prot.near ? 'warn' : 'ok'}`}>
          <span className="agro-gistda-icon"><Icon name={prot.inside ? 'shieldX' : prot.near ? 'shield' : 'checkCircle'} size={24} /></span>
          <div className="agro-gistda-body">
            {prot.inside ? (
              <><b className="thai">แปลงอยู่ในเขต{prot.type} {prot.name ?? ''}</b>
                <div className="thai">ห้ามปลูก/แผ้วถางตามกฎหมาย — ทำวนเกษตรได้เฉพาะนอกเขต หรือร่วมโครงการฟื้นฟูกับหน่วยงาน</div></>
            ) : prot.near ? (
              <><b className="thai">ใกล้เขต{prot.type} {prot.name ?? ''} (~3 กม.)</b>
                <div className="thai">วนเกษตรหลายชั้นช่วยเป็นแนวกันชนปกป้องป่าและลดการรุกป่า</div></>
            ) : (
              <><b className="thai">ไม่อยู่ในเขตอนุรักษ์ — ปลูกได้</b>
                <div className="thai">เหมาะกับการฟื้นฟูพื้นที่เกษตรเชิงเดี่ยวให้เป็นวนเกษตร</div></>
            )}
            <div className="agro-gistda-src">ที่มา: {prot.source}</div>
          </div>
        </div>
      )}

      {prot?.riverNear && (
        <div className="agro-gistda water">
          <span className="agro-gistda-icon"><Icon name="drop" size={24} /></span>
          <div className="agro-gistda-body">
            <b className="thai">GISTDA ลำน้ำ: ใกล้ลำน้ำภายใน {prot.riverDistanceM?.toLocaleString('en-US')} ม.</b>
            <div className="thai">
              แนะนำทำแนวกันชนริมน้ำด้วยไม้ยืนต้น/พืชคลุมดิน ลดการชะล้างหน้าดินและสารเคมีลงลำน้ำน่าน
              {prot.riverAmphoe ? ` · พื้นที่ ${prot.riverTambon ?? ''} ${prot.riverAmphoe}` : ''}
            </div>
            <div className="agro-gistda-src">ที่มา: {prot.source} · ชั้นข้อมูลแม่น้ำ</div>
          </div>
        </div>
      )}

      {prot && prot.fireHotspots > 0 && (
        <div className={`agro-gistda ${prot.fireNearby > 0 ? 'danger' : 'warn'}`}>
          <span className="agro-gistda-icon"><Icon name="fire" size={24} /></span>
          <div className="agro-gistda-body">
            <b className="thai">GISTDA ไฟป่า: น่านพบ hotspot {prot.fireHotspots.toLocaleString('en-US')} จุด{prot.fireNearby > 0 ? ` · รอบแปลง 50 กม. ${prot.fireNearby} จุด` : ''}</b>
            <div className="thai">
              {prot.fireProtected > 0 ? `หลายจุดอยู่ในพื้นที่ป่า/อนุรักษ์ (${prot.fireProtected.toLocaleString('en-US')} จุด) · ` : ''}
              แนะนำออกแบบแนวกันไฟสีเขียว ลดพื้นที่โล่งเชิงเดี่ยว และเพิ่มความชื้นด้วยพืชคลุมดิน
            </div>
            <div className="agro-gistda-src">
              ที่มา: GISTDA FR_Fire · MODIS/Terra-Aqua + VIIRS/Suomi-NPP
              {prot.fireMaxConfidence ? ` · confidence สูงสุด ${prot.fireMaxConfidence}` : ''}
            </div>
          </div>
        </div>
      )}

      {prot?.disasterStatus === 'live' && (
        <div className={`agro-gistda ${fireNear(prot) > 0 ? 'danger' : floodNear(prot) > 0 ? 'warn' : 'ok'}`}>
          <span className="agro-gistda-icon"><Icon name="satellite" size={24} /></span>
          <div className="agro-gistda-body">
            <b className="thai">
              GISTDA Disaster API: ไฟป่า 7 วันรอบแปลง {prot.disasterFire7dNear?.toLocaleString('en-US')} จุด · น้ำท่วม 7 วัน {prot.disasterFlood7dNear?.toLocaleString('en-US')} พื้นที่
            </b>
            <div className="thai">
              ทั้งจังหวัดน่าน: VIIRS {prot.disasterFire7dNan?.toLocaleString('en-US')} จุด · น้ำท่วม {prot.disasterFlood7dNan?.toLocaleString('en-US')} พื้นที่
              {' '}· รอบแปลง {prot.disasterRadiusKm} กม.: burn scar {prot.disasterBurnScarNear?.toLocaleString('en-US')} · flood frequency {prot.disasterFloodFreqNear?.toLocaleString('en-US')}
            </div>
            <div className="agro-gistda-src">
              ที่มา: {prot.disasterSource} · ภัยแล้งพร้อมใช้ {prot.disasterDroughtLayers?.join(' / ') || '—'}
            </div>
          </div>
        </div>
      )}

      {prot?.disasterStatus === 'missing-key' && (
        <div className="agro-gistda warn">
          <span className="agro-gistda-icon"><Icon name="key" size={24} /></span>
          <div className="agro-gistda-body">
            <b className="thai">GISTDA Disaster API ยังไม่เปิดใน production</b>
            <div className="thai">ตั้งค่า Environment Variable `GISTDA_DISASTER_API_KEY` บน Vercel เพื่อเปิดข้อมูลไฟป่า น้ำท่วม และภัยแล้งแบบ official API</div>
            <div className="agro-gistda-src">key จะอยู่ฝั่ง Next.js API route เท่านั้น ไม่ถูกส่งเข้า frontend bundle</div>
          </div>
        </div>
      )}

      {sat && (
        <div className={`agro-gistda ${sat.verdict === 'forest' ? 'danger' : sat.verdict === 'restore' ? 'ok' : 'warn'}`}>
          <span className="agro-gistda-icon"><Icon name="satellite" size={24} /></span>
          <div className="agro-gistda-body">
            {sat.verdict === 'forest' ? (
              <><b className="thai">ภาพดาวเทียม: พื้นที่นี้เป็นป่า ({sat.lcTh}, tree cover {sat.tc}%)</b>
                <div className="thai">ไม่ควรแผ้วถางเพื่อทำเกษตร — ควรอนุรักษ์/ฟื้นฟูสภาพป่า</div></>
            ) : sat.verdict === 'restore' ? (
              <><b className="thai">ภาพดาวเทียม: {sat.lcTh}{sat.lossyr ? ` · เคยเป็นป่า สูญเสียปี ${sat.lossyr + 543}` : ''} · NDVI {sat.ndvi ?? '—'}</b>
                <div className="thai">พื้นที่เสื่อมโทรม/เกษตรเชิงเดี่ยว — เหมาะอย่างยิ่งกับการฟื้นเป็นวนเกษตร</div></>
            ) : (
              <><b className="thai">ภาพดาวเทียม: {sat.lcTh} · NDVI {sat.ndvi ?? '—'}</b>
                <div className="thai">ปลูกวนเกษตรเสริมความหลากหลายได้</div></>
            )}
            <div className="agro-gistda-src">ที่มา: {sat.source} (ผ่าน Google Earth Engine) · cell ใกล้สุด {sat.distanceKm} กม.</div>
          </div>
        </div>
      )}

      {soil && (
        <div className={`agro-gistda ${soil.acidity === 'strong' || soil.fertility < 0.45 ? 'warn' : 'ok'}`}>
          <span className="agro-gistda-icon"><Icon name="soil" size={24} /></span>
          <div className="agro-gistda-body">
            <b className="thai">ดินจริง: {soil.texture} · pH {soil.ph} ({soil.acidityTh}) · {soil.drainageTh}</b>
            <div className="thai">
              อินทรียวัตถุ {soil.organicCarbonPct}% · ไนโตรเจน {soil.nitrogenPct}% · CEC {soil.cec} mmol/kg ·
              เนื้อดิน clay {soil.clayPct}% / sand {soil.sandPct}% / silt {soil.siltPct}% ·
              ความอุดมสมบูรณ์ {soil.fertilityTh}
              {soil.acidity === 'strong' ? ' — ดินกรดจัด ควรปรับ pH ด้วยปูนก่อนปลูกไม้ผลที่ไวต่อกรด' : ''}
              {' '}ระบบนำค่าดินนี้ไปปรับอันดับพืชตามการระบายน้ำ/ความเป็นกรดแล้ว
            </div>
            <div className="agro-gistda-src">ที่มา: {soil.source} · ความลึก {soil.depthLabel} · ค่าประมาณเชิงพื้นที่ ควรยืนยันด้วยชุดตรวจดินจริงก่อนลงทุน</div>
          </div>
        </div>
      )}

      {systems && activeSystem && (
        <section className="agro-results">
          {selectedRows(input).length > 0 && (
            <div className="agro-selection-summary">
              <div>
                <span className="agro-impact-k">Farmer input used</span>
                <h2 className="thai">พืชที่คุณเลือกถูกนำเข้าแผนแล้ว</h2>
              </div>
              <div className="agro-selection-grid">
                {selectedRows(input).map((row) => (
                  <div key={row.layer} className="agro-selection-row">
                    <b className="thai agro-sel-head"><PlantGlyph plantId="" layer={row.layer} size={18} /> {row.meta.th}</b>
                    <span className="thai agro-sel-plants">
                      {row.plants.map((p) => (
                        <span key={p!.id} className="agro-sel-plant">
                          <PlantGlyph plantId={p!.id} layer={p!.layer} size={18} /> {p!.nameTh}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`agro-impact ${prot?.inside || sat?.verdict === 'forest' || fireNear(prot) > 0 ? 'danger' : sat?.verdict === 'restore' || prot?.near || prot?.riverNear || floodNear(prot) > 0 ? 'ok' : 'data'}`}>
            <div className="agro-impact-main">
              <span className="agro-impact-k">Forest decision</span>
              <h2 className="thai">{missionLabel(sat, prot, climate)}</h2>
              <p className="thai">{missionText(sat, prot, climate)}</p>
            </div>
            <div className="agro-impact-grid">
              <div>
                <span>GISTDA fire</span>
                <b>{prot ? `${fireNear(prot)} near · ${prot.disasterFire7dNan ?? prot.fireHotspots} Nan` : '—'}</b>
              </div>
              <div>
                <span>GISTDA flood</span>
                <b>{prot?.disasterStatus === 'live' ? `${prot.disasterFlood7dNear} near · ${prot.disasterFloodFreqNear} freq` : 'รอ Disaster API'}</b>
              </div>
              <div>
                <span>GISTDA water</span>
                <b>{prot?.riverNear ? `≤ ${prot.riverDistanceM?.toLocaleString('en-US')} m` : 'ไม่พบใกล้ 3 km'}</b>
              </div>
              <div>
                <span>GISTDA drought</span>
                <b>{prot?.disasterDroughtLayers?.length ? prot.disasterDroughtLayers.join(' / ') : 'รอ layer'}</b>
              </div>
              <div>
                <span>Agroforest fit</span>
                <b>{activeSystem.scoreParts.agroforestry ? `${Math.round(activeSystem.scoreParts.agroforestry * 100)}% system` : '—'}</b>
              </div>
              <div>
                <span>Carbon 10 yr</span>
                <b>{activeSystem.carbon10.toLocaleString('en-US')} tCO₂e</b>
              </div>
              <div>
                <span>Profit 10 yr</span>
                <b>{bahtK(activeSystem.profit10)}</b>
              </div>
            </div>
          </div>

          <div className="agro-results-head">
            <h2 className="thai">ระบบวนเกษตรที่แนะนำ</h2>
            <div className="thai agro-results-sub">
              แปลง {input.sizeRai} ไร่ · ความสูง {input.elevationM} ม.
              {climate && Number.isFinite(climate.t2m)
                ? ` · อุณหภูมิ ${climate.t2m.toFixed(1)}°C · ฝน ${climate.prec.toFixed(0)} มม./ปี · เดือนแล้ง ${climate.drym} (NASA POWER)`
                : ' · ใช้เกณฑ์ความสูง (ออฟไลน์)'}
              {' '}· เป้าหมาย {input.goal === 'fast' ? 'เห็นผลไว' : input.goal === 'profit' ? 'กำไรสูงสุด' : 'สมดุล'}
            </div>
            <div className="agro-results-actions">
              <button type="button" className="agro-osm-link thai" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Icon name="copy" size={16} /> คัดลอกลิงก์แผน</button>
              <button type="button" className="agro-osm-link thai" onClick={() => window.print()}><Icon name="print" size={16} /> พิมพ์/PDF</button>
            </div>
          </div>
          <div className="agro-plan-tabs" role="tablist" aria-label="เลือกแผนวนเกษตร">
            {systems.map((s, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={activePlan === i}
                className={activePlan === i ? 'on' : ''}
                onClick={() => setActivePlan(i)}
              >
                <span className="thai">แผน {i + 1}</span>
                <b className="thai">{s.badge}</b>
                <em>{bahtK(s.profit10)} · agroforest {Math.round(s.scoreParts.agroforestry * 100)}%</em>
              </button>
            ))}
          </div>

          <div className="agro-plan-panel" role="tabpanel">
            <ResultPlan sys={activeSystem} rank={activePlan + 1} allSystems={systems} />
          </div>
          <div className="agro-disclaimer thai">
            * ความเหมาะสมพืชมาจาก SDM (GBIF + NASA POWER + GISTDA features) และถูกคุมด้วยเกณฑ์ agronomic ทั้งความสูง (เช่น กาแฟ/มะแขว่นต้องเป็นพื้นที่สูง) และดินจริงจาก SoilGrids (การระบายน้ำ/ความเป็นกรด/ความอุดมสมบูรณ์) ส่วนผลผลิต/ราคา/ต้นทุนเป็นค่าประมาณการ ควรปรึกษาเกษตรอำเภอและตรวจดินจริงก่อนลงมือ
          </div>
        </section>
      )}
      </>)}

      <footer className="agro-foot thai">
        ข้อมูล: Google Maps (เลือกพิกัดแปลง) · GISTDA (พื้นที่อนุรักษ์ + ลำน้ำ + Disaster Open API ไฟป่า/น้ำท่วม/ภัยแล้ง) · NASA POWER + Open-Meteo (ภูมิอากาศ/ความสูง) · SoilGrids/ISRIC (ดินจริง) · GBIF (จุดพบพืช) — ต้นแบบ space tech for forest
      </footer>
    </div>
  );
}
