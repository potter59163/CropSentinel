import type { ModuleId } from '../App';
import { useData } from '../data/store';
import { riskColor, riskLabelTh } from '../lib/risk';

const titles: Record<ModuleId, { code: string; th: string; en: string; sub: string }> = {
  m1: { code: 'M01', th: 'ชั้นข้อมูลไฟอัจฉริยะ', en: 'Fire Intelligence Layer', sub: 'รู้ว่า “ตอนนี้ไฟอยู่ที่ไหน” จากดาวเทียมและเซนเซอร์อากาศ' },
  m2: { code: 'M02', th: 'เครื่องมือจำลองการลามของไฟ', en: 'Spread Simulation Engine', sub: 'รู้ว่า “ไฟจะลามไปทางไหน” จากลม ความชัน และเชื้อเพลิง' },
  m3: { code: 'M03', th: 'แพลตฟอร์มตอบสนอง', en: 'Decision & Response Platform', sub: 'รู้ว่า “ต้องทำอะไร” สำหรับเจ้าหน้าที่ อปท. และเกษตรกรข้าวโพด' },
};

export function TopBar({ module }: { module: ModuleId }) {
  const { province: P } = useData();
  const t = titles[module];
  return (
    <div className="topbar">
      <div className="topbar-title">
        <div className="topbar-heading">
          <span className="topbar-code">{t.code}</span>
          <h1 className="thai">{t.th}</h1>
        </div>
        <div className="topbar-subcopy">
          <span className="topbar-en">{t.en}</span>
          <span className="subtitle thai">{t.sub}</span>
        </div>
      </div>
      <div className="topbar-meta">
        <div className="meta-item"><span className="k thai">พื้นที่</span><span className="v thai">{P.nameTh}</span></div>
        <div className="meta-item"><span className="k thai">ความเสี่ยงไฟ</span><span className="v thai" style={{ color: riskColor[P.fireRisk] }}>{riskLabelTh[P.fireRisk]}</span></div>
        <div className="meta-item"><span className="k thai">อัปเดตล่าสุด</span><span className="v">{P.lastUpdate}</span></div>
        <span className="chip ok thai"><span className="dot" />{P.dataSource === 'LIVE' ? 'ข้อมูลจริง LIVE' : 'ข้อมูลสำรอง'}</span>
        <span className="chip data" style={{ fontSize: 11, gap: 4 }}>
          🔥 {P.totalHotspots} จุด &nbsp;·&nbsp; 💨 {Math.round(P.weather.windSpeedKmh)} กม./ชม. &nbsp;·&nbsp; PM2.5 {P.pm25}
        </span>
      </div>
    </div>
  );
}
