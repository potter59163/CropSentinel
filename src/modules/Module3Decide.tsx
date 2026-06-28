import { useEffect, useState } from 'react';
import { useData } from '../data/store';
import type { Recommendation, RiskLevel } from '../data/types';
import { Card } from '../components/ui';
import { riskColor, riskLabelTh } from '../lib/risk';
import { compass, compassTh } from '../lib/geo';
import { nf0 } from '../lib/format';

type Tab = 'firefighter' | 'lgu' | 'farmer';

function RecCard({ r }: { r: Recommendation }) {
  return (
    <div className={`rec ${r.urgency}`}>
      <div className="rec-icon">{r.icon}</div>
      <div className="rec-body">
        <div className="rec-title thai">{r.title}</div>
        <div className="rec-desc thai">{r.desc}</div>
        <div className="rec-meta thai">{r.meta.map((m) => <span key={m}>· {m}</span>)}</div>
      </div>
    </div>
  );
}

function RiskIndicator({ level }: { level: RiskLevel }) {
  const idx = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[level];
  const note = { LOW: 'ดำเนินงานตามปกติ', MEDIUM: 'เฝ้าระวังอย่างใกล้ชิด', HIGH: 'ต้องดำเนินการภายใน 24 ชม.', CRITICAL: 'ต้องดำเนินการทันที' }[level];
  return (
    <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
      <div className="thai" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>ระดับความเสี่ยงไฟ</div>
      <div className="row" style={{ gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: 8, borderRadius: 2, background: i <= idx ? riskColor[level] : 'var(--bg-3)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div className="thai" style={{ marginTop: 10, fontSize: 20, fontWeight: 600, color: riskColor[level] }}>{riskLabelTh[level]}</div>
      <div className="thai" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{note}</div>
    </div>
  );
}

function DecisionTimeline({ tab }: { tab: Tab }) {
  const events: Record<Tab, Array<{ h: string; t: string; k: string }>> = {
    firefighter: [
      { h: '0–1 ชม.', t: 'ยืนยันจุดต้นไฟจากภาพ VIIRS + วางจุดบัญชาการเหนือลม', k: 'urgent' },
      { h: '1–2 ชม.', t: 'ตัดแนวกันไฟด้านข้างไฟ (flank) ห้ามเข้าหัวไฟ', k: 'urgent' },
      { h: '2–4 ชม.', t: 'สกัดไฟบนสันเขา ก่อนไฟวิ่งขึ้นร่องเขา', k: 'soft' },
      { h: '4–6 ชม.', t: 'ตรวจ FRP รอบถัดไปยืนยันการควบคุม', k: 'soft' },
      { h: 'กลางคืน', t: 'เฝ้าระวังลมเปลี่ยนทิศ + ไฟปะทุซ้ำ', k: 'good' },
    ],
    lgu: [
      { h: 'วันนี้', t: 'ประกาศห้ามเผา + เปิดศูนย์บัญชาการเหตุการณ์', k: 'urgent' },
      { h: '24 ชม.', t: 'ระดมชุดดับไฟ อปท. + อาสาสมัครเข้าพื้นที่เสี่ยง', k: 'urgent' },
      { h: 'สัปดาห์นี้', t: 'เปิดห้องปลอดฝุ่น + แจ้งเตือนสุขภาพ PM2.5', k: 'soft' },
      { h: 'ฤดูถัดไป', t: 'ตรวจสอบการบุกรุกป่าจากภาพดาวเทียมรายปี', k: 'soft' },
      { h: 'ระยะยาว', t: 'ส่งเสริมเปลี่ยนข้าวโพดเป็นพืชไม่ต้องเผา', k: 'good' },
    ],
    farmer: [
      { h: 'ก่อนเผา', t: 'ลงทะเบียนรับเตือนลม/จุดความร้อนผ่าน LINE', k: 'soft' },
      { h: 'เก็บเกี่ยว', t: 'ไถกลบ/อัดก้อนตอซังแทนการเผา', k: 'urgent' },
      { h: 'รอบแปลง', t: 'ทำแนวกันไฟ 8–10 ม. รอบแปลงติดป่า', k: 'soft' },
      { h: 'หน้าฝน', t: 'ปลูกพืชคลุมดินฟื้นฟูพื้นที่ลาดชัน', k: 'good' },
      { h: 'ระยะยาว', t: 'เข้าร่วมตลาดคาร์บอนเครดิต/ฟางอัดก้อน', k: 'good' },
    ],
  };
  return (
    <div style={{ position: 'relative', paddingLeft: 8 }}>
      <div style={{ position: 'absolute', left: 14, top: 12, bottom: 12, width: 1, background: 'var(--line)' }} />
      {events[tab].map((e, i) => (
        <div key={i} className="row" style={{ gap: 14, padding: '8px 0', alignItems: 'flex-start' }}>
          <div style={{ width: 13, height: 13, borderRadius: '50%', marginTop: 2, flexShrink: 0, background: e.k === 'urgent' ? 'var(--risk)' : e.k === 'good' ? 'var(--ok)' : 'var(--warn)', boxShadow: '0 0 0 3px var(--bg-1)', zIndex: 1 }} />
          <div style={{ width: 64, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', flexShrink: 0, paddingTop: 2 }}>{e.h}</div>
          <div className="thai" style={{ fontSize: 12, color: 'var(--fg-1)', paddingTop: 1 }}>{e.t}</div>
        </div>
      ))}
    </div>
  );
}

const tabs: Array<{ id: Tab; th: string; role: string }> = [
  { id: 'firefighter', th: 'เจ้าหน้าที่ดับไฟ', role: 'ภาคสนาม' },
  { id: 'lgu', th: 'อปท./รัฐบาล', role: 'นโยบาย' },
  { id: 'farmer', th: 'เกษตรกรข้าวโพด', role: 'ต้นเหตุ/ป้องกัน' },
];

const publishTargets: Record<Tab, { title: string; detail: string }> = {
  firefighter: { title: 'ส่งแผนปฏิบัติการดับไฟแล้ว', detail: 'ส่งพิกัดหัวไฟ ทิศลม และแนวสกัดให้ชุดดับไฟ 6 ชุดและศูนย์บัญชาการ' },
  lgu: { title: 'ส่งคำสั่งห้ามเผาให้หน่วยงานแล้ว', detail: 'แจ้ง อปท. 14 อำเภอ และศูนย์ป้องกันภัยเพื่อบังคับใช้ช่วงห้ามเผา' },
  farmer: { title: 'ปล่อยคำแนะนำถึงเกษตรกรแล้ว', detail: 'ส่งผ่าน LINE/SMS ถึงเครือข่ายเกษตรกรข้าวโพดเรื่องงดเผาและแนวกันไฟ' },
};

export function Module3Decide() {
  const { province: P, sim, recommendations } = useData();
  const [tab, setTab] = useState<Tab>('firefighter');
  const [feedback, setFeedback] = useState<{ title: string; detail: string; at: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3600);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const publish = () => {
    const at = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    setFeedback({ ...publishTargets[tab], at });
  };

  const ctx: Record<Tab, { title: string; titleEn: string; kpis: Array<{ k: string; v: string; u: string }> }> = {
    firefighter: {
      title: 'แผนปฏิบัติการดับไฟ', titleEn: 'Firefighter operations',
      kpis: [
        { k: 'ความเร็วหัวไฟ', v: `${Math.round(sim.rosHead)}`, u: 'ม./นาที' },
        { k: 'ทิศหัวไฟ', v: `${Math.round(sim.bearingDeg)}°`, u: compass(sim.bearingDeg) },
        { k: 'พื้นที่เสี่ยง', v: nf0(sim.finalAreaRai), u: 'ไร่' },
      ],
    },
    lgu: {
      title: 'นโยบายและการสั่งการ', titleEn: 'Policy & command',
      kpis: [
        { k: 'จุดความร้อน', v: `${P.totalHotspots}`, u: 'จุด' },
        { k: 'PM2.5', v: `${P.pm25}`, u: 'μg/m³' },
        { k: 'บุกรุกป่า', v: nf0(P.totalEncroachmentRai), u: 'ไร่' },
      ],
    },
    farmer: {
      title: 'คำแนะนำสำหรับเกษตรกรข้าวโพด', titleEn: 'Maize farmer advisory',
      kpis: [
        { k: 'พื้นที่ข้าวโพด', v: `${nf0(Math.round(P.totalMaizeRai / 1000))}k`, u: 'ไร่' },
        { k: 'ความแห้ง', v: `${Math.round(P.avgDryness * 100)}`, u: '%' },
        { k: 'ลม', v: `${P.weather.windSpeedKmh}`, u: 'กม./ชม.' },
      ],
    },
  };

  const c = ctx[tab];
  const recs = recommendations[tab];

  const actionMatrix = [
    { role: 'เจ้าหน้าที่ดับไฟ', roleEn: 'Field Suppression', action: `ตัดแนวกันไฟด้านหัวไฟทิศ ${Math.round(sim.bearingDeg)}° ที่${sim.originLabelTh}`, eta: 'ภายใน 1 ชม.', tone: 'risk' },
    { role: 'อปท./รัฐบาล', roleEn: 'Policy Command', action: `ประกาศห้ามเผาและเปิดศูนย์บัญชาการ — ความเสี่ยง ${riskLabelTh[P.fireRisk]}`, eta: 'วันนี้', tone: 'urgent' },
    { role: 'เกษตรกรข้าวโพด', roleEn: 'Source Prevention', action: 'งดเผาตอซัง เปลี่ยนเป็นไถกลบ/อัดก้อน + ทำแนวกันไฟ', eta: 'ก่อนรอบเผา', tone: 'warn' },
  ];

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <span className="thai">{t.th}</span><span className="role">{t.role}</span>
          </button>
        ))}
      </div>

      <div className="decision-overview card">
        <div className="card-h">
          <h3>Real-time Response Dashboard <span className="card-en">Actionable Insight</span></h3>
          <span className="sub thai">ข้อมูล → พยากรณ์ → ตัดสินใจ</span>
        </div>
        <div className="rt-grid">
          <div className="rt-card">
            <div className="rt-label">FIRE RISK</div>
            <div className={`rt-value risk-${P.fireRisk.toLowerCase()}`}>{riskLabelTh[P.fireRisk]}</div>
            <div className="rt-desc thai">{P.totalHotspots} จุดความร้อน · ความแห้ง {Math.round(P.avgDryness * 100)}%</div>
          </div>
          <div className="rt-card">
            <div className="rt-label">HEAD FIRE</div>
            <div className="rt-value">{Math.round(sim.rosHead)}<span> ม./นาที</span></div>
            <div className="rt-desc thai">ลามทาง{compassTh[compass(sim.bearingDeg)]} · ~{nf0(sim.finalAreaRai)} ไร่/{sim.horizonH} ชม.</div>
          </div>
          <div className="rt-card">
            <div className="rt-head"><div className="rt-label">PM2.5</div><div className="rt-badge">{P.pm25 > 90 ? 'อันตราย' : 'สูง'}</div></div>
            <div className="rt-value">{P.pm25}<span> μg/m³</span></div>
            <div className="rt-desc thai">หมอกควันจากไฟป่า + เผาตอซังข้าวโพด</div>
          </div>
        </div>
        <div className="flow-banner thai">Data → Prediction → Decision</div>
        <div className="flow-map">
          {[
            { l: 'Data Layer', e: 'รู้ว่า “ไฟอยู่ที่ไหน”', d: 'VIIRS hotspot · ความแห้ง · ลม · ข้าวโพด · DEM' },
            { l: 'AI Layer', e: 'รู้ว่า “ไฟจะไปทางไหน”', d: 'จำลอง ROS + ทิศลาม + พยากรณ์ PM2.5' },
            { l: 'Decision Layer', e: 'รู้ว่า “ต้องทำอะไร”', d: 'Action รายกลุ่มแบบเรียลไทม์' },
          ].map((item, i) => (
            <div key={item.l} className="flow-node">
              <div className="flow-node-layer">{i + 1}. {item.l}</div>
              <div className="flow-node-title thai">{item.e}</div>
              <div className="flow-node-detail">{item.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="action-matrix">
        {actionMatrix.map((item) => (
          <div key={item.role} className={`action-card ${item.tone}`}>
            <div className="action-role thai">{item.role}</div>
            <div className="action-role-en">{item.roleEn}</div>
            <div className="action-text thai">{item.action}</div>
            <div className="action-eta thai">{item.eta}</div>
          </div>
        ))}
      </div>

      <div className="grid mod3-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="row space-between" style={{ alignItems: 'baseline' }}>
            <div>
              <h3 className="thai" style={{ margin: 0, fontSize: 17, color: 'var(--fg-0)', fontWeight: 600 }}>{c.title}</h3>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{c.titleEn}</div>
            </div>
            <span className="chip data thai"><span className="dot" />{recs.length} รายการ</span>
          </div>

          <div className="grid grid-3">
            {c.kpis.map((k) => (
              <div key={k.k} className="stat">
                <div className="stat-label thai">{k.k}</div>
                <div className="stat-value">{k.v}<span className="unit thai">{k.u}</span></div>
              </div>
            ))}
          </div>

          <div>{recs.map((r, i) => <RecCard key={i} r={r} />)}</div>

          <Card title="ลำดับการดำเนินงาน" titleEn="Decision timeline" right={<span className="sub thai">ไทม์ไลน์</span>}>
            <DecisionTimeline tab={tab} />
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RiskIndicator level={P.fireRisk} />

          <Card title="ปัจจัยที่ส่งผล" titleEn="Contributing factors" right={<span className="sub">ถ่วงน้ำหนัก</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['ลมแรง/ทิศลม', Math.min(1, sim.drivers.wind / 4), 'var(--risk)'],
                ['ความชันภูเขา', Math.min(1, (sim.drivers.slope - 1) / 1.7), 'var(--warn)'],
                ['เชื้อเพลิงใบไม้แห้ง', Math.min(1, (sim.drivers.fuel - 0.55) / 0.9), 'oklch(0.72 0.16 70)'],
                ['ความแห้งสะสม', Math.min(1, (sim.drivers.dryness - 0.6) / 0.9), 'oklch(0.6 0.18 330)'],
                ['การเผาตอซังข้าวโพด', 0.62, 'var(--data)'],
              ].map(([n, v, cc]) => (
                <div key={n as string}>
                  <div className="row space-between" style={{ marginBottom: 4 }}>
                    <span className="thai" style={{ fontSize: 12 }}>{n}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{Math.round((v as number) * 100)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(v as number) * 100}%`, background: cc as string }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="การประสานงาน" titleEn="Coordination" right={<span className="sub">สด</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                ['ศูนย์ดับไฟป่าเชียงใหม่', 'เชื่อมต่อ', 'ok'],
                ['อบจ. เชียงใหม่', 'รอแจ้ง', 'warn'],
                ['อุทยานฯ/เขตรักษาพันธุ์', 'เชื่อมต่อ', 'ok'],
                ['เครือข่ายอาสาดับไฟ', 'ตอบรับ 4/6', 'warn'],
              ].map(([k, v, s]) => (
                <div key={k} className="row space-between">
                  <span className="thai">{k}</span>
                  <span className={`chip ${s} thai`}><span className="dot" />{v}</span>
                </div>
              ))}
            </div>
            {feedback && (
              <div className="publish-feedback" role="status" aria-live="polite">
                <div className="publish-feedback-title thai">{feedback.title}</div>
                <div className="publish-feedback-desc thai">{feedback.detail}</div>
                <div className="publish-feedback-meta">PUBLISHED {feedback.at}</div>
              </div>
            )}
            <button type="button" className="btn primary thai" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={publish}>
              {feedback ? 'เผยแพร่แล้ว' : 'เผยแพร่คำแนะนำ →'}
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
