import model from '../data/sdm_model.json';
import sat from '../data/nan_satellite.json';
import { PLANTS } from '../data/plants';

const M = model as any;
const nameTh = (id: string) => PLANTS.find((p) => p.sdmId === id)?.nameTh ?? id;

const SOURCES = [
  ['Google Earth Engine', 'ดาวเทียม', 'Hansen Global Forest Change (ป่าหายรายปี) · ESA WorldCover 2021 (ประเภทที่ดิน) · Sentinel-2 (NDVI) — ดึงทั้งจังหวัดน่านเป็น grid'],
  ['GISTDA', 'ภูมิสารสนเทศ', 'เขตอนุรักษ์ + แม่น้ำ + FR_Fire ArcGIS + Disaster Open API (VIIRS, flood, burn scar/frequency, DRIPlus/NDWI/SMAP) — ตรวจแปลงอยู่ใน/ใกล้พื้นที่เสี่ยงและภัยจากดาวเทียม'],
  ['NASA POWER', 'ภูมิอากาศ', 'Climatology รายเดือน → อุณหภูมิ ฝน ฤดูแล้ง ความชื้นดิน — เป็น feature ของโมเดล'],
  ['GBIF', 'ชีววิทยา', 'จุดพบพืชจริงทั่วโลก (taxonKey) — ใช้เป็น label ฝึกโมเดล SDM'],
  ['Open-Meteo', 'ภูมิประเทศ', 'ระดับความสูง (DEM) รายพิกัด'],
  ['OAE / DOA (อ้างอิง)', 'เศรษฐกิจ', 'ผลผลิต/ราคา/ต้นทุน — ค่าประมาณการจากเอกสารราชการ (ไม่ใช่ real-time)'],
];

export function Methodology() {
  const species = Object.entries(M.species ?? {}) as Array<[string, any]>;
  const reliable = species.filter(([, s]) => s.auc >= 0.65);
  const weak = species.filter(([, s]) => s.auc < 0.65);
  const cells = (sat as any).cells?.length ?? 0;
  const loss = (sat as any).cells?.filter((c: any) => c.lossyr).length ?? 0;
  return (
    <div className="method">
      <h2 className="thai">แหล่งข้อมูล (จริงทั้งหมด)</h2>
      <div className="method-grid">
        {SOURCES.map(([n, tag, d]) => (
          <div key={n} className="method-src">
            <div className="s-tag">{tag}</div>
            <div className="s-name">{n}</div>
            <div className="s-desc thai">{d}</div>
          </div>
        ))}
      </div>

      <h2 className="thai">ขั้นตอนการทำงาน (Pipeline)</h2>
      <div className="method-pipe">
        {['ดาวเทียม + GISTDA + ภูมิอากาศ + จุดพบพืช', 'ตรวจเขตป่า/ลำน้ำ/ไฟป่า/น้ำท่วม/ภัยแล้ง + สร้าง feature', 'ฝึกโมเดล SDM (logistic)',
          'ให้คะแนนความเหมาะสมรายชนิด', 'ประกอบระบบวนเกษตร 4 ชั้น', 'คำนวณกำไร + คาร์บอน + fire/flood/water/drought buffer → 3 แผน'].map((s, i, a) => (
          <span key={s} style={{ display: 'contents' }}>
            <span className="step thai">{i + 1}. {s}</span>{i < a.length - 1 && <span className="arrow">→</span>}
          </span>
        ))}
      </div>

      <h2 className="thai">โมเดล Species Distribution Model — ความแม่นยำจริง</h2>
      <p className="method-note thai">
        ประเภท: <b>Binary classification (logistic regression)</b> · feature {M.features?.length ?? '—'} ตัว
        ({(M.base ?? []).join(', ')} + พจน์กำลังสอง) · วัดด้วย <b>5-fold cross-validated ROC-AUC</b> ·
        เทียบ benchmark กับ Gradient Boosting · ใช้โมเดลจัดอันดับเฉพาะชนิดที่ <b>AUC ≥ 0.65</b>
      </p>
      <p className="method-note thai">
        Reliable SDM <b>{reliable.length}</b> ชนิด · AUC เฉลี่ย <b>{(reliable.reduce((s, [, v]) => s + v.auc, 0) / Math.max(1, reliable.length)).toFixed(2)}</b>
        {weak.length ? <> · Weak model <b>{weak.length}</b> ชนิด ({weak.map(([id]) => nameTh(id)).join(', ')}) จะ fallback เป็นเกณฑ์พื้นที่/ความสูง</> : null}
      </p>
      <div className="method-table-wrap">
        <table className="method-tbl">
          <thead><tr><th className="thai">ไม้ยืนต้น</th><th>จุดฝึก (GBIF)</th><th>AUC (logistic)</th><th></th><th>AUC (GBM)</th></tr></thead>
          <tbody>
            {species.sort((a, b) => b[1].auc - a[1].auc).map(([id, s]) => (
              <tr key={id}>
                <td className="thai">{nameTh(id)}</td>
                <td className="num">{s.n}</td>
                <td className="num" style={{ color: s.auc >= 0.82 ? 'var(--ok)' : s.auc >= 0.65 ? 'var(--warn)' : 'var(--risk)' }}>{s.auc.toFixed(2)}</td>
                <td style={{ width: 110 }}><div className="method-bar"><i style={{ width: `${Math.round(s.auc * 100)}%` }} /></div></td>
                <td className="num">{s.aucGBM?.toFixed(2) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="thai">ความครอบคลุมข้อมูลดาวเทียม</h2>
      <p className="method-note thai">
        วิเคราะห์จังหวัดน่านเป็น grid <b>{cells.toLocaleString()}</b> จุด (≈5.5 กม.) ·
        ตรวจพบพื้นที่ <b>ป่าหายในอดีต {loss.toLocaleString()}</b> จุด (Hansen) ที่เป็นเป้าหมายฟื้นฟูด้วยวนเกษตร
      </p>

      <h2 className="thai">ข้อจำกัด (พูดตรงไปตรงมา)</h2>
      <div className="method-note thai">
        • ความเหมาะสมไม้ยืนต้น = โมเดลจริงเฉพาะชนิดที่ AUC ≥ 0.65; ชนิดที่ต่ำกว่านี้และพืชชั้นล่าง (พุ่ม/คลุมดิน/หัว) ใช้เกณฑ์ช่วงความสูง + water fit จากภูมิอากาศ<br />
        • ผลผลิต/ราคา/ต้นทุน เป็นค่าประมาณการ (ไม่มี API ราคาพืชไทยเรียลไทม์ฟรี) — ใช้ช่วยเปรียบเทียบ ไม่ใช่ตัวเลขรับประกัน<br />
        • คาร์บอนเป็นค่าประเมินจากงานวิจัย (tCO₂e/ไร่/ปี) · soil ตัดออกจากโมเดลเพราะ SoilGrids เข้าถึงจากเบราว์เซอร์ไม่ได้ (รักษาความสอดคล้อง train/runtime)<br />
        • ควรตรวจสอบภาคสนาม + ปรึกษาเกษตรอำเภอก่อนลงมือจริง
      </div>
    </div>
  );
}
