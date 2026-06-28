import type { ModuleId } from '../App';
import { useData } from '../data/store';
import { riskColor, riskLabelTh } from '../lib/risk';
import { nf0 } from '../lib/format';

export function OverviewStrip({ module, setModule, heroOpen, setHeroOpen }: {
  module: ModuleId; setModule: (m: ModuleId) => void; heroOpen: boolean; setHeroOpen: (f: (o: boolean) => boolean) => void;
}) {
  const { province: P, sim } = useData();

  const cells: Array<[string, string, string?]> = [
    ['Hotspots', `${P.totalHotspots} จุด`],
    ['Fire Risk', riskLabelTh[P.fireRisk], riskColor[P.fireRisk]],
    ['ROS', `${Math.round(sim.rosHead)} ม./นาที`, 'var(--risk)'],
    ['ลาม 6 ชม.', `${nf0(sim.finalAreaRai)} ไร่`],
    ['NDVI', P.avgNdvi.toFixed(2)],
    ['ความแห้ง', `${Math.round(P.avgDryness * 100)}%`, 'var(--warn)'],
    ['PM2.5', `${P.pm25} μg/m³`, P.pm25 > 90 ? 'var(--crit)' : undefined],
  ];

  const strip = (
    <div className="hero-strip" onClick={() => setHeroOpen((o) => !o)} title={heroOpen ? 'พับ' : 'ขยาย'}>
      <span className="hero-strip-tag">PROTOTYPE OVERVIEW</span>
      <div className="hero-strip-cells">
        {cells.map(([k, v, c]) => (
          <span key={k} className="hero-cell">
            <span className="hero-cell-k">{k}</span>
            <strong className="hero-cell-v" style={{ color: c || 'var(--fg-0)' }}>{v}</strong>
          </span>
        ))}
      </div>
      <span className="hero-chevron">{heroOpen ? '▲' : '▼'}</span>
    </div>
  );

  if (!heroOpen) return strip;

  const modules: Array<{ id: ModuleId; code: string; title: string; desc: string }> = [
    { id: 'm1', code: 'M01', title: 'ข้อมูลไฟอัจฉริยะ', desc: 'จุดความร้อน VIIRS, ความแห้งของป่า, พื้นที่ข้าวโพด และ burn scar บนแผนที่จริง' },
    { id: 'm2', code: 'M02', title: 'จำลองไฟลาม', desc: 'คำนวณทิศและความเร็วการลามจากลม ความชัน เชื้อเพลิง พร้อมพยากรณ์ PM2.5' },
    { id: 'm3', code: 'M03', title: 'คำแนะนำเชิงปฏิบัติ', desc: 'แปลงข้อมูลเป็น action สำหรับเจ้าหน้าที่ดับไฟ อปท. และเกษตรกรข้าวโพด' },
  ];

  return (
    <section className="overview-hero">
      {strip}
      <div className="overview-hero-main">
        <div className="overview-copy">
          <div className="overview-kicker thai">Space Technology · Wildfire & Maize Risk · Prototype Overview</div>
          <div className="overview-problem thai">Chiang Mai Wildfire Risk Console</div>
          <h2 className="thai">เห็นไฟป่าล่วงหน้า รู้ทิศที่ไฟจะลาม ก่อนเจ้าหน้าที่ต้องเสี่ยงเข้าไปในร่องเขา</h2>
          <div className="overview-proof">
            <div className="overview-proof-item"><span className="value" style={{ color: 'var(--risk)' }}>{P.totalHotspots}</span><span className="label thai">จุดความร้อนตรวจพบ</span></div>
            <div className="overview-proof-item"><span className="value">{Math.round(sim.rosHead)}</span><span className="label thai">ม./นาที ความเร็วหัวไฟ</span></div>
            <div className="overview-proof-item"><span className="value">{nf0(sim.finalAreaRai)}</span><span className="label thai">ไร่ที่อาจไหม้ใน {sim.horizonH} ชม.</span></div>
          </div>
          <p className="thai">
            ภูมิประเทศแอ่งกระทะและภูเขาสูงชันของเชียงใหม่ทำให้เจ้าหน้าที่เข้าถึงไฟได้ยากและล่าช้า ระบบนี้เชื่อม satellite hotspot,
            ข้อมูลลม/ความชัน และโมเดลจำลองการลาม เพื่อบอกว่า ไฟอยู่ที่ไหน จะลามไปทางไหน และต้องตัดแนวกันไฟตรงจุดใด — โดยมีการเผาตอซังข้าวโพดเป็นต้นเหตุหลักที่ต้องจัดการ
          </p>
          <div className="overview-tags">
            <span className="chip data thai"><span className="dot" />จังหวัดนำร่อง {P.nameTh}</span>
            <span className="chip warn thai"><span className="dot" />ข้าวโพด {nf0(Math.round(P.totalMaizeRai / 1000))}k ไร่</span>
            <span className="chip risk thai"><span className="dot" />ความเสี่ยงไฟ {riskLabelTh[P.fireRisk]}</span>
          </div>
        </div>
        <div className="overview-metrics">
          <div className="overview-stat"><span className="label thai">พื้นที่ป่า</span><strong>{nf0(Math.round(P.totalForestRai / 1000))}k ไร่</strong></div>
          <div className="overview-stat"><span className="label thai">NDVI เฉลี่ย</span><strong>{P.avgNdvi.toFixed(2)}</strong></div>
          <div className="overview-stat"><span className="label thai">FRP รวม</span><strong>{nf0(P.totalFrp)} MW</strong></div>
          <div className="overview-stat"><span className="label thai">burn scar (ประมาณ)</span><strong>{nf0(P.burnedScarRai)} ไร่</strong></div>
          <div className="overview-stat"><span className="label thai">บุกรุกป่า</span><strong>{nf0(P.totalEncroachmentRai)} ไร่</strong></div>
          <div className="overview-stat"><span className="label thai">PM2.5</span><strong style={{ color: P.pm25 > 90 ? 'var(--crit)' : 'var(--warn)' }}>{P.pm25}</strong></div>
        </div>
      </div>
      <div className="overview-flow">
        {modules.map((item) => (
          <button key={item.id} type="button" className={`flow-card ${module === item.id ? 'active' : ''}`} onClick={() => { setModule(item.id); setHeroOpen(() => false); }}>
            <span className="flow-code">{item.code}</span>
            <div className="flow-title thai">{item.title}</div>
            <div className="flow-desc thai">{item.desc}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
