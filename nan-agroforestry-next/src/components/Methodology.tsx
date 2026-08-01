import { Icon, type IconName } from './Icon';
import { modelMeta, speciesReliability } from '../lib/suitability';
import { PLANTS } from '../data/plants';

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
    body: 'เสนอ 3 แผนวนเกษตร พร้อม cashflow, ROI, ความเสี่ยง และเหตุผลว่าแผนไหนเหมาะกว่า',
  },
];

const OUTPUTS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'target', title: 'อันดับแผน', body: 'จัดอันดับจากกำไร ความเหมาะสมพืช ความเสี่ยง GISTDA โครงสร้างวนเกษตร และความเป็นไม้ยืนยาว' },
  { icon: 'target', title: 'ตัวเลขเศรษฐกิจ', body: 'กำไรจากผลผลิตที่ขายได้จริง และดูกรณีราคาลด/เพิ่มได้ — ไม่รวมมูลค่าที่ขายไม่ได้' },
  { icon: 'edit', title: 'ปรับสมมติฐานได้', body: 'ราคา ผลผลิต ต้นทุน และอัตรารอดควรแก้ตามข้อมูลจริงของ RECOFTC หรือเกษตรกรในพื้นที่' },
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

const NICHE_TIERS = [
  {
    key: 'narrow',
    maxBand: 800,
    th: 'ภูมิอากาศทำนายได้ดี',
    desc: 'พืชที่ขึ้นได้ในช่วงความสูงแคบ — โมเดลชี้ตำแหน่งที่เหมาะได้ชัด',
    cls: 'ok',
  },
  {
    key: 'mid',
    maxBand: 1000,
    th: 'ทำนายได้พอใช้',
    desc: 'ช่วงกว้างปานกลาง ควรดูประกอบกับสภาพดินและน้ำของแปลงจริง',
    cls: 'warn',
  },
  {
    key: 'wide',
    maxBand: Infinity,
    th: 'ต้องใช้กฎเกษตรช่วย',
    desc: 'พืชทนช่วงกว้างมาก ภูมิอากาศแยกไม่ออก — ระบบใช้เกณฑ์ความสูงและกฎดิน/ร่มเงาจัดอันดับ',
    cls: 'data',
  },
] as const;

/**
 * Honest model-quality section.
 *
 * Crops are grouped by NICHE BREADTH (elevation tolerance from plants.ts), deliberately NOT
 * by the shipped model's per-species AUC. Two reasons:
 *
 * 1. Those AUCs are not trustworthy. The shipped export reports, per crop, whichever of two
 *    candidate models scored higher on the very folds used to score them, and several rest on
 *    tiny samples — it claims galangal 0.923 from 22 occurrence records, taro 0.921 and chili
 *    0.936, where an honest re-measurement with region-matched background and nested
 *    selection gives 0.680, 0.641 and 0.694. Rendering them as reliability tiers would have
 *    told a farmer the model is excellent at ข่า and เผือก when those are in fact its weakest
 *    crops — and would have contradicted the explanation printed directly underneath.
 * 2. Niche breadth is structural, independently verifiable from plants.ts, and is what
 *    actually drives the pattern: per-species AUC correlates with elevation tolerance at
 *    r = -0.516. A crop that genuinely grows from 0-1200 m cannot be placed by climate, so a
 *    low score for it is the correct answer rather than a defect.
 *
 * So this section explains WHERE the model has purchase and where the app leans on the
 * elevation envelope and the agronomic rules in engine.ts — which is what an officer needs to
 * be able to say out loud — without republishing figures that are under revision.
 */
