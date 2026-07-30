// Module 2 — Predictive Intelligence Engine
const { useState: useState2, useMemo: useMemo2, useRef: useRef2 } = React;

function SupplyChart({ data, weeks }) {
  const W = 720, H = 280;
  const padL = 44, padR = 14, padT = 18, padB = 32;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const all = [...data.projected, ...data.demand];
  const yMax = Math.ceil(Math.max(...all) / 20) * 20 + 20;
  const yMin = Math.floor(Math.min(...all) / 20) * 20 - 20;
  const yRange = yMax - yMin;
  const x = (i) => padL + (i / (weeks.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const [hover, setHover] = useState2(null);

  const projPath = data.projected.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const demPath = data.demand.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  // พื้นที่ที่ระบายคือส่วนที่ "ล้น" — ข้าวมาถึงเกินกำลังรับซื้อ
  // เดิมระบายส่วนที่ต่ำกว่ากำลังรับซื้อ (shortage) ซึ่งกลับด้านกับปัญหาจริงของพื้นที่นี้
  // และกลับด้านกับป้ายกำกับใน legend ด้วย
  const shortPath = [
    ...data.projected.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(Math.max(v, data.demand[i]))}`),
    ...data.demand.slice().reverse().map((v, i) => `L ${x(weeks.length - 1 - i)} ${y(v)}`),
    'Z',
  ].join(' ');

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const idx = Math.max(0, Math.min(weeks.length - 1, Math.round((px - padL) / plotW * (weeks.length - 1))));
    setHover(idx);
  };

  const yTicks = [];
  for (let t = yMin; t <= yMax; t += 40) yTicks.push(t);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="projGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--data)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--data)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* y-axis grid */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-3)">{t}</text>
          </g>
        ))}
        <text x={padL - 30} y={padT + 6} fontFamily="var(--font-thai)" fontSize="11" fill="var(--fg-3)" transform={`rotate(-90 ${padL-30} ${padT+6})`}>พันตัน</text>

        {/* shortage region */}
        <path d={shortPath} fill="oklch(0.6 0.19 25 / 0.2)" />

        {/* demand baseline */}
        <path d={demPath} fill="none" stroke="var(--fg-2)" strokeWidth="1.2" strokeDasharray="4 4" />

        {/* projected fill + line */}
        <path d={`${projPath} L ${x(weeks.length - 1)} ${y(yMin)} L ${x(0)} ${y(yMin)} Z`} fill="url(#projGrad)" />
        <path d={projPath} fill="none" stroke="var(--data)" strokeWidth="2" />

        {/* points */}
        {data.projected.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} fill="var(--data)" stroke="var(--bg-0)" strokeWidth="2"/>
        ))}

        {/* x-axis */}
        {weeks.map((w, i) => (
          <text key={w} x={x(i)} y={H - padB + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-2)">{w}</text>
        ))}

        {/* hover line */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--fg-0)" strokeOpacity="0.3" strokeWidth="1" />
          </g>
        )}

        {/* Legend */}
        <g transform={`translate(${padL}, ${padT - 4})`}>
          <rect width="12" height="2" y="4" fill="var(--data)"/>
          <text x="20" y="9" fontSize="11" fill="var(--fg-2)" fontFamily="var(--font-thai)">ข้าวเข้าตลาด (วัดได้)</text>
          <rect width="12" height="2" y="4" x="170" fill="var(--fg-2)"/>
          <text x="188" y="9" fontSize="11" fill="var(--fg-2)" fontFamily="var(--font-thai)">กำลังรับซื้อ (สมมติ)</text>
          <rect width="12" height="8" y="1" x="330" fill="oklch(0.6 0.19 25 / 0.3)"/>
          <text x="348" y="9" fontSize="11" fill="var(--fg-2)" fontFamily="var(--font-thai)">ส่วนที่ล้น</text>
        </g>
      </svg>

      {hover !== null && (
        <div className="chart-tt" style={{
          left: `${(x(hover) / W) * 100}%`,
          top: 10,
          transform: hover > weeks.length - 3 ? 'translateX(-105%)' : 'translateX(10px)'
        }}>
          <div className="row space-between"><span className="k thai">ช่วง</span><span className="v thai">{weeks[hover]}</span></div>
          <div className="row space-between"><span className="k thai">ข้าวเข้าตลาด</span><span className="v" style={{ color: 'var(--data)' }}>{data.projected[hover]} พันตัน</span></div>
          <div className="row space-between"><span className="k thai">กำลังรับซื้อ</span><span className="v">{data.demand[hover]} พันตัน</span></div>
          <div className="row space-between" style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--line-soft)' }}>
            <span className="k">Δ</span>
            <span className="v" style={{ color: data.projected[hover] < data.demand[hover] ? 'var(--risk)' : 'var(--ok)' }}>
              {data.projected[hover] > data.demand[hover] ? '+' : ''}{data.projected[hover] - data.demand[hover]}kt
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceChart({ data, weeks }) {
  const W = 720, H = 260;
  const padL = 52, padR = 14, padT = 16, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const all = [...data.actual, ...data.band_low, ...data.band_high];
  const yMax = Math.ceil(Math.max(...all) / 500) * 500;
  const yMin = Math.floor(Math.min(...all) / 500) * 500 - 300;
  const yRange = yMax - yMin;
  const x = (i) => padL + (i / (weeks.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const [hover, setHover] = useState2(null);

  const bandPath = [
    ...data.band_high.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`),
    ...data.band_low.slice().reverse().map((v, i) => `L ${x(weeks.length - 1 - i)} ${y(v)}`),
    'Z',
  ].join(' ');
  const linePath = data.actual.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  const yTicks = [];
  for (let t = yMin; t <= yMax; t += 500) yTicks.push(t);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const idx = Math.max(0, Math.min(weeks.length - 1, Math.round((px - padL) / plotW * (weeks.length - 1))));
    setHover(idx);
  };

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="priceGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--warn)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--warn)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-3)">{t.toLocaleString()}</text>
          </g>
        ))}

        {/* threshold: price ceiling */}
        <line x1={padL} x2={W - padR} y1={y(10500)} y2={y(10500)} stroke="var(--risk)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        <text x={W - padR - 4} y={y(10500) - 4} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--risk)">ALERT CEILING 10,500</text>

        {/* confidence band */}
        <path d={bandPath} fill="url(#priceGrad)" opacity="0.7" />

        {/* actual line */}
        <path d={linePath} fill="none" stroke="var(--warn)" strokeWidth="2" />
        {data.actual.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} fill="var(--warn)" stroke="var(--bg-0)" strokeWidth="2"/>
        ))}

        {weeks.map((w, i) => (
          <text key={w} x={x(i)} y={H - padB + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-2)">{w}</text>
        ))}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--fg-0)" strokeOpacity="0.3" strokeWidth="1" />
        )}

        <g transform={`translate(${padL}, ${padT - 4})`}>
          <rect width="12" height="2" y="4" fill="var(--warn)"/>
          <text x="18" y="8" fontSize="10" fill="var(--fg-2)" fontFamily="var(--font-mono)">ราคาตามฉากทัศน์ (บาท/ตัน)</text>
          <rect width="12" height="8" y="1" x="180" fill="var(--warn)" opacity="0.3"/>
          <text x="198" y="9" fontSize="11" fill="var(--fg-2)" fontFamily="var(--font-thai)">ช่วงกว้าง ±6% (ค่าสมมติ)</text>
        </g>
      </svg>

      {hover !== null && (
        <div className="chart-tt" style={{
          left: `${(x(hover) / W) * 100}%`,
          top: 10,
          transform: hover > weeks.length - 3 ? 'translateX(-105%)' : 'translateX(10px)'
        }}>
          <div className="row space-between"><span className="k thai">ช่วง</span><span className="v thai">{weeks[hover]}</span></div>
          <div className="row space-between"><span className="k">Forecast</span><span className="v" style={{ color: 'var(--warn)' }}>฿{data.actual[hover].toLocaleString()}</span></div>
          <div className="row space-between"><span className="k">Low</span><span className="v">฿{data.band_low[hover].toLocaleString()}</span></div>
          <div className="row space-between"><span className="k">High</span><span className="v">฿{data.band_high[hover].toLocaleString()}</span></div>
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert, onDismiss }) {
  return (
    <div className={`alert ${alert.level}`}>
      <div className="h">
        <span className={`chip ${alert.level === 'crit' ? 'risk' : alert.level}`}><span className="dot"/>{alert.tag}</span>
        <button className="dismiss" onClick={() => onDismiss(alert.id)} title="Dismiss">✕</button>
      </div>
      <div className="title thai">{alert.title}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{alert.titleEn}</div>
      <div className="body thai">{alert.body}</div>
      {/*
        เดิมตรงนี้แสดงแถบ "ความเชื่อมั่น" จากฟิลด์ alert.confidence ซึ่งเป็นตัวเลข
        ที่พิมพ์ไว้เฉย ๆ ไม่ได้คำนวณ พอถอดฟิลด์นั้นออกไป แถบจึงแสดง "NaN%" ค้างอยู่
        แทนที่ด้วยที่มาของข้อมูลจริง ซึ่งมีประโยชน์กับผู้อ่านมากกว่าตัวเลขที่แต่งขึ้น
      */}
      {alert.basisTh && (
        <div className="alert-basis thai">ที่มา: {alert.basisTh}</div>
      )}
    </div>
  );
}

