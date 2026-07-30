// Module 1 — Data Intelligence Layer
const { useState, useMemo, useRef, useEffect } = React;

// สีบนแผนที่ปรับมาสำหรับพื้นหลังสว่าง
// ชุดเดิมออกแบบไว้สำหรับธีมมืด พอเปลี่ยนเป็นพื้นสว่างแล้วซีดจนแยกระดับไม่ออก
// จึงลดความสว่าง (L) และเพิ่มความอิ่มสี (C) ให้ต่างกันชัดบนพื้นขาว
function ndviColor(v) {
  if (v >= 0.7) return 'oklch(0.62 0.16 150)';   // สมบูรณ์ เขียว
  if (v >= 0.6) return 'oklch(0.72 0.15 118)';
  if (v >= 0.5) return 'oklch(0.78 0.15 85)';    // เริ่มเครียด เหลือง
  if (v >= 0.4) return 'oklch(0.7 0.16 55)';
  return 'oklch(0.62 0.18 32)';                  // วิกฤติ แดงส้ม
}
function floodColor(v) {
  // ยิ่งท่วมซ้ำบ่อย ยิ่งน้ำเงินเข้ม
  const a = 0.18 + v * 0.62;
  return `oklch(0.55 0.15 245 / ${a.toFixed(2)})`;
}
function pmColor(v) {
  if (v >= 55) return 'oklch(0.5 0.2 330 / 0.6)';
  if (v >= 45) return 'oklch(0.58 0.17 330 / 0.46)';
  if (v >= 35) return 'oklch(0.66 0.14 330 / 0.34)';
  return 'oklch(0.74 0.09 330 / 0.22)';
}
function droughtColor(v) {
  if (v >= 0.75) return 'oklch(0.58 0.19 55 / 0.8)';
  if (v >= 0.55) return 'oklch(0.68 0.17 68 / 0.66)';
  if (v >= 0.35) return 'oklch(0.78 0.14 88 / 0.52)';
  return 'oklch(0.75 0.11 130 / 0.34)';
}

// สีข้างบนมี alpha และสว่าง เพราะออกแบบไว้ "เติมพื้นที่บนแผนที่"
// ถ้าเอาไปใช้เป็นสีตัวอักษรบนพื้นขาวจะจางจนวัดได้ 1.27:1 (ต้องการ 4.5:1)
// จึงต้องมีชุดสีสำหรับข้อความแยกต่างหาก ทึบและเข้มพอทุกระดับ
function ndviTextColor(v) {
  if (v >= 0.7) return 'oklch(0.45 0.14 150)';
  if (v >= 0.6) return 'oklch(0.47 0.12 118)';
  if (v >= 0.5) return 'oklch(0.47 0.12 75)';
  if (v >= 0.4) return 'oklch(0.48 0.15 45)';
  return 'oklch(0.48 0.19 28)';
}
function droughtTextColor(v) {
  if (v >= 0.75) return 'oklch(0.46 0.18 40)';
  if (v >= 0.55) return 'oklch(0.47 0.14 62)';
  if (v >= 0.35) return 'oklch(0.48 0.12 82)';
  return 'oklch(0.46 0.12 150)';
}
function riskChip(r) {
  const map = { LOW: 'ok', MEDIUM: 'warn', HIGH: 'risk', CRITICAL: 'risk' };
  return map[r] || 'warn';
}