function ModelReliability() {
  const meta = modelMeta();
  const modelled = new Set(speciesReliability().map((r) => r.sdmId));
  const bandOf = (p: (typeof PLANTS)[number]) => p.elevMax - p.elevMin;
  const tierOf = (p: (typeof PLANTS)[number]) =>
    NICHE_TIERS.find((t) => bandOf(p) <= t.maxBand)!;

  return (
    <div className="method-section">
      <div className="method-section-head">
        <span className="agro-impact-k">ความน่าเชื่อถือของโมเดล</span>
        <h3 className="thai">โมเดลทำนายพืชไหนได้ดี — และพืชไหนไม่ได้ พูดตรงๆ</h3>
      </div>

      <p className="thai method-reliability-lead">
        ความเหมาะสมของพืชมาจากแบบจำลองการกระจายพันธุ์ (SDM) ที่ตรวจความแม่นด้วยวิธีแบ่งพื้นที่
        เป็นบล็อก (spatial cross-validation) ไม่ใช่การสุ่มธรรมดา — เพื่อไม่ให้คะแนนสูงเกินจริง
        จากการที่จุดฝึกและจุดทดสอบอยู่ติดกัน · <b>คะแนนที่แสดงเป็นดัชนีเปรียบเทียบความเหมาะสม
        ไม่ใช่ความน่าจะเป็นที่จะปลูกสำเร็จ</b> และไม่ได้ปรับเทียบกับผลผลิตจริง
      </p>

      <div className="method-reliability-revision thai">
        <Icon name="warning" size={16} />
        <span>
          <b>ตัวเลขความแม่นยำรายชนิดอยู่ระหว่างปรับแก้:</b> การตรวจสอบภายในพบว่าค่าที่โมเดลชุดนี้
          รายงานไว้สูงเกินจริง เพราะวิธีสุ่มข้อมูลเปรียบเทียบและวิธีเลือกโมเดล เราจึงยัง
          ไม่ประกาศตัวเลขรายชนิดจนกว่าจะวัดใหม่เสร็จ · ตารางด้านล่างจัดกลุ่มด้วย
          <b>ช่วงความสูงที่พืชทนได้</b> ซึ่งตรวจสอบได้ตรงจากฐานข้อมูลพืช และเป็นตัวอธิบาย
          ว่าทำไมโมเดลทำนายบางพืชได้ดีกว่าพืชอื่น
        </span>
      </div>

      <div className="method-reliability">
        {NICHE_TIERS.map((t) => {
          const list = PLANTS.filter((p) => tierOf(p).key === t.key);
          if (!list.length) return null;
          return (
            <div key={t.key} className={`method-tier is-${t.cls}`}>
              <div className="method-tier-head">
                <b className="thai">{t.th}</b>
                <span className="thai">{t.desc}</span>
              </div>
              <div className="method-tier-crops">
                {list.map((p) => (
                  <span key={p.id} className="thai method-tier-crop">
                    {p.nameTh}
                    <i>
                      {`${p.elevMin.toLocaleString('en-US')}–${p.elevMax.toLocaleString('en-US')} ม.`}
                      {modelled.has(p.sdmId ?? '') ? '' : ' · ไม่มีโมเดล'}
                    </i>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="method-reliability-note thai">
        <Icon name="info" size={16} />
        <span>
          <b>ทำไมบางพืชโมเดลทำนายไม่ได้:</b> พืชอย่างเผือก ข่า ตะไคร้ ฟักทอง มันเทศ ปลูกได้จริง
          ตั้งแต่ที่ราบถึงที่สูง (หลายชนิด 0–1,200 ม.) ภูมิอากาศจึงแยกไม่ออกว่าควรอยู่ที่ไหน
          — คะแนนต่ำของพืชกลุ่มนี้คือ<b>คำตอบที่ถูกต้อง</b> ไม่ใช่ข้อบกพร่อง สำหรับพืชกลุ่มนี้
          ระบบใช้เกณฑ์ความสูงและกฎทางเกษตร (การระบายน้ำ ความเป็นกรดของดิน ร่มเงา) จัดอันดับแทน
        </span>
      </div>

      <div className="method-reliability-limits thai">
        <b>ข้อจำกัดที่ยังแก้ไม่ได้ด้วยการปรับโมเดล</b>
        <ul>
          <li>ตารางข้อมูลภูมิอากาศหยาบราว 27 กม. — แยกหุบเขา 400 ม. กับสันเขา 1,400 ม. ไม่ออก</li>
          <li>ข้อมูลจุดพบพืชในน่านมีน้อยมาก จึงเป็นโมเดลระดับภูมิภาคที่นำมาใช้กับน่าน</li>
          <li>ยังไม่เคยตรวจกับผลลัพธ์จากแปลงจริง — ข้อมูลจากการลงพื้นที่จะมีค่ากว่าการปรับโมเดลทุกอย่างรวมกัน</li>
        </ul>
        <span className="method-reliability-src">
          โมเดลเวอร์ชัน {meta.version ?? '—'} · มีโมเดล {meta.count + meta.weakCount} จาก {PLANTS.length} ชนิด
          {meta.validation ? ` · การตรวจความแม่น: ${meta.validation}` : ''}
        </span>
      </div>
    </div>
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
            เป้าหมายคือช่วย RECOFTC/เจ้าหน้าที่ออกแบบแปลงวนเกษตรที่คุยกับเกษตรกรได้จริง:
            เห็นรายได้ ความเสี่ยง สิ่งที่ต้องตรวจซ้ำ และเหตุผลของแต่ละแผนในหน้าเดียว
          </p>
        </div>
        <div className="method-hero-mark"><Icon name="satellite" size={42} strokeWidth={1.5} /></div>
      </div>

      {/* Why carbon is absent. This section exists because the metric WAS here and was
          removed on evidence, and a reviewer who remembers seeing it deserves the reasoning
          rather than silence. Every figure below is sourced; the arithmetic is shown so it
          can be checked. */}
      <div className="method-section">
        <div className="method-section-head">
          <span className="agro-impact-k">ที่ตัดออก</span>
          <h3 className="thai">ทำไมไม่แสดงตัวเลขคาร์บอน</h3>
        </div>
        <p className="thai method-reliability-lead">
          ระบบนี้<b>เคยแสดง</b>คาร์บอนเป็น tCO₂e ต่อปีและมูลค่าคาร์บอนเป็นเงินบาท ตอนนี้เอาออกทั้งหมด
          เพราะตรวจแล้วพบว่า<b>เกษตรกรแปลง 5–15 ไร่ ในน่านขายคาร์บอนเครดิตไม่ได้จริง</b>
          และตัวเลขที่แสดงก็ไม่มีที่มารองรับ
        </p>
        <div className="method-cutlist">
          <div className="method-cut">
            <b className="thai">T-VER ต้องมีพื้นที่ตั้งแต่ 10 ไร่ขึ้นไป</b>
            <span className="thai">
              ผู้ใช้ที่มี 5–9 ไร่ ไม่เข้าเกณฑ์ตั้งแต่ต้น (รวมหลายแปลงได้ แต่ต้องรวมกลุ่ม)
              · ระเบียบวิธี T-VER-P-METH-13-01 และบทความของ อบก. เอง
            </span>
          </div>
          <div className="method-cut">
            <b className="thai">ต้องมีเอกสารสิทธิ์ที่ดินตามกฎหมาย</b>
            <span className="thai">
              ที่ดินในพื้นที่ทำงานของ RECOFTC ในน่านส่วนมากเป็น คทช. ซึ่งยังนับเป็นพื้นที่ป่า
              และน่านมีปัญหาความไม่มั่นคงในสิทธิที่ดิน<b>สูงเป็นอันดับ 3 ของประเทศ</b>
            </span>
          </div>
          <div className="method-cut">
            <b className="thai">ค่าใช้จ่ายปีแรกสูงกว่ารายได้คาร์บอนสิบปี</b>
            <span className="thai">
              ค่าขึ้นทะเบียน 5,000 + ค่ารับรอง 5,000 + ผู้ตรวจสอบภายนอก ~40,000–65,000 บาท
              · เทียบกับกรณีจริงของ อบก. เอง (Green Carbon Bank ขอนแก่น) ที่ได้ 0.366 tCO₂e/ไร่/ปี
              แปลง 10 ไร่ จึงได้ราว 3.7 tCO₂e/ปี หรือ<b>ประมาณ 460 บาท/ปี</b> ที่ราคาเฉลี่ย 125 บาท/tCO₂e
            </span>
          </div>
          <div className="method-cut">
            <b className="thai">RECOFTC ซึ่งเป็นพาร์ตเนอร์ของโครงการนี้ ประกาศเองว่าไม่ทำคาร์บอนเครดิต</b>
            <span className="thai">
              เพราะ “การรับรองและตรวจสอบแพงเกินไป” และ “คาร์บอนเครดิตเอื้อพื้นที่ใหญ่ที่ต่อเนื่องกัน
              และผลักเกษตรกรรายย่อยออกไป” — เป็นจุดยืนของเขาในอำเภอสันติสุข จ.น่าน พื้นที่เดียวกันนี้
            </span>
          </div>
        </div>
        {/* One <span>, not bare text + <b> siblings: .method-reliability-note is a flex row
            built for "icon + paragraph", so multiple top-level children get laid out as
            separate columns and the sentence reads across gaps. */}
        <div className="method-reliability-note thai">
          <span>
            <b>สิ่งที่ยังเหลืออยู่:</b> ระบบยังให้คะแนน “ความเป็นไม้ยืนยาว” ซึ่งวัดว่าแผนสร้างเนื้อไม้ถาวรมากน้อยแค่ไหน
            ใช้<b>เปรียบเทียบระหว่างแผนเท่านั้น ไม่ใช่ปริมาณคาร์บอน</b> และไม่มีการตีเป็นเงิน
            · ประโยชน์ด้านฟื้นดินและยึดหน้าดินของไม้ยืนต้นยังจริงอยู่ แค่ไม่ใช่สิ่งที่ขายได้ตอนนี้
          </span>
        </div>
        <span className="method-reliability-src">
          ที่มา: อบก. (TGO) ระเบียบวิธี T-VER-P-METH-13-01 · บทความ “มีพื้นที่ไม่ถึง 10 ไร่…” ของ อบก.
          · กรมป่าไม้ คู่มือการขอเข้าร่วมโครงการ T-VER (2564) · Thai PBS Policy Watch
          · RECOFTC, Trees4All Thailand
        </span>
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

      <ModelReliability />

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
