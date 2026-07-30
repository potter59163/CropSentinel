// CropSentinel - app shell
const { useState: useStateApp, useEffect: useEffectApp } = React;

function Sidebar({ module, setModule }) {
  const items = [
    { id: 'm1', label: 'ข้อมูลอัจฉริยะ', en: 'Data Intelligence', sub: 'M01' },
    { id: 'm2', label: 'เครื่องมือพยากรณ์', en: 'Predictive Engine', sub: 'M02' },
    { id: 'm3', label: 'แพลตฟอร์มตัดสินใจ', en: 'Decision Platform', sub: 'M03' },
  ];
  const secondary = [
    { id: 'reports', label: 'รายงาน', sub: 'PDF' },
    { id: 'models', label: 'โมเดล', sub: 'v3.2' },
    { id: 'settings', label: 'ตั้งค่า', sub: 'ADMIN' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">C</div>
        <div>
          <div className="brand-name">CropSentinel</div>
          <div className="brand-sub thai">ปทุมธานี</div>
        </div>
      </div>

      <div className="nav-section thai">โมดูล</div>
      <div className="module-list">
        {items.map((it) => (
          <div
            key={it.id}
            className={`nav-item ${module === it.id ? 'active' : ''}`}
            onClick={() => setModule(it.id)}
          >
            <span className="nav-dot" />
            <div className="nav-label">
              <div className="thai">{it.label}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                {it.en}
              </div>
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
        <div className="status-pill thai">
          <span className="pulse" />
          ระบบพร้อมใช้งาน
        </div>
        <div className="thai" style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>
          ทีมวิเคราะห์ต้นแบบ
          <br />
          อัปเดตเซสชัน {window.CS_DATA.province.lastUpdate}
        </div>
      </div>
    </aside>
  );
}

function TopBar({ module }) {
  const titles = {
    m1: {
      code: 'M01',
      th: 'ชั้นข้อมูลอัจฉริยะ',
      en: 'Data Intelligence Layer',
      sub: 'รู้ว่า “ตอนนี้เกิดอะไรขึ้น” จากดาวเทียมและข้อมูลสภาพอากาศ',
    },
    m2: {
      code: 'M02',
      th: 'เครื่องมือพยากรณ์',
      en: 'Predictive Intelligence Engine',
      sub: 'รู้ว่า “จะเกิดอะไรต่อ” จากโมเดลคาดการณ์ supply และราคา',
    },
    m3: {
      code: 'M03',
      th: 'แพลตฟอร์มตัดสินใจ',
      en: 'Decision & Visualization Platform',
      sub: 'รู้ว่า “ควรทำอะไร” สำหรับเกษตรกร อปท. และผู้ค้าปลีก',
    },
  };
  const t = titles[module];
  const D = window.CS_DATA;

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
        <div className="meta-item">
          <span className="k thai">พื้นที่</span>
          <span className="v thai">{D.province.nameTh}</span>
        </div>
        <div className="meta-item">
          <span className="k thai">พืชหลัก</span>
          <span className="v thai">{D.overview.cropLabelTh}</span>
        </div>
        <div className="meta-item">
          <span className="k thai">อัปเดตล่าสุด</span>
          <span className="v">{D.province.lastUpdate}</span>
        </div>
        <span className="chip ok thai">
          <span className="dot" />
          {D.province.dataSource === 'LIVE' ? 'ข้อมูลจริง LIVE' : 'กำลังโหลดข้อมูล…'}
        </span>
        {D.province.dataSource === 'LIVE' && (
          <span className="chip data" style={{ fontSize: 11, gap: 4 }}>
            🌧 {D.province.weekRain ?? '--'} มม./สัปดาห์ &nbsp;·&nbsp;
            🌡 {D.province.weatherTemp ?? '--'}°C &nbsp;·&nbsp;
            💨 PM2.5 {D.province.pm25}
          </span>
        )}
      </div>
    </div>
  );
}

function OverviewHero({ module, setModule, heroOpen, setHeroOpen }) {
  const D = window.CS_DATA;
  // ปริมาณข้าวที่มาถึงในช่วงหนาแน่นที่สุด เกินกำลังรับซื้อในพื้นที่ไปเท่าไร
  // (เดิมคำนวณเป็น "ส่วนขาด" ซึ่งกลับทิศกับสถานการณ์จริงของปทุมธานี)
  const peakIdx = D.supply.peakWindowIndex ?? D.supply.projected.indexOf(Math.max(...D.supply.projected));
  const gluttAtPeak = Math.max(0, Math.round((D.supply.projected[peakIdx] - D.supply.demand[peakIdx]) * 10) / 10);

  const riskColor = { LOW: 'var(--ok)', MEDIUM: 'var(--warn)', HIGH: 'var(--risk)', CRITICAL: 'var(--crit)' };

  // ── always-visible compact strip ──────────────────────────────────────────
  const strip = (
    <div
      className="hero-strip"
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-1)', borderBottom: '1px solid var(--line)',
        padding: '7px 18px', cursor: 'pointer', userSelect: 'none',
      }}
      onClick={() => setHeroOpen(o => !o)}
      title={heroOpen ? 'พับ overview' : 'ขยาย overview'}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.12em', marginRight: 16, whiteSpace: 'nowrap' }}>
        PROTOTYPE OVERVIEW
      </span>
      <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
        {[
          ['Supply', `${D.supply.current} K ตัน`],
          ['ล้นเกินช่วงพีค', `${gluttAtPeak.toFixed(1)} K ตัน`],
          ['ราคาปัจจุบัน', `฿${D.price.actual[0].toLocaleString()}`],
          ['NDVI', D.province.avgNDVI.toFixed(2)],
          ['Flood Risk', D.province.floodRisk, riskColor[D.province.floodRisk]],
          ['Drought', D.province.droughtRisk, riskColor[D.province.droughtRisk]],
          ['PM2.5', `${D.province.pm25} μg/m³`],
        ].map(([k, v, c]) => (
          <span key={k} style={{ fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--fg-3)', marginRight: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{k}</span>
            <strong style={{ color: c || 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}>{v}</strong>
          </span>
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginLeft: 12 }}>
        {heroOpen ? '▲' : '▼'}
      </span>
    </div>
  );

  if (!heroOpen) return strip;

  // ── full expanded hero ────────────────────────────────────────────────────
  const modules = [
    { id: 'm1', code: 'M01', title: 'ข้อมูลอัจฉริยะ', desc: 'จับสัญญาณ NDVI พื้นที่เสี่ยงน้ำท่วม และสภาพ supply ปัจจุบัน' },
    { id: 'm2', code: 'M02', title: 'คาดการณ์ล่วงหน้า', desc: 'คำนวณแนวโน้มขาดแคลน ราคาผันผวน และ early warning ก่อนวิกฤต' },
    { id: 'm3', code: 'M03', title: 'คำแนะนำเชิงปฏิบัติ', desc: 'แปลข้อมูลให้เป็น action สำหรับเกษตรกร อปท. และผู้ค้าปลีก' },
  ];

  return (
    <section className="overview-hero">
      {strip}
      <div className="overview-hero-main">
        <div className="overview-copy">
          <div className="overview-kicker thai">Climate Change & Sustainable Innovation · Prototype Overview</div>
          <div className="overview-problem thai">Pathum Thani Rice Risk Console</div>
          <h2 className="thai">เห็นความเสี่ยงข้าวล่วงหน้า ก่อน supply สะดุดและเกษตรกรขาดรายได้</h2>
          <div className="overview-proof">
            <div className="overview-proof-item">
              <span className="value">{D.supply.current}</span>
              <span className="label thai">พันตันอุปทานปัจจุบัน</span>
            </div>
            <div className="overview-proof-item">
              <span className="value">{gluttAtPeak.toFixed(1)}</span>
              <span className="label thai">พันตัน gap ท้ายช่วงคาดการณ์</span>
            </div>
            <div className="overview-proof-item">
              <span className="value">{D.overview.shortageWarningWeeks}</span>
              <span className="label thai">สัปดาห์ก่อนความเสี่ยงขาดแคลน</span>
            </div>
          </div>
          <p className="thai">
            ปัญหาหลักของพื้นที่นำร่องคือ น้ำท่วมซ้ำซากและ climate change ทำให้ผลผลิตไม่แน่นอน ระบบนี้เชื่อม satellite,
            climate data และ AI forecasting เพื่อบอกว่า ตอนนี้เกิดอะไรขึ้น จะเกิดอะไรต่อ และควรทำอะไรทันที
          </p>
          <div className="overview-tags">
            <span className="chip data thai"><span className="dot" />จังหวัดนำร่อง {D.province.nameTh}</span>
            <span className="chip warn thai"><span className="dot" />พืชหลัก {D.overview.cropLabelTh}</span>
            <span className="chip risk thai"><span className="dot" />เตือนความเสี่ยงขาดแคลนใน {D.overview.shortageWarningWeeks} สัปดาห์</span>
          </div>
        </div>

        <div className="overview-metrics">
          <div className="overview-stat"><span className="label thai">พื้นที่นาข้าว</span><strong>{(D.province.totalFarmland / 1_000_000).toFixed(1)} ล้านไร่</strong></div>
          <div className="overview-stat"><span className="label thai">NDVI ปัจจุบัน</span><strong>{D.province.avgNDVI.toFixed(2)}</strong></div>
          <div className="overview-stat"><span className="label thai">Supply ปัจจุบัน</span><strong>{D.supply.current.toLocaleString()} พันตัน</strong></div>
          <div className="overview-stat"><span className="label thai">ราคาข้าวล่าสุด</span><strong>฿{D.price.actual[0].toLocaleString()}</strong></div>
          <div className="overview-stat"><span className="label thai">Flood Risk</span><strong style={{ color: riskColor[D.province.floodRisk] }}>{D.province.floodRisk}</strong></div>
          <div className="overview-stat"><span className="label thai">Drought Risk</span><strong style={{ color: riskColor[D.province.droughtRisk] }}>{D.province.droughtRisk}</strong></div>
          <div className="overview-stat"><span className="label thai">ล้นเกินกำลังรับซื้อช่วงพีค</span><strong>{gluttAtPeak.toFixed(1)} พันตัน</strong></div>
        </div>
      </div>

      <div className="overview-flow">
        {modules.map((item) => (
          <button key={item.id} type="button" className={`flow-card ${module === item.id ? 'active' : ''}`} onClick={() => { setModule(item.id); setHeroOpen(false); }}>
            <span className="flow-code">{item.code}</span>
            <div className="flow-title thai">{item.title}</div>
            <div className="flow-desc thai">{item.desc}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [module, setModule] = useStateApp(() => localStorage.getItem('cs_mod') || 'm1');
  const [heroOpen, setHeroOpen] = useStateApp(false);   // collapsed by default → module fills viewport
  // dataVersion increments when real API data arrives → forces re-render of all children
  const [dataVersion, setDataVersion] = useStateApp(0);

  useEffectApp(() => {
    localStorage.setItem('cs_mod', module);
  }, [module]);

  useEffectApp(() => {
    // If api-fetch.js already finished before React mounted, refresh immediately
    if (window.CS_DATA_LOADED && dataVersion === 0) {
      setDataVersion(1);
      return;
    }
    const handler = () => setDataVersion(v => v + 1);
    window.addEventListener('cs-data-ready', handler);
    return () => window.removeEventListener('cs-data-ready', handler);
  }, []);

  let view = null;
  if (module === 'm1') view = <window.Module1 key={dataVersion} />;
  if (module === 'm2') view = <window.Module2 key={dataVersion} />;
  if (module === 'm3') view = <window.Module3 key={dataVersion} />;

  return (
    <div className="app">
      <Sidebar module={module} setModule={setModule} />
      <main
        className="main"
        data-screen-label={
          module === 'm1' ? '01 Data Intelligence' : module === 'm2' ? '02 Predictive Engine' : '03 Decision Platform'
        }
      >
        <TopBar module={module} />
        <div className="content">
          <OverviewHero module={module} setModule={setModule} heroOpen={heroOpen} setHeroOpen={setHeroOpen} />
          {view}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
