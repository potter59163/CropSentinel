// Module 3 - Decision & Visualization Platform
const { useState: useState3, useEffect: useEffect3 } = React;

function PriceTrendMini({ values }) {
  const w = 300;
  const h = 92;
  const pad = 8;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);

  const points = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (values.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const area = `${line} L ${points[points.length - 1][0]} ${h - pad} L ${points[0][0]} ${h - pad} Z`;

  return (
    <svg className="price-mini" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Price trend over 8 weeks">
      <path d={area} fill="url(#priceAreaFill)" opacity="0.65" />
      <path d={line} fill="none" stroke="var(--risk)" strokeWidth="2.4" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={i === points.length - 1 ? 4 : 2.6}
          fill={i === points.length - 1 ? 'var(--risk)' : 'oklch(0.72 0.19 30 / 0.45)'}
        />
      ))}
      <defs>
        <linearGradient id="priceAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.19 30 / 0.35)" />
          <stop offset="100%" stopColor="oklch(0.72 0.19 30 / 0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Gauge({ value, max = 100 }) {
  const r = 60;
  const circ = Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const dash = pct * circ;
  const color = pct < 0.35 ? 'var(--risk)' : pct < 0.6 ? 'var(--warn)' : 'var(--ok)';
  return (
    <svg className="gauge-svg" width="160" height="100" viewBox="0 0 160 100">
      <path d={`M 20 90 A ${r} ${r} 0 0 1 140 90`} fill="none" stroke="var(--bg-3)" strokeWidth="12" strokeLinecap="round" />
      <path
        d={`M 20 90 A ${r} ${r} 0 0 1 140 90`}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s, stroke 0.3s' }}
      />
      <text x="80" y="70" textAnchor="middle" fontSize="26" fontFamily="var(--font-mono)" fontWeight="600" fill="var(--fg-0)">
        {value}
      </text>
      <text x="80" y="86" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--fg-3)" letterSpacing="0.1em">
        % ที่รับซื้อได้
      </text>
    </svg>
  );
}

