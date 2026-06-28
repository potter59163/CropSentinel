import type { ModuleId } from '../App';
import { useData } from '../data/store';

const items: Array<{ id: ModuleId; label: string; en: string; sub: string }> = [
  { id: 'm1', label: 'ข้อมูลไฟอัจฉริยะ', en: 'Fire Intelligence', sub: 'M01' },
  { id: 'm2', label: 'เครื่องมือจำลองไฟลาม', en: 'Spread Engine', sub: 'M02' },
  { id: 'm3', label: 'แพลตฟอร์มตอบสนอง', en: 'Response Platform', sub: 'M03' },
];
const secondary = [
  { id: 'reports', label: 'รายงาน', sub: 'PDF' },
  { id: 'models', label: 'โมเดล', sub: 'v0.2' },
  { id: 'settings', label: 'ตั้งค่า', sub: 'ADMIN' },
];

export function Sidebar({ module, setModule, onVillage }: { module: ModuleId; setModule: (m: ModuleId) => void; onVillage: () => void }) {
  const { province } = useData();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">🔥</div>
        <div>
          <div className="brand-name">CropSentinel</div>
          <div className="brand-sub thai">เชียงใหม่</div>
        </div>
      </div>

      <div className="nav-section thai">โมดูล</div>
      <div className="module-list">
        {items.map((it) => (
          <div key={it.id} className={`nav-item ${module === it.id ? 'active' : ''}`} onClick={() => setModule(it.id)}>
            <span className="nav-dot" />
            <div className="nav-label">
              <div className="thai">{it.label}</div>
              <div className="nav-en">{it.en}</div>
            </div>
            <span className="nav-sub">{it.sub}</span>
          </div>
        ))}
      </div>

      <div className="nav-section thai">พื้นที่ทำงาน</div>
      <div className="secondary-list">
        {secondary.map((it) => (
          <div key={it.id} className="nav-item" style={{ opacity: 0.6 }}>
            <span className="nav-dot" />
            <div className="nav-label thai">{it.label}</div>
            <span className="nav-sub">{it.sub}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="village-enter thai" onClick={onVillage}>
          👵 โหมดชาวบ้าน
        </button>
        <div className="status-pill thai"><span className="pulse" />ระบบพร้อมใช้งาน</div>
        <div className="thai" style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>
          ต้นแบบเฝ้าระวังไฟป่า + ข้าวโพด
          <br />อัปเดต {province.lastUpdate}
        </div>
      </div>
    </aside>
  );
}
