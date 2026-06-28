import { useEffect, useState } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useData } from '../data/store';
import { CHIANG_MAI_CENTER } from '../data/districts';
import type { District } from '../data/types';
import { riskHex, riskChipClass } from '../lib/risk';
import { Card, Chip, Stat, Sparkline } from '../components/ui';
import { nf0 } from '../lib/format';

type Layer = 'hotspots' | 'dryness' | 'maize' | 'spread';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string) || undefined;

function drynessHex(v: number): string {
  if (v >= 0.8) return '#e5484d';
  if (v >= 0.6) return '#f4763b';
  if (v >= 0.4) return '#f5c84b';
  return '#3ecf8e';
}
function hotspotHex(frp: number): string {
  if (frp >= 20) return '#ff3b30';
  if (frp >= 6) return '#ff7a1a';
  return '#ffd60a';
}

/** Imperatively manage google.maps overlays for the active layer. */
function Overlays({ layer, onPick }: { layer: Layer; onPick: (d: District) => void }) {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  const { districts, hotspots, sim } = useData();

  useEffect(() => {
    if (!map || !maps) return;
    const objs: Array<google.maps.Circle | google.maps.Polygon> = [];

    const circle = (opts: google.maps.CircleOptions, d?: District) => {
      const c = new maps.Circle(opts);
      c.setMap(map);
      if (d) c.addListener('click', () => onPick(d));
      objs.push(c);
    };

    if (layer === 'hotspots' || layer === 'spread') {
      for (const h of hotspots) {
        circle({
          center: { lat: h.lat, lng: h.lng },
          radius: 300 + Math.min(h.frp, 40) * 70,
          strokeWeight: 0, fillColor: hotspotHex(h.frp),
          fillOpacity: h.daynight === 'D' ? 0.7 : 0.55, clickable: false,
        });
      }
    }

    if (layer === 'spread') {
      // draw outer fronts first so inner ones layer on top
      [...sim.fronts].reverse().forEach((f) => {
        const poly = new maps.Polygon({
          paths: f.ring.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: '#ff5b2e', strokeOpacity: 0.85, strokeWeight: 1.2,
          fillColor: f.hour <= 2 ? '#ff3b30' : f.hour <= 4 ? '#ff7a1a' : '#ffb020',
          fillOpacity: 0.16, clickable: false,
        });
        poly.setMap(map);
        objs.push(poly);
      });
      // ignition point — concentric circles (Marker lives in the 'marker'
      // library + needs a Map ID, so a Circle keeps this dependency-free)
      circle({ center: sim.origin, radius: 1100, strokeColor: '#ffffff', strokeOpacity: 0.9, strokeWeight: 1.4, fillColor: '#ff2d2d', fillOpacity: 0.9 });
      circle({ center: sim.origin, radius: 2600, strokeColor: '#ff2d2d', strokeOpacity: 0.7, strokeWeight: 1, fillColor: '#ff2d2d', fillOpacity: 0.12 });
    }

    if (layer === 'dryness' || layer === 'maize' || layer === 'hotspots') {
      for (const d of districts) {
        if (layer === 'maize') {
          circle({
            center: { lat: d.lat, lng: d.lng },
            radius: 1500 + Math.sqrt(d.maizeAreaRai) * 22,
            strokeColor: '#caa83a', strokeOpacity: 0.6, strokeWeight: 1,
            fillColor: '#d9b441', fillOpacity: 0.28,
          }, d);
        } else if (layer === 'dryness') {
          circle({
            center: { lat: d.lat, lng: d.lng },
            radius: 4200, strokeWeight: 0,
            fillColor: drynessHex(d.dryness), fillOpacity: 0.35,
          }, d);
        } else {
          circle({
            center: { lat: d.lat, lng: d.lng },
            radius: 3600, strokeColor: riskHex[d.fireRisk], strokeOpacity: 0.9, strokeWeight: 1.6,
            fillColor: riskHex[d.fireRisk], fillOpacity: 0.1,
          }, d);
        }
      }
    }

    return () => objs.forEach((o) => o.setMap(null));
  }, [map, maps, layer, districts, hotspots, sim, onPick]);

  return null;
}