function RiskIndicator({ level }) {
  const map = {
    LOW: { c: 'var(--ok)', i: 1 },
    MEDIUM: { c: 'var(--warn)', i: 2 },
    HIGH: { c: 'var(--risk)', i: 3 },
    CRITICAL: { c: 'var(--crit)', i: 4 },
  };
  const m = map[level];
  const labelTh = { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', CRITICAL: 'วิกฤติ' };

  return (
    <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
      <div className="thai" style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8 }}>
        ระดับความเสี่ยง
      </div>
      <div className="row" style={{ gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 2,
              background: i <= m.i ? m.c : 'var(--bg-3)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      <div className="thai" style={{ marginTop: 10, fontSize: 20, fontWeight: 600, color: m.c, letterSpacing: '-0.01em' }}>
        {labelTh[level]}
      </div>
      <div className="thai" style={{ fontSize: 12, color: 'var(--fg-2)' }}>
        {level === 'HIGH' && 'ต้องดำเนินการภายใน 7 วัน'}
        {level === 'CRITICAL' && 'ต้องดำเนินการทันที'}
        {level === 'MEDIUM' && 'เฝ้าระวังอย่างใกล้ชิด'}
        {level === 'LOW' && 'ดำเนินงานตามปกติ'}
      </div>
    </div>
  );
}

function RecCard({ r }) {
  return (
    <div className={`rec ${r.urgency}`}>
      <div className="rec-icon">{r.icon}</div>
      <div className="rec-body">
        <div className="rec-title thai">{r.title}</div>
        <div className="rec-desc thai">{r.desc}</div>
        <div className="rec-meta thai" style={{ fontFamily: 'var(--font-thai)' }}>
          {r.meta.map((m) => (
            <span key={m}>· {m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Module3() {
  const D = window.CS_DATA;
  const [tab, setTab] = useState3('farmer');
  const [publishFeedback, setPublishFeedback] = useState3(null);
  const tabs = [
    { id: 'farmer', th: 'เกษตรกร', role: 'ภาคสนาม' },
    { id: 'lgu', th: 'อปท./รัฐบาล', role: 'นโยบาย' },
    { id: 'retailer', th: 'ผู้ค้าปลีก/โลจิสติกส์', role: 'การค้า/กระจายสินค้า' },
  ];

  const lastWeekIndex     = D.supply.projected.length - 1;
  const currentSupply     = D.supply.current;
  // ปัญหาคือผลผลิตล้นเกินกำลังรับซื้อในช่วงที่ข้าวออกพร้อมกัน ไม่ใช่ขาดแคลน
  const peakIdx           = D.supply.peakWindowIndex ?? lastWeekIndex;
  const gluttAtPeak       = Math.max(0, Math.round((D.supply.projected[peakIdx] - D.supply.demand[peakIdx]) * 10) / 10);
  const supplyLevel       = Math.min(100, D.supply.readiness);                // % capped at 100
  const riskRank         = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const floodRiskLevel   = D.province.floodRisk;
  const droughtRiskLevel = D.province.droughtRisk ?? 'LOW';
  const riskLevel        = riskRank[droughtRiskLevel] > riskRank[floodRiskLevel] ? droughtRiskLevel : floodRiskLevel;
  const leadingRiskLabel = riskRank[droughtRiskLevel] > riskRank[floodRiskLevel] ? 'ภัยแล้ง' : 'น้ำท่วม';
  const priceStart        = D.price.actual[0];
  const priceNow          = D.price.actual[D.price.actual.length - 1];
  const priceDeltaPct     = Math.round(((priceNow - priceStart) / priceStart) * 1000) / 10;
  const flowSummary = [
    { layer: 'Data Layer', explain: 'รู้ว่า "ตอนนี้เกิดอะไรขึ้น"', detail: 'Satellite + NDVI + flood + drought + PM2.5' },
    { layer: 'AI Layer', explain: 'รู้ว่า "จะเกิดอะไรต่อ"', detail: 'ปฏิทินเก็บเกี่ยวจากดาวเทียม + ฉากทัศน์ราคา' },
    { layer: 'Decision Layer', explain: 'รู้ว่า "ควรทำอะไร"', detail: 'Action plan รายกลุ่มเป้าหมายแบบเรียลไทม์' },
  ];
  const actionMatrix = [
    {
      role: 'รัฐบาล / อปท.',
      roleEn: 'Policy Command',
      action: `หารือเหลื่อมรอบส่งน้ำ 15 วันในโครงการเดียว เพื่อกระจาย ${gluttAtPeak.toFixed(1)} พันตันที่ล้นออกจากช่วงพีค`,
      eta: 'ต้องเริ่มใน 7 วัน',
      tone: 'urgent',
    },
    {
      role: 'ผู้ค้าปลีก',
      roleEn: 'Stock Planning',
      action: 'จองกำลังสีข้าวและพื้นที่เก็บล่วงหน้า ก่อนข้าวออกพร้อมกัน',
      eta: 'เริ่มทันที ก่อนสัปดาห์ที่ 5',
      tone: 'warn',
    },
    {
      role: 'โลจิสติกส์',
      roleEn: 'Route & Distribution',
      action: 'เปลี่ยนเส้นทางจากโซนน้ำท่วมหรือแล้งจัด และย้าย hub ไปคลังสำรอง',
      eta: 're-route ภายใน 72 ชั่วโมง',
      tone: 'risk',
    },
  ];
  // ปุ่มนี้ไม่ได้ส่งอะไรออกไปจริง มันคัดลอกสรุปลงคลิปบอร์ดให้เอาไปส่งเอง
  //
  // เดิมกดแล้วขึ้นว่า "ส่งผ่าน LINE และ SMS ถึงเกษตรกร 842 ครัวเรือน" ทั้งที่
  // ไม่มีการเรียกเครือข่ายใด ๆ และไม่มีทะเบียนเกษตรกรอยู่ในระบบ
  // ข้อความยืนยันต้องตรงกับสิ่งที่เกิดขึ้นจริงเสมอ
  const publishTargets = {
    farmer: {
      title: 'คัดลอกสรุปสำหรับเกษตรกรแล้ว',
      detail: 'นำไปวางในไลน์กลุ่มหรือกระดานสหกรณ์ได้ทันที — ระบบนี้ยังไม่ได้เชื่อมกับช่องทางส่งข้อความ',
    },
    lgu: {
      title: 'คัดลอกสรุปสำหรับหน่วยงานแล้ว',
      detail: 'นำไปวางในหนังสือแจ้งเวียนหรืออีเมลได้ — ระบบนี้ยังไม่ได้เชื่อมกับระบบสารบรรณ',
    },
    retailer: {
      title: 'คัดลอกสรุปสำหรับผู้รับซื้อแล้ว',
      detail: 'นำไปวางในอีเมลถึงคู่ค้าได้ — ระบบนี้ยังไม่ได้เชื่อมกับระบบจัดซื้อ',
    },
  };

  useEffect3(() => {
    if (!publishFeedback) return undefined;
    const timer = window.setTimeout(() => setPublishFeedback(null), 3600);
    return () => window.clearTimeout(timer);
  }, [publishFeedback]);

  const handlePublish = async () => {
    const rollout = publishTargets[tab];
    const publishedAt = new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    // ทำสิ่งที่ปุ่มบอกว่าทำจริง ๆ คือคัดลอกสรุปที่อ่านได้ลงคลิปบอร์ด
    const lines = [
      `สรุปคำแนะนำ CropSentinel — ${D.province.nameTh} (${publishedAt} น.)`,
      `พื้นที่ข้าว ${D.province.riceRai.toLocaleString()} ไร่ · ${D.province.riceParcels} แปลง (ดาวเทียม ${D.province.riceAsOfTh})`,
      `ช่วงข้าวออกหนาแน่นที่สุด: ${D.supply.peakWindowTh ?? '-'}`,
      '',
      ...(D.recommendations[tab] || []).map((r, i) => `${i + 1}. ${r.title}\n   ${r.desc}`),
      '',
      'ที่มา: ชั้นข้อมูลเปิด GISTDA (ข้าวรายแปลง, ขอบเขตอำเภอ, น้ำท่วมซ้ำซาก, โรงสี), Open-Meteo, NASA POWER',
      'ตัวเลขราคาและกำลังสีข้าวเป็นค่าสมมติ ยังไม่ได้สอบเทียบ',
    ].join('\n');

    let copied = false;
    try {
      await navigator.clipboard.writeText(lines);
      copied = true;
    } catch (e) {
      console.warn('[CS] คัดลอกไม่สำเร็จ:', e.message);
    }

    setPublishFeedback({
      title: copied ? rollout.title : 'คัดลอกอัตโนมัติไม่สำเร็จ',
      detail: copied ? rollout.detail : 'เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด กรุณาเลือกข้อความในการ์ดคำแนะนำแล้วคัดลอกเอง',
      publishedAt,
    });
  };

  const ctxPerTab = {
    farmer: {
      title: 'คำแนะนำสำหรับเกษตรกร',
      titleEn: 'Farmer advisory',
      kpis: [
        { k: 'แปลงของคุณ', v: '4', u: 'แปลง' },
        { k: 'ผลผลิตคาดการณ์', v: '3.8', u: 'ตัน/ไร่' },
        { k: 'Water stress', v: `${D.province.waterStress ?? 0}`, u: '%' },
      ],
    },
    lgu: {
      title: 'นโยบายและการดำเนินงาน',
      titleEn: 'Policy & operations',
      kpis: [
        { k: 'ผลผลิตทั้งจังหวัด', v: `${currentSupply}`, u: 'พันตัน' },
        { k: 'ล้นเกินช่วงพีค', v: gluttAtPeak.toFixed(1), u: 'พันตัน' },
        { k: 'ระยะเวลานำเข้า', v: '6', u: 'สัปดาห์' },
      ],
    },
    retailer: {
      title: 'คำแนะนำสำหรับผู้ค้าปลีก',
      titleEn: 'Retailer stock & pricing',
      kpis: [
        { k: 'สต็อกปัจจุบัน', v: '2.8', u: 'สัปดาห์' },
        { k: 'เป้าหมายสต็อก', v: '6', u: 'สัปดาห์' },
        { k: 'ความเสี่ยงราคา', v: `+${priceDeltaPct.toFixed(1)}`, u: '%' },
      ],
    },
  };

  const ctx = ctxPerTab[tab];
  const recs = D.recommendations[tab];

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <span className="thai">{t.th}</span>
            <span className="role">{t.role}</span>
          </button>
        ))}
      </div>

      <div className="decision-overview card">
        <div className="card-h">
          <h3>
            Real-time Dashboard <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Feature 6</span>
          </h3>
          <span className="sub thai">Actionable Insight</span>
        </div>

        <div className="rt-grid">
          <div className="rt-card">
            <div className="rt-label">SUPPLY LEVEL</div>
            <div className="rt-value">{supplyLevel}<span>%</span></div>
            <div className="rt-desc thai">กำลังรับซื้อในพื้นที่รองรับได้ {supplyLevel}% ของผลผลิตทั้งฤดู หากไม่เกลี่ยจังหวะ · กำลังรับซื้อเป็นค่าสมมติ</div>
          </div>

            <div className="rt-card">
              <div className="rt-label">RISK LEVEL</div>
              <div className={`rt-value risk-${riskLevel.toLowerCase()}`}>{riskLevel}</div>
              <div className="rt-desc thai">
                ความเสี่ยงหลักคือ{leadingRiskLabel} · Flood {floodRiskLevel} / Drought {droughtRiskLevel}
              </div>
          </div>

          <div className="rt-card rt-card-price">
            <div className="rt-head">
              <div className="rt-label">PRICE TREND</div>
              <div className="rt-badge">{priceDeltaPct > 0 ? '+' : ''}{priceDeltaPct.toFixed(1)}%</div>
            </div>
            <PriceTrendMini values={D.price.actual} />
            <div className="rt-desc thai">ฉากทัศน์: ฿{priceStart.toLocaleString()} → ฿{priceNow.toLocaleString()} ต่อตัน ในช่วงข้าวออกหนาแน่น (ไม่ใช่การพยากรณ์)</div>
          </div>
        </div>

        <div className="flow-banner thai">Data → Prediction → Decision</div>

        <div className="flow-map">
          {flowSummary.map((item, idx) => (
            <div key={item.layer} className="flow-node">
              <div className="flow-node-layer">{idx + 1}. {item.layer}</div>
              <div className="flow-node-title thai">{item.explain}</div>
              <div className="flow-node-detail">{item.detail}</div>
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
              <h3 className="thai" style={{ margin: 0, fontSize: 17, color: 'var(--fg-0)', fontWeight: 600 }}>
                {ctx.title}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{ctx.titleEn}</div>
            </div>
            <span className="chip data thai">
              <span className="dot" />
              {recs.length} รายการ
            </span>
          </div>

          <div className="grid grid-3">
            {ctx.kpis.map((k) => (
              <div key={k.k} className="stat">
                <div className="stat-label thai">{k.k}</div>
                <div className="stat-value">
                  {k.v}
                  <span className="unit thai">{k.u}</span>
                </div>
              </div>
            ))}
          </div>

          <div>{recs.map((r, i) => <RecCard key={i} r={r} />)}</div>

          <div className="card">
            <div className="card-h">
              <h3>
                ลำดับการดำเนินงาน <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Decision timeline</span>
              </h3>
              <span className="sub">8 สัปดาห์ข้างหน้า</span>
            </div>
            <DecisionTimeline tab={tab} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-h">
              <h3>
                ระดับอุปทาน <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Supply level</span>
              </h3>
              <span className="sub">เทียบเป้า 6 สัปดาห์</span>
            </div>
            <div className="gauge-wrap">
              <Gauge value={supplyLevel} />
              <div className="gauge-info">
                <div className="gauge-val">
                  {supplyLevel}
                  <span className="unit">%</span>
                </div>
                <div className="gauge-desc thai">
                  กำลังรับซื้อรองรับผลผลิตได้ {supplyLevel}% ของทั้งฤดู ส่วนที่เหลือต้องส่งออกนอกพื้นที่หรือรอคิว
                </div>
              </div>
            </div>
          </div>

          <RiskIndicator level={riskLevel} />

          <div className="card">
            <div className="card-h">
              <h3>
                ปัจจัยที่ส่งผล <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Contributing factors</span>
              </h3>
              <span className="sub">ถ่วงน้ำหนัก</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['ความถี่น้ำท่วมซ้ำซาก', 0.28, 'var(--risk)'],
                ['ฝนต่ำกว่าค่าเฉลี่ย / dry days', 0.22, 'var(--warn)'],
                ['soil moisture ต่ำ', 0.18, 'oklch(0.72 0.16 70)'],
                ['NDVI ลดลง', 0.16, 'var(--warn)'],
                ['ฝุ่น PM2.5 สะสม', 0.09, 'oklch(0.6 0.18 330)'],
                ['ความยืดหยุ่นของราคา', 0.07, 'var(--data)'],
              ].map(([n, v, c]) => (
                <div key={n}>
                  <div className="row space-between" style={{ marginBottom: 4 }}>
                    <span className="thai" style={{ fontSize: 12 }}>{n}</span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{(v * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${v * 100}%`, background: c }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                การประสานงาน <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Coordination</span>
              </h3>
              <span className="sub">สด</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                ['กระทรวงเกษตรฯ', 'เชื่อมต่อ', 'ok'],
                ['อบจ. ปทุมธานี', 'รอแจ้ง', 'warn'],
                ['ธ.ก.ส. สนับสนุนสหกรณ์', 'เชื่อมต่อ', 'ok'],
                ['5 ห้างค้าปลีกรายใหญ่', 'ตอบรับ 3/5', 'warn'],
              ].map(([k, v, s]) => (
                <div key={k} className="row space-between">
                  <span className="thai">{k}</span>
                  <span className={`chip ${s} thai`}>
                    <span className="dot" />
                    {v}
                  </span>
                </div>
              ))}
            </div>
            {publishFeedback && (
              <div className="publish-feedback" role="status" aria-live="polite">
                <div className="publish-feedback-title thai">{publishFeedback.title}</div>
                <div className="publish-feedback-desc thai">{publishFeedback.detail}</div>
                <div className="publish-feedback-meta">PUBLISHED {publishFeedback.publishedAt}</div>
              </div>
            )}
            <button
              type="button"
              className="btn primary thai"
              style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
              onClick={handlePublish}
            >
              {publishFeedback ? 'คัดลอกแล้ว' : 'คัดลอกสรุปคำแนะนำ →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisionTimeline({ tab }) {
  const events = {
    farmer: [
      { w: 1, t: 'นัดคิวรถเกี่ยวและกำลังสีข้าวล่วงหน้า', k: 'urgent' },
      { w: 2, t: 'นัดคิวรถเกี่ยวกับสหกรณ์', k: 'soft' },
      { w: 3, t: 'น้ำท่วม - งดทำงานในนา', k: 'urgent' },
      { w: 5, t: 'เตรียมดินปลูกพันธุ์ทนน้ำ', k: 'soft' },
      { w: 7, t: 'เริ่มปลูกรอบใหม่ (กข79)', k: 'good' },
    ],
    lgu: [
      { w: 1, t: 'เปิดเจรจานำเข้าระดับรัฐบาล', k: 'urgent' },
      { w: 2, t: 'จัดเตรียมความพร้อมพื้นที่เสี่ยง', k: 'soft' },
      { w: 3, t: 'เปิดปฏิบัติการรับมือน้ำท่วม', k: 'urgent' },
      { w: 5, t: 'ข้าวนำเข้าถึงท่าเรือแหลมฉบัง', k: 'good' },
      { w: 6, t: 'ทบทวนเพดานราคา', k: 'soft' },
    ],
    retailer: [
      { w: 1, t: 'จองกำลังสีข้าวล่วงหน้าก่อนช่วงข้าวออกหนาแน่น', k: 'urgent' },
      { w: 2, t: 'เปิดใช้ซัพพลายเออร์นครสวรรค์', k: 'soft' },
      { w: 4, t: 'สื่อสารเรื่องราคากับผู้บริโภค', k: 'soft' },
      { w: 6, t: 'ช่วงราคาขยายตัวสูงสุด', k: 'urgent' },
      { w: 8, t: 'เติมสต็อกจากการนำเข้า', k: 'good' },
    ],
  }[tab];

  return (
    <div style={{ position: 'relative', paddingLeft: 8 }}>
      <div style={{ position: 'absolute', left: 14, top: 12, bottom: 12, width: 1, background: 'var(--line)' }} />
      {events.map((e, i) => (
        <div key={i} className="row" style={{ gap: 14, padding: '8px 0', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              marginTop: 2,
              flexShrink: 0,
              background: e.k === 'urgent' ? 'var(--risk)' : e.k === 'good' ? 'var(--ok)' : 'var(--warn)',
              boxShadow: '0 0 0 3px var(--bg-1)',
              zIndex: 1,
            }}
          />
          <div style={{ width: 42, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)', flexShrink: 0, paddingTop: 2 }}>
            สปด.{e.w}
          </div>
          <div className="thai" style={{ fontSize: 12, color: 'var(--fg-1)', paddingTop: 1 }}>{e.t}</div>
        </div>
      ))}
    </div>
  );
}

window.Module3 = Module3;
