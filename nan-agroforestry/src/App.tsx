import { useState } from 'react';
import type { FarmInput, SystemPlan } from './data/types';
import { buildSystems } from './lib/engine';
import { fetchClimate, type Climate } from './lib/climate';
import { checkProtected, type ProtectedArea } from './lib/gistda';
import { satContext, type SatContext } from './lib/satellite';
import { modelMeta } from './lib/suitability';
import { bahtK } from './lib/format';
import { LAYER_META, PLANTS } from './data/plants';
import type { Layer } from './data/types';
import { InputForm } from './components/InputForm';
import { ResultPlan } from './components/ResultPlan';
import { Methodology } from './components/Methodology';

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

export function App() {
  const [input, setInput] = useState<FarmInput>(DEFAULT_INPUT);
  const [systems, setSystems] = useState<SystemPlan[] | null>(null);
  const [climate, setClimate] = useState<Climate | null>(null);
  const [prot, setProt] = useState<ProtectedArea | null>(null);
  const [sat, setSat] = useState<SatContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'planner' | 'method'>('planner');
  const mm = modelMeta();

  const run = async () => {
    setBusy(true);
    const lat = input.lat ?? 18.78, lng = input.lng ?? 100.78;
    const [clim, pa] = await Promise.all([
      fetchClimate(lat, lng, input.elevationM).catch(() => null),
      checkProtected(lat, lng).catch(() => null),
    ]);
    setClimate(clim); setProt(pa); setSat(satContext(lat, lng));
    setSystems(buildSystems(input, clim));
    setBusy(false);
  };

  return (
    <div className="agro-app">
      <header className="agro-header">
        <div className="agro-brand">
          <span className="agro-brand-mark">🌳</span>
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
        <span className="chip data thai agro-model-chip"><span className="dot" />SDM {mm.count} ชนิด · AUC เฉลี่ย {mm.avgAuc.toFixed(2)}</span>
      </header>

      {tab === 'method' && <Methodology />}

      {tab === 'planner' && (<>
      <div className="agro-intro thai">
        ระบบออกแบบ <strong>วนเกษตร 4 ชั้น</strong> (ไม้ยืนต้น ≥2 · ไม้พุ่ม · ไม้คลุมดิน · ไม้ลงดิน) ให้เหมาะกับแปลงของคุณ —
        วิเคราะห์ <strong>ความเหมาะสมจากภูมิอากาศจริง</strong> (โมเดล SDM ฝึกด้วย GBIF + NASA POWER), ตรวจ <strong>พื้นที่อนุรักษ์ ลำน้ำ และไฟป่าจาก GISTDA</strong>,
        แล้วคำนวณ <strong>ผลผลิต · ราคา · กำไร</strong> เสนอ 3 แบบ (อันดับ 1 = ดีที่สุด)
      </div>

      <section className="agro-proof" aria-label="Space technology workflow">
        <div className="agro-proof-card">
          <span className="agro-proof-k">Satellite</span>
          <b className="thai">อ่านบริบทป่า</b>
          <p className="thai">Hansen forest loss · ESA WorldCover · Sentinel-2 NDVI ผ่าน Google Earth Engine</p>
        </div>
        <div className="agro-proof-card">
          <span className="agro-proof-k">GISTDA</span>
          <b className="thai">กันรุกป่า + เฝ้าระวังภัย</b>
          <p className="thai">ตรวจเขตอนุรักษ์ ลำน้ำ ไฟป่า น้ำท่วม และภัยแล้งจาก Disaster Open API ก่อนเสนอแผนปลูก</p>
        </div>
        <div className="agro-proof-card">
          <span className="agro-proof-k">Climate AI</span>
          <b className="thai">เลือกชนิดที่เหมาะจริง</b>
          <p className="thai">SDM ใช้ GBIF + NASA POWER เพื่อให้คะแนนไม้ยืนต้นตามสภาพพื้นที่</p>
        </div>
        <div className="agro-proof-card">
          <span className="agro-proof-k">Impact</span>
          <b className="thai">วัดผลที่จับต้องได้</b>
          <p className="thai">สรุปคาร์บอน กำไร คืนทุน และบทบาทต่อป่าในหน้าเดียว</p>
        </div>
      </section>

      <InputForm value={input} onChange={setInput} onSubmit={run} busy={busy} />

      {prot && (
        <div className={`agro-gistda ${prot.inside ? 'danger' : prot.near ? 'warn' : 'ok'}`}>
          <span className="agro-gistda-icon">{prot.inside ? '⛔' : prot.near ? '🌲' : '✅'}</span>
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
          <span className="agro-gistda-icon">💧</span>
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
          <span className="agro-gistda-icon">🔥</span>
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
          <span className="agro-gistda-icon">🛰️</span>
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
          <span className="agro-gistda-icon">🔑</span>
          <div className="agro-gistda-body">
            <b className="thai">GISTDA Disaster API ยังไม่เปิดใน production</b>
            <div className="thai">ตั้งค่า Environment Variable `GISTDA_DISASTER_API_KEY` บน Vercel เพื่อเปิดข้อมูลไฟป่า น้ำท่วม และภัยแล้งแบบ official API</div>
            <div className="agro-gistda-src">key จะอยู่ฝั่ง Vercel Function เท่านั้น ไม่ถูกส่งเข้า frontend bundle</div>
          </div>
        </div>
      )}

      {sat && (
        <div className={`agro-gistda ${sat.verdict === 'forest' ? 'danger' : sat.verdict === 'restore' ? 'ok' : 'warn'}`}>
          <span className="agro-gistda-icon">🛰️</span>
          <div className="agro-gistda-body">
            {sat.verdict === 'forest' ? (
              <><b className="thai">ภาพดาวเทียม: พื้นที่นี้เป็นป่า ({sat.lcTh}, tree cover {sat.tc}%)</b>
                <div className="thai">ไม่ควรแผ้วถางเพื่อทำเกษตร — ควรอนุรักษ์/ฟื้นฟูสภาพป่า</div></>
            ) : sat.verdict === 'restore' ? (
              <><b className="thai">ภาพดาวเทียม: {sat.lcTh}{sat.lossyr ? ` · เคยเป็นป่า สูญเสียปี ${sat.lossyr + 543}` : ''} · NDVI {sat.ndvi ?? '—'}</b>
                <div className="thai">พื้นที่เสื่อมโทรม/เกษตรเชิงเดี่ยว — เหมาะอย่างยิ่งกับการฟื้นเป็นวนเกษตร 🌱</div></>
            ) : (
              <><b className="thai">ภาพดาวเทียม: {sat.lcTh} · NDVI {sat.ndvi ?? '—'}</b>
                <div className="thai">ปลูกวนเกษตรเสริมความหลากหลายได้</div></>
            )}
            <div className="agro-gistda-src">ที่มา: {sat.source} (ผ่าน Google Earth Engine) · cell ใกล้สุด {sat.distanceKm} กม.</div>
          </div>
        </div>
      )}

      {systems && (
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
                    <b className="thai">{row.meta.emoji} {row.meta.th}</b>
                    <span className="thai">{row.plants.map((p) => `${p!.emoji} ${p!.nameTh}`).join(' · ')}</span>
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
                <span>Carbon 10 yr</span>
                <b>{systems[0].carbon10.toLocaleString('en-US')} tCO₂e</b>
              </div>
              <div>
                <span>Profit 10 yr</span>
                <b>{bahtK(systems[0].profit10)}</b>
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
          </div>
          <div className="agro-plans">
            {systems.map((s, i) => <ResultPlan key={i} sys={s} rank={i + 1} />)}
          </div>
          <div className="agro-disclaimer thai">
            * ความเหมาะสมไม้ยืนต้นจากโมเดล SDM (logistic regression ฝึกด้วยจุดพบจริง GBIF + ภูมิอากาศ NASA POWER) ส่วนผลผลิต/ราคา/ต้นทุนเป็นค่าประมาณการ ควรปรึกษาเกษตรอำเภอก่อนลงมือจริง
          </div>
        </section>
      )}
      </>)}

      <footer className="agro-foot thai">
        ข้อมูล: GISTDA (พื้นที่อนุรักษ์ + ลำน้ำ + Disaster Open API ไฟป่า/น้ำท่วม/ภัยแล้ง) · NASA POWER + Open-Meteo (ภูมิอากาศ/ความสูง) · GBIF (จุดพบพืช) — ต้นแบบ space tech for forest
      </footer>
    </div>
  );
}
