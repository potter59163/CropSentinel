import { useState } from 'react';
import { useData } from '../data/store';
import type { Alert } from '../data/types';
import { Card, Chip, Stat, Bars } from '../components/ui';
import { compass, compassTh } from '../lib/geo';
import { nf0 } from '../lib/format';

// ── burned-area growth chart (rai vs hour) ──────────────────────────────────
function SpreadChart() {
  const { sim } = useData();
  const W = 720, H = 250, padL = 52, padR = 16, padT = 18, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const data = sim.fronts.map((f) => f.areaRai);
  const xs = sim.fronts.map((f) => f.hour);
  const yMax = Math.ceil(Math.max(...data) / 500) * 500 || 500;
  const x = (i: number) => padL + (i / (data.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const [hover, setHover] = useState<number | null>(null);

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(data.length - 1, Math.round((px - padL) / plotW * (data.length - 1)))));
        }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="spreadGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--risk)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--risk)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" className="axis-txt">{t.toLocaleString()}</text>
          </g>
        ))}
        <text x={padL - 34} y={padT + 6} className="axis-txt" transform={`rotate(-90 ${padL - 34} ${padT + 6})`}>RAI BURNED</text>
        <path d={`${line} L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="url(#spreadGrad)" />
        <path d={line} fill="none" stroke="var(--risk)" strokeWidth="2.4" />
        {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} fill="var(--risk)" stroke="var(--bg-0)" strokeWidth="2" />)}
        {xs.map((h, i) => <text key={h} x={x(i)} y={H - padB + 16} textAnchor="middle" className="axis-txt">+{h}ชม.</text>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--fg-0)" strokeOpacity="0.3" />}
      </svg>
      {hover !== null && (
        <div className="chart-tt" style={{ left: `${(x(hover) / W) * 100}%`, top: 10, transform: hover > data.length - 3 ? 'translateX(-105%)' : 'translateX(10px)' }}>
          <div className="row space-between"><span className="k">เวลา</span><span className="v">+{xs[hover]} ชม.</span></div>
          <div className="row space-between"><span className="k">พื้นที่ไหม้</span><span className="v" style={{ color: 'var(--risk)' }}>{nf0(data[hover])} ไร่</span></div>
        </div>
      )}
    </div>
  );
}

// ── compass + ellipse showing fire bearing & shape ──────────────────────────
function CompassRose() {
  const { sim, province } = useData();
  const cx = 90, cy = 90, R = 70;
  const theta = (sim.bearingDeg - 90) * Math.PI / 180; // SVG 0° = east
  const ax = cx + Math.cos(theta) * R;
  const ay = cy + Math.sin(theta) * R;
  // ellipse proportions: length along bearing, width = length / lwRatio
  const len = 56, wid = len / sim.lwRatio;
  return (
    <div className="compass-wrap">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={R * 0.6} fill="none" stroke="var(--line-soft)" strokeWidth="0.5" />
        {['N', 'E', 'S', 'W'].map((d, i) => {
          const a = (i * 90 - 90) * Math.PI / 180;
          return <text key={d} x={cx + Math.cos(a) * (R + 10)} y={cy + Math.sin(a) * (R + 10) + 3} textAnchor="middle" className="axis-txt">{d}</text>;
        })}
        {/* wind-aligned ellipse */}
        <g transform={`translate(${cx} ${cy}) rotate(${sim.bearingDeg})`}>
          <ellipse cx={0} cy={-(len - wid) / 2} rx={wid} ry={len} fill="var(--risk)" fillOpacity="0.18" stroke="var(--risk)" strokeOpacity="0.7" />
        </g>
        {/* bearing arrow */}
        <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="var(--crit)" strokeWidth="2.4" />
        <circle cx={cx} cy={cy} r="4" fill="var(--crit)" />
      </svg>
      <div className="compass-info">
        <div><span className="ci-k thai">ทิศหัวไฟ</span><span className="ci-v">{Math.round(sim.bearingDeg)}° {compass(sim.bearingDeg)}</span></div>
        <div className="thai ci-sub">ไฟลามไปทาง{compassTh[compass(sim.bearingDeg)]}</div>
        <div><span className="ci-k thai">ลม</span><span className="ci-v">{province.weather.windSpeedKmh} กม./ชม.</span></div>
        <div><span className="ci-k thai">รูปไฟ L:W</span><span className="ci-v">{sim.lwRatio.toFixed(1)} : 1</span></div>
      </div>
    </div>
  );
}

// ── 8-week fire-risk + PM2.5 forecast ───────────────────────────────────────
function ForecastChart() {
  const { forecast } = useData();
  const W = 720, H = 230, padL = 44, padR = 44, padT = 18, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (i: number) => padL + (i / (forecast.weeks.length - 1)) * plotW;
  const yRisk = (v: number) => padT + plotH - (v / 100) * plotH;
  const pmMax = Math.max(...forecast.pm25, 100);
  const yPm = (v: number) => padT + plotH - (v / pmMax) * plotH;
  const riskLine = forecast.fireRiskIdx.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yRisk(v)}`).join(' ');
  const pmLine = forecast.pm25.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yPm(v)}`).join(' ');
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={yRisk(t)} y2={yRisk(t)} stroke="var(--line-soft)" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={padL - 8} y={yRisk(t) + 3} textAnchor="end" className="axis-txt">{t}</text>
          </g>
        ))}
        <path d={`${riskLine} L ${x(7)} ${yRisk(0)} L ${x(0)} ${yRisk(0)} Z`} fill="var(--risk)" opacity="0.12" />
        <path d={riskLine} fill="none" stroke="var(--risk)" strokeWidth="2.4" />
        {forecast.fireRiskIdx.map((v, i) => <circle key={i} cx={x(i)} cy={yRisk(v)} r="3" fill="var(--risk)" />)}
        <path d={pmLine} fill="none" stroke="oklch(0.6 0.18 330)" strokeWidth="1.8" strokeDasharray="4 3" />
        {forecast.weeks.map((w, i) => <text key={w} x={x(i)} y={H - padB + 16} textAnchor="middle" className="axis-txt">{w}</text>)}
        <g transform={`translate(${padL}, ${padT - 4})`}>
          <rect width="12" height="2" y="4" fill="var(--risk)" /><text x="18" y="8" className="axis-txt">FIRE RISK INDEX</text>
          <rect width="12" height="2" y="4" x="150" fill="oklch(0.6 0.18 330)" /><text x="168" y="8" className="axis-txt">PM2.5 μg/m³</text>
        </g>
      </svg>
    </div>
  );
}

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  return (
    <div className={`alert ${alert.level}`}>
      <div className="h">
        <span className={`chip ${alert.level === 'crit' ? 'risk' : alert.level}`}><span className="dot" />{alert.tag}</span>
        <button className="dismiss" onClick={() => onDismiss(alert.id)} title="Dismiss">✕</button>
      </div>
      <div className="title thai">{alert.title}</div>
      <div className="alert-en">{alert.titleEn}</div>
      <div className="body thai">{alert.body}</div>
      <div className="conf">
        <span>ความเชื่อมั่น</span>
        <div className="bar"><div className="fill" style={{ width: `${alert.confidence * 100}%` }} /></div>
        <span style={{ color: 'var(--fg-1)' }}>{Math.round(alert.confidence * 100)}%</span>
      </div>
    </div>
  );
}

export function Module2Predict() {
  const { sim, alerts: allAlerts, province, forecast } = useData();
  const [alerts, setAlerts] = useState(allAlerts);
  const dismiss = (id: string) => setAlerts((a) => a.filter((x) => x.id !== id));

  return (
    <div className="grid mod2-layout">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-3">
          <Stat label="ความเร็วหัวไฟ" value={Math.round(sim.rosHead)} unit="ม./นาที" delta={`ลม ${province.weather.windSpeedKmh} กม./ชม.`} deltaKind="negative" />
          <Stat label={`พื้นที่ไหม้ใน ${sim.horizonH} ชม.`} value={nf0(sim.finalAreaRai)} unit="ไร่" delta={`จาก${sim.originLabelTh}`} deltaKind="negative" />
          <Stat label="ทิศหัวไฟ" value={`${Math.round(sim.bearingDeg)}°`} delta={`ไปทาง${compassTh[compass(sim.bearingDeg)]}`} deltaKind="neutral" />
        </div>

        <Card title="จำลองการลามของไฟ" titleEn="Fire-spread simulation"
          right={<Chip kind="data">Rothermel-lite</Chip>}>
          <div className="spread-layout">
            <CompassRose />
            <div style={{ flex: 1, minWidth: 0 }}>
              <SpreadChart />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Bars rows={[
              ['ลม (wind)', Math.min(1, sim.drivers.wind / 4), 'var(--risk)'],
              ['ความชัน (slope)', Math.min(1, (sim.drivers.slope - 1) / 1.7), 'var(--warn)'],
              ['เชื้อเพลิง (fuel)', Math.min(1, (sim.drivers.fuel - 0.55) / 0.9), 'oklch(0.72 0.16 70)'],
              ['ความแห้ง (dryness)', Math.min(1, (sim.drivers.dryness - 0.6) / 0.9), 'oklch(0.6 0.18 330)'],
            ]} />
          </div>
        </Card>

        <Card title="พยากรณ์ความเสี่ยงไฟ + หมอกควัน — 8 สัปดาห์" titleEn="Fire & haze forecast"
          right={<Chip kind="warn">ฤดูไฟ</Chip>}>
          <ForecastChart />
        </Card>

        <Card title="ความเชื่อมั่นของโมเดล" titleEn="Model confidence" right={<span className="sub">Ensemble · 4 models</span>}>
          <div className="grid grid-4">
            {[
              ['Hotspot Detect', 0.94, 'var(--ok)'],
              ['Spread (ROS)', 0.81, 'var(--data)'],
              ['PM2.5 Dispersion', 0.78, 'var(--warn)'],
              ['Encroachment CV', 0.73, 'var(--warn)'],
            ].map(([name, v, c]) => (
              <div key={name as string} style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 6 }}>
                <div className="metric-k">{name}</div>
                <div style={{ fontSize: 18, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: 2 }}>{Math.round((v as number) * 100)}%</div>
                <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v as number) * 100}%`, background: c as string }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title="การแจ้งเตือนความเสี่ยง" titleEn="Risk alerts"
          right={<span className="sub">{alerts.length} รายการ</span>}>
          {alerts.length === 0 && <div className="thai empty-note">ปิดการแจ้งเตือนทั้งหมดแล้ว</div>}
          {alerts.map((a) => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)}
        </Card>

        <Card title="ความน่าจะเป็นของสถานการณ์" titleEn="Scenarios" right={<span className="sub">48 ชม.ข้างหน้า</span>}>
          <Bars rows={[
            ['ไฟลุกลามตามลมเข้าเขตป่า', 0.44, 'var(--risk)'],
            ['ไฟกระโดดข้ามแนวกันไฟ', 0.21, 'var(--crit)'],
            ['ควบคุมได้ในแนวที่วางไว้', 0.20, 'var(--ok)'],
            ['ลมเปลี่ยนทิศกะทันหัน', 0.15, 'var(--warn)'],
          ]} />
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-soft)', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            Monte Carlo · ลม ±20° · ROS ±15% · {forecast.weeks.length} สัปดาห์ฉาย
          </div>
        </Card>
      </div>
    </div>
  );
}