function MapView() {
  const [layer, setLayer] = useState('ndvi'); // ndvi | flood | drought | pm25
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cursor, setCursor] = useState({ x: 100.52, y: 14.02 });
  const svgRef = useRef(null);
  const D = window.CS_DATA;

  const onMove = (e) => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    // Map to plausible lat/lng around Pathum Thani
    const lng = 100.42 + px * 0.32;
    const lat = 14.15 - py * 0.28;
    setCursor({ x: lng, y: lat });
  };

  const districtFill = (d) => {
    if (layer === 'ndvi') return ndviColor(d.ndvi);
    if (layer === 'flood') return floodColor(d.flood);
    if (layer === 'drought') return droughtColor(d.drought ?? 0);
    return pmColor(d.pm25);
  };

  return (
    <div className="map-wrap" onMouseMove={onMove}>
      <svg ref={svgRef} className="map-svg" viewBox="0 0 760 480" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.28 0.022 250)" strokeWidth="0.5" />
          </pattern>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="oklch(0.8 0.02 250 / 0.08)" strokeWidth="1" />
          </pattern>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.78 0.14 210 / 0.5)" />
            <stop offset="100%" stopColor="oklch(0.78 0.14 210 / 0)" />
          </radialGradient>
        </defs>

        <rect width="760" height="480" fill="var(--bg-1)" />
        <rect width="760" height="480" fill="url(#grid)" />
        <rect width="760" height="480" fill="url(#hatch)" />

        {/* Water — Chao Phraya river */}
        <path d="M 140 80 C 180 180, 240 220, 260 300 S 280 420, 260 470"
              fill="none" stroke="oklch(0.55 0.1 235 / 0.8)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 140 80 C 180 180, 240 220, 260 300 S 280 420, 260 470"
              fill="none" stroke="oklch(0.72 0.12 235 / 0.35)" strokeWidth="26" strokeLinecap="round" />
        <text x="150" y="75" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-3)">CHAO PHRAYA R.</text>

        {/* Klong Rangsit — east-west canal */}
        <path d="M 300 300 L 600 310" stroke="oklch(0.6 0.1 235 / 0.5)" strokeWidth="4" strokeDasharray="2 3" />
        <text x="470" y="296" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-3)">KHLONG RANGSIT</text>

        {/* Districts */}
        {D.districts.map((d) => (
          <g key={d.id}
             onMouseEnter={() => setHover(d.id)}
             onMouseLeave={() => setHover(null)}
             onClick={() => setSelected(d)}
             style={{ cursor: 'pointer' }}>
            <polygon
              points={d.poly}
              fill={districtFill(d)}
              stroke={hover === d.id || selected?.id === d.id ? 'var(--fg-0)' : 'oklch(0.28 0.022 250 / 0.9)'}
              strokeWidth={hover === d.id || selected?.id === d.id ? 1.6 : 0.8}
              style={{ transition: 'fill 0.25s, stroke 0.15s' }}
            />
          </g>
        ))}

        {/* Labels */}
        {D.districts.map((d) => {
          const pts = d.poly.split(' ').map(p => p.split(',').map(Number));
          const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
          const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
          return (
            <g key={d.id + '-lbl'} pointerEvents="none">
              <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--font-thai)" fontSize="11" fill="var(--fg-0)" fontWeight="600">{d.nameTh}</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-2)" letterSpacing="0.5">
                {layer === 'ndvi' && `NDVI ${d.ndvi.toFixed(2)}`}
                {layer === 'flood' && `FLOOD ${(d.flood * 100).toFixed(0)}%`}
                {layer === 'drought' && `DRY ${(d.drought * 100).toFixed(0)}%`}
                {layer === 'pm25' && `PM2.5 ${d.pm25}`}
              </text>
            </g>
          );
        })}

        {/* Bangkok arrow indicator */}
        <g transform="translate(680, 440)">
          <line x1="0" y1="0" x2="0" y2="-22" stroke="var(--fg-3)" strokeWidth="1" />
          <polygon points="0,-26 -3,-20 3,-20" fill="var(--fg-3)" />
          <text x="0" y="14" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-3)">← BANGKOK 28KM</text>
        </g>
        {/* Scale */}
        <g transform="translate(40, 440)">
          <line x1="0" y1="0" x2="60" y2="0" stroke="var(--fg-2)" strokeWidth="1.2" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke="var(--fg-2)" strokeWidth="1.2" />
          <line x1="60" y1="-3" x2="60" y2="3" stroke="var(--fg-2)" strokeWidth="1.2" />
          <text x="30" y="16" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-3)">5 KM</text>
        </g>
      </svg>

      {/* Toolbar */}
      <div className="map-toolbar">
        <div className="toggle-group">
          <button className={layer === 'ndvi' ? 'on' : ''} onClick={() => setLayer('ndvi')}>NDVI</button>
          <button className={layer === 'flood' ? 'on' : ''} onClick={() => setLayer('flood')}>FLOOD</button>
          <button className={layer === 'drought' ? 'on' : ''} onClick={() => setLayer('drought')}>DROUGHT</button>
          <button className={layer === 'pm25' ? 'on' : ''} onClick={() => setLayer('pm25')}>PM2.5</button>
        </div>
      </div>

      {/* Crosshair readout */}
      <div className="map-crosshair">
        {cursor.y.toFixed(3)}°N · {cursor.x.toFixed(3)}°E
      </div>

      {/* Legend */}
      <div className="map-legend">
        {layer === 'ndvi' && (
          <>
            <div><span className="sw" style={{ background: 'oklch(0.7 0.18 145)' }}/> <span className="thai">สมบูรณ์</span> &gt; 0.70</div>
            <div><span className="sw" style={{ background: 'oklch(0.78 0.16 75)' }}/> <span className="thai">พืชเครียด</span> 0.50–0.70</div>
            <div><span className="sw" style={{ background: 'oklch(0.6 0.19 25)' }}/> <span className="thai">วิกฤติ</span> &lt; 0.50</div>
          </>
        )}
        {layer === 'flood' && (
          <>
            <div><span className="sw" style={{ background: 'oklch(0.62 0.14 235 / 0.25)' }}/> <span className="thai">เสี่ยงต่ำ</span></div>
            <div><span className="sw" style={{ background: 'oklch(0.62 0.14 235 / 0.5)' }}/> <span className="thai">ปานกลาง</span></div>
            <div><span className="sw" style={{ background: 'oklch(0.62 0.14 235 / 0.75)' }}/> <span className="thai">สูง</span></div>
          </>
        )}
        {layer === 'pm25' && (
          <>
            <div><span className="sw" style={{ background: 'oklch(0.7 0.08 330 / 0.3)' }}/> &lt; 35 μg/m³</div>
            <div><span className="sw" style={{ background: 'oklch(0.58 0.16 330 / 0.5)' }}/> 35–55</div>
            <div><span className="sw" style={{ background: 'oklch(0.5 0.2 330 / 0.6)' }}/> &gt; 55 <span className="thai">(อันตราย)</span></div>
          </>
        )}
        {layer === 'drought' && (
          <>
            <div><span className="sw" style={{ background: 'oklch(0.72 0.1 120 / 0.30)' }}/> <span className="thai">ต่ำ</span> &lt; 35%</div>
            <div><span className="sw" style={{ background: 'oklch(0.76 0.14 82 / 0.48)' }}/> <span className="thai">เฝ้าระวัง</span> 35–55%</div>
            <div><span className="sw" style={{ background: 'oklch(0.66 0.17 65 / 0.62)' }}/> <span className="thai">สูง</span> &gt; 55%</div>
          </>
        )}
      </div>

      {/* Popup */}
      {selected && (
        <DistrictPopup d={selected} layer={layer} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function DistrictPopup({ d, layer, onClose }) {
  return (
    <div className="zone-popup" style={{ top: 60, right: 16 }}>
      <button className="close" onClick={onClose}>✕</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>{d.name}</div>
          <div className="thai" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{d.nameTh}</div>
        </div>
        <span className={`chip ${riskChip(layer === 'drought' ? d.droughtRisk : d.risk)}`} style={{ marginLeft: 'auto' }}>
          <span className="dot"/> {layer === 'drought' ? d.droughtRisk : d.risk}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        <Metric k="NDVI" v={d.ndvi.toFixed(2)} sub={d.ndvi > 0.65 ? 'ปกติ' : 'พืชเครียด'} />
        <Metric k="ความเสี่ยงน้ำท่วม" v={`${(d.flood * 100).toFixed(0)}%`} sub={d.flood > 0.5 ? 'ต้องเฝ้าระวัง' : 'ปกติ'} />
        <Metric k="ภัยแล้ง" v={`${(d.drought * 100).toFixed(0)}%`} sub={d.droughtRisk || 'LOW'} />
        <Metric k="Water stress" v={`${d.waterStress ?? 0}%`} sub={`soil ${d.soilMoisture?.toFixed?.(2) ?? '--'}`} />
        <Metric k="PM2.5" v={`${d.pm25}`} sub="μg/m³" />
        <Metric k="พื้นที่เพาะปลูก" v={`${(d.farmland/1000).toFixed(0)}k`} sub="ไร่" />
      </div>
      <div className="thai" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line-soft)', fontSize: 12, color: 'var(--fg-3)' }}>
        ดาวเทียม Sentinel-2 L2A · ถ่ายทุก 5 วัน
      </div>
    </div>
  );
}

function Metric({ k, v, sub }) {
  return (
    <div style={{ padding: 8, background: 'var(--bg-1)', borderRadius: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{k}</div>
      <div style={{ fontSize: 16, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{sub}</div>
    </div>
  );
}

function Sparkline({ data, color = 'var(--data)', fill = true }) {
  const w = 120, h = 28, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / range) * (h - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const a = `${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`}>
      {fill && <path d={a} fill={color} opacity="0.15" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function Module1() {
  const D = window.CS_DATA.province;
  return (
    <div className="grid mod1-layout">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-h" style={{ padding: '14px 16px 0' }}>
            <div>
              <h3>แผนที่สุขภาพพืชจังหวัดปทุมธานี <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Crop Health Map</span></h3>
              <div className="sub" style={{ marginTop: 4 }}>
                ขอบเขตอำเภอ: GISTDA L05_Amphoe 1:50,000 · พื้นที่ข้าว: GISTDA รายแปลง {D.riceAsOfTh} ({D.ricePixelM} ม./จุดภาพ)
              </div>
            </div>
            <span className="chip data thai"><span className="dot"/> ภาพดาวเทียม เม.ย. 2569</span>
          </div>
          <div style={{ padding: 12 }}>
            <MapView />
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>ข้อมูลรายอำเภอ <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>District breakdown</span></h3>
            <span className="sub">7 อำเภอ</span>
          </div>
          <table className="tbl">
            <thead>
              <tr><th className="thai">อำเภอ</th><th>NDVI</th><th className="thai">น้ำท่วม</th><th className="thai">ภัยแล้ง</th><th>PM2.5</th><th className="thai">พื้นที่</th><th className="thai">ความเสี่ยง</th></tr>
            </thead>
            <tbody>
              {window.CS_DATA.districts.map(d => (
                <tr key={d.id}>
                  <td>
                    <div>{d.name}</div>
                    <div className="thai" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{d.nameTh}</div>
                  </td>
                  <td className="mono" style={{ color: ndviTextColor(d.ndvi), fontWeight: 600 }}>{d.ndvi.toFixed(2)}</td>
                  <td className="mono">{(d.flood * 100).toFixed(0)}%</td>
                  <td className="mono" style={{ color: droughtTextColor(d.drought), fontWeight: 600 }}>{(d.drought * 100).toFixed(0)}%</td>
                  <td className="mono">{d.pm25 ?? "—"}</td>
                  <td className="mono">{(d.farmland/1000).toFixed(0)}k ไร่</td>
                  <td>
                    <span className={`chip ${riskChip(d.risk)}`}><span className="dot"/>F {d.risk}</span>
                    <span className={`chip ${riskChip(d.droughtRisk)}`} style={{ marginLeft: 6 }}><span className="dot"/>D {d.droughtRisk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-2">
          <div className="stat">
            <div className="stat-label thai">พื้นที่ปลูกข้าว</div>
            <div className="stat-value">{(D.riceRai / 1000).toFixed(0)}<span className="unit">พันไร่</span></div>
            <div className="stat-delta neutral thai">
              {/* 1 ไร่ = 1,600 ตร.ม. = 0.16 เฮกตาร์ */}
              {(D.riceRai * 0.16).toLocaleString('th-TH', { maximumFractionDigits: 0 })} เฮกตาร์ · {(D.riceShare * 100).toFixed(1)}% ของพื้นที่จังหวัด
            </div>
          </div>
          <div className="stat">
            <div className="stat-label thai">แปลงข้าวที่ตรวจพบ</div>
            <div className="stat-value">{D.riceParcels}<span className="unit">แปลง</span></div>
            <div className="stat-delta neutral thai">จากภาพดาวเทียม {D.riceAsOfTh}</div>
          </div>
          <div className="stat">
            <div className="stat-label thai">ค่า NDVI เฉลี่ย</div>
            <div className="stat-value">{D.avgNDVI.toFixed(2)}</div>
            <Sparkline data={[0.71, 0.7, 0.69, 0.68, 0.67, 0.66, 0.66, 0.65]} color="var(--warn)" />
            <div className="stat-delta negative thai">▼ พืชเริ่มเครียดปานกลาง</div>
          </div>
          <div className="stat">
            <div className="stat-label">PM2.5</div>
            <div className="stat-value">{D.pm25 ?? "—"}<span className="unit">μg/m³</span></div>
            <Sparkline data={[32, 36, 38, 41, 43, 42, 45, 45]} color="oklch(0.6 0.18 330)" />
            <div className="stat-delta negative thai">▲ ระดับส่งผลต่อสุขภาพ</div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>แหล่งข้อมูล <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Data sources</span></h3>
            <span className="sub thai">เรียกจริงทุกแหล่ง</span>
          </div>
          {/*
            รายการนี้ต้องตรงกับ endpoint ที่โค้ดเรียกจริงเท่านั้น
            สถานะ 'archive' = ข้อมูลย้อนหลังที่ GISTDA เผยแพร่ ไม่ใช่ค่าเรียลไทม์
            อย่าใส่แหล่งข้อมูลที่ยังไม่ได้ต่อจริงลงในรายการนี้
          */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['GISTDA L09 ข้าวรายแปลง', `พื้นที่ปลูก ช่วงเกี่ยว โครงการชลประทาน · ${D.riceParcels} แปลง`, 'ok', D.riceAsOfTh],
              ['GISTDA L05 ขอบเขตอำเภอ', 'ขอบเขตการปกครอง 1:50,000 · 7 อำเภอ', 'ok', 'ชั้นข้อมูลฐาน'],
              ['GISTDA FL น้ำท่วมซ้ำซาก', 'ความถี่น้ำท่วม 2548-2559', 'ok', 'ย้อนหลัง 12 ปี'],
              ['GISTDA โรงสีข้าว', `ตำแหน่งโรงสี · ในจังหวัด ${D.mills.inProvince.length} แห่ง`, 'ok', 'ชั้นข้อมูลฐาน'],
              ['Open-Meteo', 'ฝนสะสม อุณหภูมิ ความชื้น', 'ok', 'เรียลไทม์'],
              ['NASA POWER', 'ดัชนีพืชพรรณโดยประมาณ ความชื้นดิน', 'ok', 'ล่าช้า 5 วัน'],
            ].map(([name, desc, s, ago]) => (
              <div key={name} className="row" style={{ fontSize: 12 }}>
                <span className={`chip ${s}`}><span className="dot"/>{s.toUpperCase()}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--fg-0)', fontSize: 12 }}>{name}</div>
                  <div className="thai" style={{ color: 'var(--fg-3)', fontSize: 12 }}>{desc}</div>
                </div>
                <div className="mono" style={{ color: 'var(--fg-3)', fontSize: 12 }}>{ago}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>แนวโน้มสภาพแวดล้อม <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Environmental timeline</span></h3>
            <span className="sub">30 วันที่ผ่านมา</span>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <TimelineRow label="ปริมาณฝน" unit="มม./วัน" color="var(--data)"
              data={[0,2,5,1,0,0,8,12,6,2,0,0,15,22,18,4,0,0,0,2,6,10,14,8,2,0,0,4,9,6]} />
            <TimelineRow label="NDVI" unit="ดัชนี" color="var(--ok)"
              data={[0.71,0.71,0.72,0.72,0.71,0.70,0.70,0.69,0.69,0.68,0.68,0.67,0.67,0.67,0.68,0.67,0.67,0.66,0.66,0.66,0.65,0.65,0.65,0.65,0.65,0.65,0.65,0.65,0.65,0.65]} />
            <TimelineRow label="PM2.5" unit="μg/m³" color="oklch(0.6 0.18 330)"
              data={[28,32,30,35,36,38,41,39,42,43,41,43,45,44,43,45,48,46,44,45,47,46,44,45,46,45,44,45,45,45]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ label, unit, color, data }) {
  const w = 100, h = 26;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  return (
    <div>
      <div className="row space-between" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{label}</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{data.at(-1)} {unit}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="28" preserveAspectRatio="none">
        {data.map((v, i) => {
          const x = (i / data.length) * w;
          const bh = ((v - min) / range) * (h - 2);
          return <rect key={i} x={x} y={h - bh} width={w / data.length - 0.3} height={bh} fill={color} opacity={0.35 + 0.5 * ((v - min) / range)} />;
        })}
      </svg>
    </div>
  );
}

window.Module1 = Module1;
window.CS_UTILS = { ndviColor, riskChip, Sparkline };
