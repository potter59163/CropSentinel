const SOURCES = [
  ['OpenStreetMap', 'พิกัดแปลง', 'เลือก lat/lng ของแปลงจริง ก่อนส่งต่อให้ GISTDA, NASA POWER, Open-Meteo และโมเดลวนเกษตร'],
  ['Google Earth Engine', 'ดาวเทียม', 'Hansen forest loss · ESA WorldCover · Sentinel-2 NDVI เป็น context ป่า/ฟื้นฟู'],
  ['GISTDA', 'ภูมิสารสนเทศ', 'เขตอนุรักษ์ ลำน้ำ ไฟป่า น้ำท่วม ภัยแล้ง และชั้น Disaster Open API'],
  ['NASA POWER', 'ภูมิอากาศ', 'อุณหภูมิ ฝน ฤดูแล้ง ความชื้นดิน แสงอาทิตย์ เป็น feature ของ SDM'],
  ['GBIF', 'ชีววิทยา', 'จุดพบพืชจริง ใช้ฝึก Species Distribution Model รายชนิด'],
  ['ReCorp / Field Pilot', 'องค์ความรู้พื้นที่', 'ราคา ผลผลิต survival rate รูปแบบ farm design และ feedback จากแปลงจริง'],
  ['SoilGrids (ISRIC)', 'ดินจริง', 'pH เนื้อดิน การระบายน้ำ อินทรียวัตถุ ดึงฝั่งเซิร์ฟเวอร์ ใช้ปรับอันดับพืช (เป็นค่าประมาณเชิงพื้นที่ ~250 ม.)'],
  ['LDD / Soil field test', 'ตรวจดินภาคสนาม', 'ผลตรวจ pH/NPK/อินทรียวัตถุจากแปลงจริงเมื่อมี ใช้ยืนยัน/แทนค่า SoilGrids ไม่ claim เป็นผล lab ถ้ายังไม่ได้ตรวจ'],
];

export function Methodology() {
  return (
    <div className="method">
      <h2 className="thai">แหล่งข้อมูลและบทบาท</h2>
      <div className="method-grid">
        {SOURCES.map(([n, tag, d]) => (
          <div key={n} className="method-src">
            <div className="s-tag">{tag}</div>
            <div className="s-name">{n}</div>
            <div className="s-desc thai">{d}</div>
          </div>
        ))}
      </div>

      <h2 className="thai">Production Pipeline</h2>
      <div className="method-pipe">
        {['รับพิกัด + farm design + เป้าหมายรายได้', 'server ดึง GISTDA/NASA/Open-Meteo + satellite context', 'server-side SDM ทำนายความเหมาะสมพืช', 'คำนวณ cashflow/ROI/sensitivity/คาร์บอน/soil proxy', 'ตรวจ guardrail + expert validation status', 'สื่อสารเป็น Farmer mode และ Officer/ReCorp mode'].map((s, i, a) => (
          <span key={s} style={{ display: 'contents' }}>
            <span className="step thai">{i + 1}. {s}</span>{i < a.length - 1 && <span className="arrow">→</span>}
          </span>
        ))}
      </div>

      <h2 className="thai">Model Features</h2>
      <p className="method-note thai">
        โมเดลใช้ climate/elevation, fire hotspot/burn frequency, flood/flood frequency, drought layers และคะแนนระบบวนเกษตร
        เช่น 4 ชั้น ความหลากหลาย ร่มเงา คลุมดิน รายได้ต่อเนื่อง และ disaster buffer
      </p>

      <h2 className="thai">Validation สำหรับใช้จริง</h2>
      <div className="method-note thai">
        • ข้อมูลแนะนำเริ่มจาก <b>model_suggested</b> แล้วให้ ReCorp/ผู้เชี่ยวชาญปรับเป็น <b>expert_confirmed</b>, <b>needs_review</b>, หรือ <b>not_recommended</b><br />
        • ระบบแสดง sensitivity ราคา -30% / base / +30% เพราะราคาพืชผันผวนสูง<br />
        • ดินใช้ข้อมูลจริงจาก SoilGrids (pH เนื้อดิน การระบายน้ำ อินทรียวัตถุ) ปรับอันดับพืชแบบ guardrail — เป็นค่าประมาณเชิงพื้นที่ ~250 ม. ควรยืนยันด้วยชุดตรวจดินจริงก่อนลงทุน<br />
        • เป้าหมาย pilot คือทดสอบกับ 30 แปลงตัวอย่าง และลงพื้นที่ 5-10 แปลงเพื่อเก็บ feedback จริง
      </div>
    </div>
  );
}
