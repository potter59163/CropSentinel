import { useState } from 'react';
import type { FarmInput, SystemPlan } from './data/types';
import { buildSystems } from './lib/engine';
import { fetchClimate, type Climate } from './lib/climate';
import { checkProtected, type ProtectedArea } from './lib/gistda';
import { satContext, type SatContext } from './lib/satellite';
import { modelMeta } from './lib/suitability';
import { InputForm } from './components/InputForm';
import { ResultPlan } from './components/ResultPlan';
import { Methodology } from './components/Methodology';

const DEFAULT_INPUT: FarmInput = {
  currentCropId: 'ข้าวโพดเลี้ยงสัตว์', sizeRai: 10, elevationM: 420,
  locationLabel: 'ปัว', lat: 19.179, lng: 100.907, selectedCanopyIds: [], goal: 'balanced',
};

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
            <div className="agro-brand-name">วนเกษตรน่าน <span className="agro-brand-en">Nan Agroforestry Planner</span></div>
            <div className="agro-brand-sub thai">ออกแบบระบบวนเกษตรหลายชั้น จากข้อมูลดาวเทียม GISTDA + โมเดล AI</div>
          </div>
        </div>
        <div className="agro-nav">
          <button className={tab === 'planner' ? 'on' : ''} onClick={() => setTab('planner')}>แพลนเนอร์</button>
          <button className={tab === 'method' ? 'on' : ''} onClick={() => setTab('method')}>วิธีการ &amp; ความน่าเชื่อถือ</button>
        </div>
        <span className="chip data thai"><span className="dot" />SDM {mm.count} ชนิด · AUC เฉลี่ย {mm.avgAuc.toFixed(2)}</span>
      </header>

      {tab === 'method' && <Methodology />}

      {tab === 'planner' && (<>
      <div className="agro-intro thai">
        ระบบออกแบบ <strong>วนเกษตร 4 ชั้น</strong> (ไม้ยืนต้น ≥2 · ไม้พุ่ม · ไม้คลุมดิน · ไม้ลงดิน) ให้เหมาะกับแปลงของคุณ —
        วิเคราะห์ <strong>ความเหมาะสมจากภูมิอากาศจริง</strong> (โมเดล SDM ฝึกด้วย GBIF + NASA POWER), ตรวจ <strong>พื้นที่อนุรักษ์จาก GISTDA</strong>,
        แล้วคำนวณ <strong>ผลผลิต · ราคา · กำไร</strong> เสนอ 3 แบบ (อันดับ 1 = ดีที่สุด)
      </div>

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
        ข้อมูล: GISTDA (พื้นที่อนุรักษ์) · NASA POWER + Open-Meteo (ภูมิอากาศ/ความสูง) · GBIF (จุดพบพืช) — ต้นแบบ space tech for forest
      </footer>
    </div>
  );
}