function MapPanel() {
  const { province } = useData();
  const [layer, setLayer] = useState<Layer>('hotspots');
  const [picked, setPicked] = useState<District | null>(null);

  const layers: Array<[Layer, string]> = [
    ['hotspots', 'จุดความร้อน'], ['spread', 'จำลองไฟลาม'], ['dryness', 'ความแห้ง'], ['maize', 'ข้าวโพด'],
  ];

  return (
    <div className="map-wrap">
      <APIProvider apiKey={API_KEY}>
        <Map
          mapId={MAP_ID}
          defaultCenter={CHIANG_MAI_CENTER}
          defaultZoom={9}
          mapTypeId="terrain"
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className="gmap"
        >
          <Overlays layer={layer} onPick={setPicked} />
        </Map>
      </APIProvider>

      <div className="map-toolbar">
        <div className="toggle-group">
          {layers.map(([id, label]) => (
            <button key={id} className={layer === id ? 'on' : ''} onClick={() => setLayer(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="map-crosshair">{province.lat.toFixed(3)}°N · {province.lng.toFixed(3)}°E · TERRAIN</div>

      <div className="map-legend">
        {layer === 'hotspots' && (<>
          <div><span className="sw" style={{ background: hotspotHex(25) }} /> FRP สูง &gt;20 MW</div>
          <div><span className="sw" style={{ background: hotspotHex(10) }} /> ปานกลาง</div>
          <div><span className="sw" style={{ background: hotspotHex(2) }} /> ต่ำ · วงรอบ = ความเสี่ยงอำเภอ</div>
        </>)}
        {layer === 'spread' && (<>
          <div><span className="sw" style={{ background: '#ff3b30' }} /> <span className="thai">0–2 ชม.</span></div>
          <div><span className="sw" style={{ background: '#ff7a1a' }} /> <span className="thai">2–4 ชม.</span></div>
          <div><span className="sw" style={{ background: '#ffb020' }} /> <span className="thai">4–6 ชม.</span></div>
        </>)}
        {layer === 'dryness' && (<>
          <div><span className="sw" style={{ background: drynessHex(0.85) }} /> <span className="thai">แห้งจัด</span></div>
          <div><span className="sw" style={{ background: drynessHex(0.5) }} /> <span className="thai">ปานกลาง</span></div>
          <div><span className="sw" style={{ background: drynessHex(0.2) }} /> <span className="thai">ชื้น</span></div>
        </>)}
        {layer === 'maize' && <div><span className="sw" style={{ background: '#d9b441' }} /> <span className="thai">ขนาดวง = พื้นที่ปลูกข้าวโพด</span></div>}
      </div>

      {picked && <DistrictPopup d={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}

function DistrictPopup({ d, onClose }: { d: District; onClose: () => void }) {
  return (
    <div className="zone-popup" style={{ top: 60, right: 16 }}>
      <button className="close" onClick={onClose}>✕</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>{d.name}</div>
          <div className="thai" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{d.nameTh}</div>
        </div>
        <span className={`chip ${riskChipClass[d.fireRisk]}`} style={{ marginLeft: 'auto' }}><span className="dot" />{d.fireRisk}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        <Metric k="จุดความร้อน" v={`${d.hotspots}`} sub={`FRP ${nf0(d.frpSum)} MW`} />
        <Metric k="ความแห้ง" v={`${Math.round(d.dryness * 100)}%`} sub={d.dryness > 0.7 ? 'แห้งจัด' : 'เฝ้าระวัง'} />
        <Metric k="NDVI" v={d.ndvi.toFixed(2)} sub={d.forestType} />
        <Metric k="ความชัน" v={`${d.slopeDeg}°`} sub={`สูง ${nf0(d.elevationM)} ม.`} />
        <Metric k="ข้าวโพด" v={`${nf0(Math.round(d.maizeAreaRai / 1000))}k`} sub="ไร่" />
        <Metric k="บุกรุกป่า" v={`${nf0(d.encroachmentRai)}`} sub="ไร่" />
      </div>
      <div className="thai" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line-soft)', fontSize: 11, color: 'var(--fg-3)' }}>
        VIIRS Suomi-NPP / NOAA-20 · เชื้อเพลิง {d.forestType}
      </div>
    </div>
  );
}

function Metric({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div style={{ padding: 8, background: 'var(--bg-1)', borderRadius: 6 }}>
      <div className="metric-k">{k}</div>
      <div className="metric-v">{v}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

export function Module1Map() {
  const { province: P, districts, sources, forecast } = useData();
  return (
    <div className="grid mod1-layout">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card pad={false}
          title="แผนที่ไฟป่าจังหวัดเชียงใหม่" titleEn="Wildfire Map"
          sub="Google Maps · VIIRS · GISTDA FAIPA feed"
          right={<Chip kind="data">LIVE</Chip>}>
          <div style={{ padding: 12 }}>
            {API_KEY ? <MapPanel /> : (
              <div className="map-missing thai">ยังไม่ได้ตั้งค่า VITE_GOOGLE_MAPS_API_KEY ใน .env</div>
            )}
          </div>
        </Card>

        <Card title="ข้อมูลรายอำเภอ" titleEn="District breakdown" right={<span className="sub">{districts.length} อำเภอ</span>}>
          <table className="tbl">
            <thead>
              <tr><th className="thai">อำเภอ</th><th>NDVI</th><th className="thai">ความแห้ง</th><th className="thai">จุดร้อน</th><th>PM2.5</th><th className="thai">ข้าวโพด</th><th className="thai">ความเสี่ยง</th></tr>
            </thead>
            <tbody>
              {[...districts].sort((a, b) => b.frpSum - a.frpSum).map((d) => (
                <tr key={d.id}>
                  <td><div>{d.name}</div><div className="thai" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{d.nameTh}</div></td>
                  <td className="mono">{d.ndvi.toFixed(2)}</td>
                  <td className="mono" style={{ color: drynessHex(d.dryness) }}>{Math.round(d.dryness * 100)}%</td>
                  <td className="mono">{d.hotspots}</td>
                  <td className="mono">{d.pm25}</td>
                  <td className="mono">{nf0(Math.round(d.maizeAreaRai / 1000))}k</td>
                  <td><span className={`chip ${riskChipClass[d.fireRisk]}`}><span className="dot" />{d.fireRisk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-2">
          <Stat label="จุดความร้อน VIIRS" value={P.totalHotspots} unit="จุด" delta={`FRP รวม ${nf0(P.totalFrp)} MW`} deltaKind="negative">
            <Sparkline data={P.fireTrend} color="var(--risk)" />
          </Stat>
          <Stat label="ความแห้งเฉลี่ย" value={`${Math.round(P.avgDryness * 100)}`} unit="%" delta="ฤดูไฟ ก.พ.–เม.ย." deltaKind="negative" />
          <Stat label="NDVI เฉลี่ย" value={P.avgNdvi.toFixed(2)} delta="พืชพรรณ/ความเขียวป่า" deltaKind="neutral" />
          <Stat label="PM2.5" value={P.pm25} unit="μg/m³" delta="จากการเผาในที่โล่ง" deltaKind="negative">
            <Sparkline data={forecast.pm25} color="oklch(0.6 0.18 330)" />
          </Stat>
        </div>

        <Card title="แหล่งข้อมูล" titleEn="Data sources" right={<span className="sub">{sources.length} แหล่ง</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sources.map((s) => (
              <div key={s.name} className="row" style={{ fontSize: 12 }}>
                <span className={`chip ${s.status === 'ok' ? 'ok' : s.status === 'warn' ? 'warn' : 'risk'}`}><span className="dot" />{s.status.toUpperCase()}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--fg-0)', fontSize: 12 }}>{s.name}</div>
                  <div className="thai" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{s.desc}</div>
                </div>
                <div className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{s.ago}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
