import { Icon, type IconName } from './Icon';

const FLOW: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'crosshair',
    title: 'รับข้อมูลแปลง',
    body: 'ใช้ขนาดแปลง พิกัด ความสูง พืชเดิม พืชที่อยากปลูก และเป้าหมายรายได้เป็นจุดตั้งต้น',
  },
  {
    icon: 'shield',
    title: 'ตรวจพื้นที่ก่อนแนะนำ',
    body: 'เช็กข้อจำกัดและความเสี่ยง เช่น เขตป่า ลำน้ำ ไฟป่า น้ำท่วม ภัยแล้ง ดิน และภูมิอากาศ',
  },
  {
    icon: 'sprout',
    title: 'ออกแบบแผนที่ใช้คุยต่อได้',
    body: 'เสนอ 3 แผนวนเกษตร พร้อม cashflow, ROI, ความเสี่ยง, คาร์บอน และเหตุผลว่าแผนไหนเหมาะกว่า',
  },
];

const OUTPUTS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'target', title: 'อันดับแผน', body: 'จัดอันดับจากกำไร ความเหมาะสมพืช ความเสี่ยง GISTDA โครงสร้างวนเกษตร และคาร์บอน' },
  { icon: 'carbon', title: 'ตัวเลขเศรษฐกิจ', body: 'แยกกำไรจากสินค้าเกษตรออกจากมูลค่าระบบนิเวศ และดูกรณีราคาลด/เพิ่มได้' },
  { icon: 'edit', title: 'ปรับสมมติฐานได้', body: 'ราคา ผลผลิต ต้นทุน และอัตรารอดควรแก้ตามข้อมูลจริงของ ReCorp หรือเกษตรกรในพื้นที่' },
];

const GUARDRAILS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'soil', title: 'ดินเป็นตัวช่วยคัดกรอง', body: 'ซ้อนเลเยอร์ LDD กลุ่มชุดดิน จ.น่าน กับ SoilGrids เพื่อคัดกรองข้อจำกัดดิน ไม่ใช่ผลตรวจ lab ของแปลงจริง' },
  { icon: 'warning', title: 'ไม่ใช่ใบรับรองสิทธิ์หรือคาร์บอนเครดิต', body: 'ถ้าใกล้เขตอนุรักษ์ ลำน้ำ หรือมีความเสี่ยงสูง ต้องให้เจ้าหน้าที่/ผู้เชี่ยวชาญตรวจซ้ำ' },
  { icon: 'checkCircle', title: 'ใช้จริงต้องมี feedback ภาคสนาม', body: 'แผนควรถูกยืนยันด้วยข้อมูลแปลงจริง ราคาในพื้นที่ และความเห็นเกษตรกรก่อนลงทุน' },
];

const DATA_USED = [
  'พิกัดและความสูงของแปลง',
  'ภูมิอากาศและฤดูแล้ง',
  'GISTDA: เขตป่า ลำน้ำ ไฟป่า น้ำท่วม ภัยแล้ง',
  'ภาพดาวเทียมและ land cover',
  'LDD กลุ่มชุดดิน จ.น่าน + SoilGrids',
  'ฐานพืช ราคา ผลผลิต และ feedback ภาคสนาม',
];

function Card({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <article className="method-card">
      <span className="method-icon"><Icon name={icon} size={22} /></span>
      <div>
        <h3 className="thai">{title}</h3>
        <p className="thai">{body}</p>
      </div>
    </article>
  );
}

export function Methodology() {
  return (
    <section className="method">
      <div className="method-hero">
        <div>
          <span className="agro-impact-k">ภาพรวม</span>
          <h2 className="thai">ระบบนี้ช่วยตัดสินใจอย่างไร</h2>
          <p className="thai">
            เป้าหมายคือช่วย ReCorp/เจ้าหน้าที่ออกแบบแปลงวนเกษตรที่คุยกับเกษตรกรได้จริง:
            เห็นรายได้ ความเสี่ยง สิ่งที่ต้องตรวจซ้ำ และเหตุผลของแต่ละแผนในหน้าเดียว
          </p>
        </div>
        <div className="method-hero-mark"><Icon name="satellite" size={42} strokeWidth={1.5} /></div>
      </div>

      <div className="method-section">
        <div className="method-section-head">
          <span className="agro-impact-k">3 ขั้นตอน</span>
          <h3 className="thai">จากแปลงจริง ไปสู่แผนปลูก</h3>
        </div>
        <div className="method-flow">
          {FLOW.map((item, index) => (
            <div className="method-flow-item" key={item.title}>
              <span className="method-flow-no">{index + 1}</span>
              <Card {...item} />
            </div>
          ))}
        </div>
      </div>

      <div className="method-section method-split">
        <div>
          <div className="method-section-head">
            <span className="agro-impact-k">ผลลัพธ์</span>
            <h3 className="thai">ผลลัพธ์ควรอ่านแบบนี้</h3>
          </div>
          <div className="method-stack">
            {OUTPUTS.map((item) => <Card key={item.title} {...item} />)}
          </div>
        </div>

        <div>
          <div className="method-section-head">
            <span className="agro-impact-k">ขอบเขตการใช้</span>
            <h3 className="thai">สิ่งที่ต้องรู้ก่อนใช้จริง</h3>
          </div>
          <div className="method-stack">
            {GUARDRAILS.map((item) => <Card key={item.title} {...item} />)}
          </div>
        </div>
      </div>

      <details className="method-details">
        <summary className="thai">
          <Icon name="info" size={18} />
          ข้อมูลที่ระบบใช้
        </summary>
        <div className="method-data-list">
          {DATA_USED.map((item) => <span key={item} className="thai">{item}</span>)}
        </div>
        <p className="thai">
          รายละเอียดเชิงลึกของโมเดลและแหล่งข้อมูลควรอยู่ในรายงานประกอบหรือมุมมองเจ้าหน้าที่
          ไม่จำเป็นต้องให้เกษตรกรอ่านทั้งหมดในหน้าหลัก
        </p>
      </details>
    </section>
  );
}