function Module2() {
  const D = window.CS_DATA;
  const [alerts, setAlerts] = useState2(D.alerts);
  const dismiss = (id) => setAlerts(a => a.filter(x => x.id !== id));
  const reset = () => setAlerts(D.alerts);

  const currentSupply = D.supply.current;
  const shortage    = Math.round((D.supply.demand[7] - D.supply.projected[7]) * 10) / 10;
  const priceDelta  = Math.round(((D.price.actual[7] - D.price.actual[0]) / D.price.actual[0]) * 1000) / 10;

  return (
    <div className="grid mod2-layout">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-3">
          <div className="stat">
            <div className="stat-label thai">ผลผลิตทั้งฤดู</div>
            <div className="stat-value">{currentSupply}<span className="unit">พันตัน</span></div>
            <div className="stat-delta neutral thai">{D.province.riceRai.toLocaleString()} ไร่ × {D.province.productKgPerRai[0]} กก./ไร่</div>
          </div>
          <div className="stat">
            <div className="stat-label thai">ล้นเกินกำลังรับซื้อ ช่วง {D.supply.peakWindowTh ?? '-'}</div>
            <div className="stat-value" style={{ color: 'var(--risk)' }}>
              {Math.abs(shortage).toFixed(1)}<span className="unit">พันตัน</span>
            </div>
            <div className="stat-delta negative thai">
              เกินกำลังรับซื้อที่ตั้งสมมติไว้ {(D.supply.projected[D.supply.peakWindowIndex ?? 7] / (D.supply.demand[0] || 1)).toFixed(1)} เท่า
            </div>
          </div>
          <div className="stat">
            <div className="stat-label thai">ฉากทัศน์ราคาช่วงข้าวออกหนาแน่น</div>
            <div className="stat-value">฿{D.price.actual[D.supply.peakWindowIndex ?? 7].toLocaleString()}</div>
            <div className="stat-delta negative thai">
              {priceDelta < 0 ? '▼ ลดลง' : '▲ เพิ่มขึ้น'} {Math.abs(priceDelta).toFixed(1)}% จากราคาอ้างอิง · ไม่ใช่การพยากรณ์
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>ปฏิทินข้าวเข้าตลาด — 8 ช่วงครึ่งเดือน <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Harvest arrival calendar</span></h3>
            <span className="chip warn thai"><span className="dot"/>แบบจำลอง ไม่ใช่ค่าที่วัดได้</span>
          </div>
          <SupplyChart data={D.supply} weeks={D.weeks} />
        </div>

        <div className="card">
          <div className="card-h">
            <h3>ฉากทัศน์ราคาข้าว — บาท/ตัน <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Price scenario</span></h3>
            <span className="chip warn thai"><span className="dot"/>ฉากทัศน์ ไม่ใช่การพยากรณ์</span>
          </div>
          <PriceChart data={D.price} weeks={D.weeks} />
        </div>

        <div className="card">
          <div className="card-h">
            <h3>วิธีคำนวณ <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>How this is computed</span></h3>
            <span className="sub thai">เปิดสูตรทั้งหมด</span>
          </div>
          {/*
            การ์ดนี้เคยแสดง "Ensemble · 4 models" พร้อมค่าความเชื่อมั่น LSTM/XGBoost
            ซึ่งไม่มีโมเดลเหล่านั้นอยู่ในโค้ดเลย จึงเปลี่ยนเป็นการเปิดสูตรจริง
            หลักการ: ถ้าไม่มีของจริงรองรับ ห้ามแสดงตัวเลขความเชื่อมั่น
          */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['อุปทานรายสัปดาห์', 'ลดลงแบบทบต้นจากดัชนีความเครียดของพืช (ฝน ความชื้นดิน ดัชนีพืชพรรณ)', 'สูตรกฎ ไม่ได้เรียนรู้จากข้อมูลย้อนหลัง'],
              ['ราคา', 'ราคาอ้างอิงคูณส่วนต่างอุปสงค์-อุปทาน', 'ค่าความยืดหยุ่นเป็นค่าสมมติ ยังไม่ได้สอบเทียบ'],
              ['พื้นที่ปลูกและช่วงเกี่ยว', 'อ่านตรงจากชั้นข้อมูลข้าวรายแปลงของ GISTDA', 'ค่าที่วัดได้จริง'],
              ['ความถี่น้ำท่วม', 'นับจำนวนปีที่ท่วมซ้ำ 2548-2559 จากชั้นข้อมูล GISTDA', 'ค่าที่วัดได้จริง'],
            ].map(([name, how, caveat]) => {
              const real = caveat === 'ค่าที่วัดได้จริง';
              return (
                <div key={name} className="row" style={{ alignItems: 'flex-start', fontSize: 12 }}>
                  <span className={`chip ${real ? 'ok' : 'warn'} thai`} style={{ flexShrink: 0 }}>
                    <span className="dot"/>{real ? 'วัดได้' : 'แบบจำลอง'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="thai" style={{ color: 'var(--fg-0)' }}>{name}</div>
                    <div className="thai" style={{ color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>{how}</div>
                    <div className="thai" style={{ color: real ? 'var(--ok)' : 'var(--warn)', fontSize: 12, marginTop: 2 }}>{caveat}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div className="card-h">
            <h3>การแจ้งเตือนความเสี่ยง <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Risk alerts</span></h3>
            <div className="row" style={{ gap: 6 }}>
              <span className="sub">{alerts.length} รายการ</span>
              {alerts.length < D.alerts.length && (
                <button className="btn ghost xs thai" onClick={reset}>แสดงทั้งหมด</button>
              )}
            </div>
          </div>
          {alerts.length === 0 && (
            <div className="thai" style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              ปิดการแจ้งเตือนทั้งหมดแล้ว
            </div>
          )}
          {alerts.map(a => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}
        </div>

        <div className="card">
          <div className="card-h">
            <h3>ความน่าจะเป็นของสถานการณ์ <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Scenarios</span></h3>
            <span className="sub">8 สัปดาห์ข้างหน้า</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['กรณีพื้นฐาน — ข้าวออกกระจุกตามที่ดาวเทียมเห็น', 0.42, 'var(--warn)'],
              ['วิกฤติน้ำท่วมรุนแรง', 0.26, 'var(--risk)'],
              ['ฝนมาเร็ว ต้องเร่งเกี่ยว', 0.17, 'var(--warn)'],
              ['เหลื่อมรอบส่งน้ำได้สำเร็จ', 0.10, 'var(--ok)'],
              ['เหตุการณ์ไม่คาดคิด — พายุไต้ฝุ่น', 0.05, 'var(--crit)'],
            ].map(([name, p, c]) => (
              <div key={name}>
                <div className="row space-between" style={{ marginBottom: 4 }}>
                  <span className="thai" style={{ fontSize: 12, color: 'var(--fg-1)' }}>{name}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{(p * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p * 100}%`, background: c, transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
          </div>
          {/* เดิมเขียนว่า "Monte Carlo · 10,000 รอบ" ทั้งที่ไม่มีการสุ่มใด ๆ ในโค้ด */}
          <div className="thai" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-soft)', fontSize: 12, color: 'var(--warn)' }}>
            น้ำหนักฉากทัศน์เป็นค่าที่กำหนดไว้เพื่อประกอบการอภิปราย ไม่ได้มาจากการจำลองเชิงสถิติ
          </div>
        </div>
      </div>
    </div>
  );
}

window.Module2 = Module2;
