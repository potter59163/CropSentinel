// ภารกิจ "วอร์รูมจังหวะเกี่ยว" — Mission Activity Concept Prototype
//
// แกนของภารกิจ: ขอบเขตโครงการชลประทาน "ไม่ตรง" กับขอบเขตอำเภอ
// ถ้าผู้เล่นคิดเป็นรายอำเภอ จะเห็นว่าหนองเสือหนักสุด (21,228 ไร่) แล้วอยากไปแก้ที่นั่น
// แต่คันโยกที่ขยับได้จริงคือรอบส่งน้ำ ซึ่งขยับทั้งโครงการพร้อมกัน —
// รังสิตเหนือกินถึง 5 อำเภอ ส่วนธัญบุรีถูกผ่าออกเป็น 2 โครงการจึงแก้ด้วยคันโยกเดียวไม่ได้
// นี่คือเหตุผลที่ภารกิจนี้ต้องดูแผนที่ ไม่ใช่เรียงตาราง
//
// ทุกตัวเลขฐานมาจากชั้นข้อมูลข้าวรายแปลงของ GISTDA
// ค่าที่เป็นสมมติฐาน (กำลังรับซื้อ, ผลของการรู้วันเกี่ยว) เปิดให้ผู้เล่นปรับได้ทุกตัว
// และติดป้ายบนจอเสมอ เพราะถ้าซ่อนไว้ ผู้เล่นจะเข้าใจว่ามันเป็นค่าที่วัดมา

const { useState: useStateM, useMemo: useMemoM } = React;

const MISSION_STEPS = ['บรีฟ', 'หลักฐาน', 'ตัดสินใจ', 'ผลลัพธ์'];

// ── กติกาการให้คะแนน ────────────────────────────────────────────────────────
// เป้าหมาย: ลดปริมาณข้าวที่ "ค้างคิว" คือมาถึงเกินกว่าที่รับซื้อ/สีได้ในช่วงนั้น
// ข้าวเปียกที่ค้างคิวคือข้าวที่เสียคุณภาพและถูกกดราคา
function evaluatePlan(plan, cfg, projects) {
  const nextWindow = { arrivals: 0, known: 0 };
  const peakWindow = { arrivals: 0, known: 0 };

  projects.forEach((p) => {
    const target = plan.stagger === p.nameTh ? nextWindow : peakWindow;
    target.arrivals += p.peakTonnes;
    if (plan.imaged.includes(p.nameTh)) target.known += p.peakTonnes;
  });

  // การรู้วันเก็บเกี่ยวที่แน่นอนช่วยให้จัดคิวโรงสีล่วงหน้าได้
  // หน้าต่างที่ GISTDA เผยแพร่กว้าง 15 วัน ถ้าไม่รู้ว่าข้าวมาวันไหนในนั้น
  // โรงสีต้องเผื่อคิวไว้ทั้งช่วง ทำให้มีทั้งช่วงที่เครื่องว่างและช่วงที่ข้าวกอง
  const effCap = (w) => {
    const knownShare = w.arrivals > 0 ? w.known / w.arrivals : 0;
    return cfg.capacity * (1 + cfg.schedulingGain * knownShare);
  };

  const queuedPeak = Math.max(0, peakWindow.arrivals - effCap(peakWindow));
  const queuedNext = Math.max(0, nextWindow.arrivals - effCap(nextWindow));

  return {
    queued: Math.round(queuedPeak + queuedNext),
    peak: { ...peakWindow, cap: Math.round(effCap(peakWindow)), queued: Math.round(queuedPeak) },
    next: { ...nextWindow, cap: Math.round(effCap(nextWindow)), queued: Math.round(queuedNext) },
  };
}

// ไล่ทุกทางเลือกที่เป็นไปได้ เพื่อบอกผู้เล่นว่าคำตอบของเขาอยู่อันดับที่เท่าไร
// ไม่ใช่แค่ "ถูก/ผิด" — และเพื่อพิสูจน์ว่าคะแนนดีมาจากหลักเกณฑ์ ไม่ใช่ฟลุก
function enumerateAll(cfg, projects) {
  const names = projects.map((p) => p.nameTh);
  const options = [];
  const staggerChoices = [null, ...names];
  for (const st of staggerChoices) {
    // เลือกถ่ายภาพได้ไม่เกินโควตา รวมทั้งเลือกที่จะไม่ใช้เลย
    const combos = [[]];
    for (let i = 0; i < names.length; i++) {
      combos.push([names[i]]);
      for (let j = i + 1; j < names.length; j++) combos.push([names[i], names[j]]);
    }
    for (const im of combos) {
      if (im.length > cfg.imageQuota) continue;
      options.push({ stagger: st, imaged: im, result: evaluatePlan({ stagger: st, imaged: im }, cfg, projects) });
    }
  }
  options.sort((a, b) => a.result.queued - b.result.queued);
  return options;
}

function MissionMap({ projects, highlight }) {
  const D = window.CS_DATA;
  const active = projects.find((p) => p.nameTh === highlight);
  const shareByAmphoe = {};
  if (active) active.amphoe.forEach((a) => { shareByAmphoe[a.nameTh] = a.rai / active.amphoe[0].rai; });

  return (
    <svg viewBox="0 0 760 480" className="mission-map" role="img"
         aria-label={active ? `แผนที่แสดงอำเภอที่โครงการ${active.nameTh}ครอบคลุม` : 'แผนที่อำเภอจังหวัดปทุมธานี'}>
      <rect width="760" height="480" fill="var(--bg-2)" />
      {D.districts.map((d) => {
        const share = shareByAmphoe[d.nameTh];
        return (
          <polygon key={d.id} points={d.poly}
            fill={share ? `oklch(0.55 0.15 245 / ${(0.2 + share * 0.6).toFixed(2)})` : 'oklch(0.93 0.008 95)'}
            stroke={share ? 'oklch(0.45 0.15 245)' : 'oklch(0.78 0.015 165)'}
            strokeWidth={share ? 2 : 1}
            style={{ transition: 'fill 0.3s, stroke 0.3s' }} />
        );
      })}
      {D.districts.map((d) => {
        const pts = d.poly.split(' ').map((p) => p.split(',').map(Number));
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const inProject = shareByAmphoe[d.nameTh];
        return (
          <text key={d.id + '-t'} x={cx} y={cy} textAnchor="middle" fontSize="12"
                fontFamily="var(--font-thai)" fontWeight={inProject ? 700 : 400}
                fill={inProject ? 'oklch(0.24 0.02 165)' : 'oklch(0.5 0.016 165)'}>
            {d.nameTh}
          </text>
        );
      })}
    </svg>
  );
}

function Mission() {
  const D = window.CS_DATA;
  const M = window.CS_GISTDA.mission;
  const projects = M.projects;

  const [step, setStep] = useStateM(0);
  const [stagger, setStagger] = useStateM(null);
  const [imaged, setImaged] = useStateM([]);
  const [skipped, setSkipped] = useStateM([]);
  const [hover, setHover] = useStateM(null);
  const [capacity, setCapacity] = useStateM(8000);          // ตัน/ครึ่งเดือน — สมมติฐาน
  const [schedulingGain, setSchedulingGain] = useStateM(0.25); // สมมติฐาน
  const [stress, setStress] = useStateM(null);

  const cfg = { capacity, schedulingGain, imageQuota: 2 };
  const stressCfg = {
    cloud: { ...cfg, imageQuota: 2 },
    lowMill: { ...cfg, capacity: Math.round(capacity * 0.7) },
    noGain: { ...cfg, schedulingGain: 0 },
  };

  const plan = { stagger, imaged };
  const result = useMemoM(() => evaluatePlan(plan, cfg, projects), [stagger, imaged, capacity, schedulingGain]);
  const ranking = useMemoM(() => enumerateAll(cfg, projects), [capacity, schedulingGain]);
  const best = ranking[0];
  const doNothing = ranking.find((o) => o.stagger === null && o.imaged.length === 0);
  const rank = ranking.findIndex(
    (o) => o.stagger === stagger && o.imaged.length === imaged.length && o.imaged.every((x) => imaged.includes(x))
  );

  const toggleImaged = (name) => {
    setImaged((cur) => cur.includes(name)
      ? cur.filter((x) => x !== name)
      : cur.length >= cfg.imageQuota ? cur : [...cur, name]);
  };
  const toggleSkip = (name) => {
    setSkipped((cur) => cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]);
  };

  const kt = (t) => `${(t / 1000).toFixed(1)} พันตัน`;

  return (
    <div className="mission">
      <div className="mission-steps" role="tablist" aria-label="ขั้นตอนภารกิจ">
        {MISSION_STEPS.map((s, i) => (
          <button key={s} role="tab" aria-selected={step === i}
                  className={`mission-step ${step === i ? 'on' : ''} ${i < step ? 'done' : ''}`}
                  onClick={() => setStep(i)}>
            <span className="mission-step-n">{i + 1}</span>
            <span className="thai">{s}</span>
          </button>
        ))}
      </div>

      {/* ── 1. บรีฟ ─────────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="card mission-brief">
          <div className="mission-role thai">คุณคือ คณะทำงานความมั่นคงทางอาหาร จังหวัดปทุมธานี</div>
          <h2 className="thai">ข้าวเกือบครึ่งฤดูจะมาถึงพร้อมกันใน 15 วัน</h2>
          <p className="thai">
            ภาพดาวเทียมของ GISTDA เมื่อ {D.province.riceAsOfTh} ชี้ว่าข้าวในจังหวัด{' '}
            <strong>{M.peakTonnes.toLocaleString('th-TH', { maximumFractionDigits: 0 })} ตัน</strong>{' '}
            จะเก็บเกี่ยวพร้อมกันในช่วง <strong>{M.peakWindowTh}</strong> คิดเป็น{' '}
            <strong>{Math.round(M.peakTonnes / (D.province.riceRai * D.province.productKgPerRai[0] / 1000) * 100)}%</strong>{' '}
            ของผลผลิตทั้งฤดู ขณะที่ทั้งจังหวัดมีโรงสีเพียง{' '}
            <strong>{D.province.mills.inProvince.length} แห่ง</strong>
          </p>
          <p className="thai">
            ข้าวเปียกที่ค้างคิวรอสีเกิน 3-4 วันจะเริ่มเสียคุณภาพและถูกกดราคา
            ภารกิจของคุณคือ <strong>ลดปริมาณข้าวที่ค้างคิวให้น้อยที่สุด</strong> ด้วยทรัพยากรที่มีจำกัด
          </p>

          <div className="mission-res">
            <div className="mission-res-item">
              <div className="mission-res-n">1</div>
              <div>
                <div className="thai" style={{ fontWeight: 600 }}>สิทธิ์เหลื่อมรอบส่งน้ำ</div>
                <div className="thai mission-res-d">
                  ขอให้โครงการชลประทาน <strong>หนึ่งโครงการ</strong> เลื่อนรอบส่งน้ำ 15 วัน
                  ข้าวของโครงการนั้นจะสุกช้าลงและย้ายไปช่วงถัดไป
                </div>
              </div>
            </div>
            <div className="mission-res-item">
              <div className="mission-res-n">2</div>
              <div>
                <div className="thai" style={{ fontWeight: 600 }}>โควตาสั่งถ่ายภาพ THEOS-2</div>
                <div className="thai mission-res-d">
                  หน้าต่างเก็บเกี่ยวที่ GISTDA เผยแพร่กว้าง <strong>{M.windowDays} วัน</strong> —
                  บอกว่า "ช่วงไหน" แต่ไม่บอกว่า "วันไหน"
                  ภาพความละเอียด 50 ซม. ระบุแปลงที่พร้อมเกี่ยวได้ทีละแปลง
                  ทำให้จองคิวโรงสีล่วงหน้าเป็นรายวันแทนที่จะเผื่อทั้งช่วง
                </div>
              </div>
            </div>
          </div>

          <div className="mission-warn thai">
            ทรัพยากรไม่พอทำทุกอย่าง และการทุ่มลงพื้นที่ที่หลักฐานยังไม่ชัด แย่กว่าการไม่ทำ —
            คุณเลือก "สรุปไม่ได้" สำหรับโครงการที่ข้อมูลไม่พอได้ และจะได้คะแนนจากการยับยั้งนั้น
          </div>

          <button className="btn primary thai" onClick={() => setStep(1)}>ดูหลักฐาน →</button>
        </div>
      )}

      {/* ── 2. หลักฐาน ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="mission-evidence">
          <div className="card">
            <div className="card-h">
              <h3 className="thai">ชั้นที่ 1 — ข้าวมาถึงเมื่อไร</h3>
              <span className="sub thai">ชั้นข้อมูลข้าวรายแปลง GISTDA</span>
            </div>
            <div className="mission-cal">
              {D.harvestWindows.map((w) => {
                const isPeak = w.windowTh === M.peakWindowTh;
                const h = Math.max(4, (w.tonnes / M.peakTonnes) * 120);
                return (
                  <div key={w.windowTh} className="mission-cal-col">
                    <div className="mission-cal-v">{(w.tonnes / 1000).toFixed(1)}</div>
                    <div className="mission-cal-bar" style={{
                      height: h, background: isPeak ? 'var(--risk)' : 'var(--data)',
                    }} />
                    <div className="mission-cal-l thai">{w.windowTh.replace(' 2569', '')}</div>
                  </div>
                );
              })}
            </div>
            <div className="mission-note thai">
              หน่วยเป็นพันตัน · แท่งแดงคือช่วงที่ข้าวออกหนาแน่นที่สุด ·
              ผลผลิตคำนวณจากพื้นที่ × {D.province.productKgPerRai[0]} กก./ไร่
              ซึ่งเป็นค่าคงที่ทั้งจังหวัดในชั้นข้อมูล ตัวเลข "ตัน" จึงสะท้อนพื้นที่เป็นหลัก
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3 className="thai">ชั้นที่ 2 — คันโยกอยู่ที่โครงการ ไม่ใช่ที่อำเภอ</h3>
              <span className="sub thai">ชี้ที่ชื่อโครงการเพื่อดูขอบเขต</span>
            </div>
            <MissionMap projects={projects} highlight={hover} />
            <div className="mission-proj-list">
              {projects.map((p) => (
                <button key={p.nameTh}
                        className={`mission-proj ${hover === p.nameTh ? 'on' : ''}`}
                        onMouseEnter={() => setHover(p.nameTh)}
                        onFocus={() => setHover(p.nameTh)}
                        onClick={() => setHover(hover === p.nameTh ? null : p.nameTh)}>
                  <span className="thai" style={{ fontWeight: 600 }}>{p.nameTh}</span>
                  <span className="thai mission-proj-d">
                    ข้าวในช่วงพีค {kt(p.peakTonnes)} · ครอบคลุม {p.amphoeCount} อำเภอ
                  </span>
                </button>
              ))}
            </div>
            <div className="mission-note thai">
              สังเกตว่าถ้าเรียงตามอำเภอ หนองเสือมีข้าวมากที่สุด แต่หนองเสือทั้งอำเภออยู่ในโครงการรังสิตเหนือ
              ซึ่งยังกินคลองหลวงและอีก 3 อำเภอด้วย — ขยับรอบส่งน้ำหนึ่งครั้งจึงกระทบหลายอำเภอพร้อมกัน
              ขณะที่ธัญบุรีถูกผ่าออกเป็นสองโครงการ จะแก้ด้วยคันโยกเดียวไม่ได้
            </div>
          </div>

          <button className="btn primary thai" onClick={() => setStep(2)}>ตัดสินใจ →</button>
        </div>
      )}

      {/* ── 3. ตัดสินใจ ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="mission-decide">
          <div className="card">
            <div className="card-h">
              <h3 className="thai">เลือกโครงการที่จะขอให้เหลื่อมรอบส่งน้ำ</h3>
              <span className="sub thai">ได้ 1 โครงการเท่านั้น</span>
            </div>
            <div className="mission-choices">
              {projects.map((p) => (
                <label key={p.nameTh} className={`mission-choice ${stagger === p.nameTh ? 'on' : ''}`}>
                  <input type="radio" name="stagger" checked={stagger === p.nameTh}
                         onChange={() => setStagger(p.nameTh)} />
                  <span className="thai" style={{ fontWeight: 600 }}>{p.nameTh}</span>
                  <span className="thai mission-choice-d">ย้ายออกจากช่วงพีค {kt(p.peakTonnes)}</span>
                </label>
              ))}
              <label className={`mission-choice ${stagger === null ? 'on' : ''}`}>
                <input type="radio" name="stagger" checked={stagger === null} onChange={() => setStagger(null)} />
                <span className="thai" style={{ fontWeight: 600 }}>ไม่ขอเหลื่อมรอบส่งน้ำ</span>
                <span className="thai mission-choice-d">เก็บสิทธิ์ไว้ ไม่รบกวนแผนส่งน้ำ</span>
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3 className="thai">สั่งถ่ายภาพ THEOS-2 ตรงไหน</h3>
              <span className="sub thai">เหลือโควตา {cfg.imageQuota - imaged.length} จาก {cfg.imageQuota}</span>
            </div>
            <div className="mission-choices">
              {projects.map((p) => (
                <label key={p.nameTh} className={`mission-choice ${imaged.includes(p.nameTh) ? 'on' : ''}`}>
                  <input type="checkbox" checked={imaged.includes(p.nameTh)}
                         disabled={!imaged.includes(p.nameTh) && imaged.length >= cfg.imageQuota}
                         onChange={() => toggleImaged(p.nameTh)} />
                  <span className="thai" style={{ fontWeight: 600 }}>{p.nameTh}</span>
                  <span className="thai mission-choice-d">
                    ย่อหน้าต่าง {M.windowDays} วัน ให้เหลือรายวัน สำหรับ {kt(p.peakTonnes)}
                  </span>
                </label>
              ))}
            </div>
            <div className="mission-skip">
              <div className="thai" style={{ fontWeight: 600, marginBottom: 6 }}>สรุปไม่ได้</div>
              <div className="thai mission-note" style={{ marginBottom: 8 }}>
                ถ้าเห็นว่าหลักฐานยังไม่พอจะตัดสินใจกับโครงการไหน ให้ทำเครื่องหมายไว้
                การยับยั้งไม่ให้ทรัพยากรลงพื้นที่ที่ยังไม่ชัด นับเป็นการตัดสินใจที่ถูกต้อง
              </div>
              <div className="mission-skip-row">
                {projects.map((p) => (
                  <button key={p.nameTh}
                          className={`mission-skip-b ${skipped.includes(p.nameTh) ? 'on' : ''}`}
                          onClick={() => toggleSkip(p.nameTh)}>
                    <span className="thai">{p.nameTh}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3 className="thai">สมมติฐานที่ปรับได้</h3>
              <span className="chip warn thai"><span className="dot" />ยังไม่มีชั้นข้อมูลรองรับ</span>
            </div>
            <label className="mission-slider thai">
              กำลังรับซื้อและสีข้าวในพื้นที่: <strong>{capacity.toLocaleString()} ตัน/ครึ่งเดือน</strong>
              <input type="range" min="3000" max="20000" step="500" value={capacity}
                     onChange={(e) => setCapacity(+e.target.value)} />
              <span className="mission-note">
                จังหวัดมีโรงสี {D.province.mills.inProvince.length} แห่ง แต่ GISTDA ยังไม่เผยแพร่ชั้นข้อมูลกำลังสีข้าว
                ตัวเลขนี้จึงเป็นสมมติฐาน ลองเลื่อนดูว่าคำตอบเปลี่ยนไหม
              </span>
            </label>
            <label className="mission-slider thai">
              ประโยชน์จากการรู้วันเก็บเกี่ยวแน่นอน: <strong>+{Math.round(schedulingGain * 100)}%</strong>
              <input type="range" min="0" max="0.6" step="0.05" value={schedulingGain}
                     onChange={(e) => setSchedulingGain(+e.target.value)} />
              <span className="mission-note">
                ถ้ารู้ว่าข้าวมาวันไหน โรงสีจัดคิวล่วงหน้าได้ ลดเวลาที่เครื่องว่างสลับกับข้าวกอง
                ตัวเลขนี้ยังไม่ได้สอบเทียบกับโรงสีจริง
              </span>
            </label>
          </div>

          <button className="btn primary thai" onClick={() => setStep(3)}>ดูผลลัพธ์ →</button>
        </div>
      )}

      {/* ── 4. ผลลัพธ์ ──────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="mission-result">
          <div className="card">
            <div className="card-h"><h3 className="thai">ผลของแผนคุณ</h3></div>
            <div className="mission-score">
              <div>
                <div className="mission-score-l thai">ข้าวค้างคิว</div>
                <div className="mission-score-v">{kt(result.queued)}</div>
              </div>
              <div>
                <div className="mission-score-l thai">ถ้าไม่ทำอะไรเลย</div>
                <div className="mission-score-v muted">{kt(doNothing.result.queued)}</div>
              </div>
              <div>
                <div className="mission-score-l thai">แผนที่ดีที่สุด</div>
                <div className="mission-score-v ok">{kt(best.result.queued)}</div>
              </div>
              <div>
                <div className="mission-score-l thai">อันดับของคุณ</div>
                <div className="mission-score-v">{rank + 1} / {ranking.length}</div>
              </div>
            </div>

            <table className="tbl mission-tbl">
              <thead><tr>
                <th className="thai">ช่วง</th><th className="thai">ข้าวมาถึง</th>
                <th className="thai">รับได้</th><th className="thai">ค้างคิว</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td className="thai">{M.peakWindowTh}</td>
                  <td className="mono">{result.peak.arrivals.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</td>
                  <td className="mono">{result.peak.cap.toLocaleString()}</td>
                  <td className="mono" style={{ color: result.peak.queued > 0 ? 'var(--risk)' : 'var(--ok)', fontWeight: 600 }}>
                    {result.peak.queued.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="thai">ช่วงถัดไป (16-31 ส.ค.)</td>
                  <td className="mono">{result.next.arrivals.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</td>
                  <td className="mono">{result.next.cap.toLocaleString()}</td>
                  <td className="mono" style={{ color: result.next.queued > 0 ? 'var(--risk)' : 'var(--ok)', fontWeight: 600 }}>
                    {result.next.queued.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mission-best thai">
              <strong>แผนที่ดีที่สุด:</strong>{' '}
              เหลื่อมรอบส่งน้ำที่ {best.stagger || 'ไม่เหลื่อม'} ·
              ถ่ายภาพที่ {best.imaged.length ? best.imaged.join(' และ ') : 'ไม่ถ่าย'}
              {best.stagger && best.imaged.includes(best.stagger) && (
                <span> — สังเกตว่าคำตอบที่ดีที่สุดคือ <strong>ถ่ายภาพโครงการเดียวกับที่ขอเหลื่อมรอบ</strong>{' '}
                  เพราะย้ายข้าวไปช่วงใหม่แล้วยังต้องจัดคิวโรงสีในช่วงนั้นให้ได้ด้วย</span>
              )}
            </div>
          </div>

          {/* Stress test */}
          <div className="card">
            <div className="card-h">
              <h3 className="thai">ทดสอบความทนทานของหลักเกณฑ์</h3>
              <span className="sub thai">Stress Test</span>
            </div>
            <div className="mission-note thai" style={{ marginBottom: 10 }}>
              หลักเกณฑ์ที่ดีต้องยังใช้ได้เมื่อเงื่อนไขเปลี่ยน กดดูว่าคำตอบที่ดีที่สุดยังเป็นแผนเดิมไหม
            </div>
            <div className="mission-stress">
              {[
                ['cloud', 'เมฆบังภาพ เหลือโควตา 1', { ...cfg, imageQuota: 1 }],
                ['lowMill', 'โรงสีจริงน้อยกว่าที่คิด 30%', stressCfg.lowMill],
                ['noGain', 'รู้วันเกี่ยวแล้วไม่ช่วยเลย', stressCfg.noGain],
              ].map(([k, label, c]) => {
                const alt = enumerateAll(c, projects);
                const same = alt[0].stagger === best.stagger;
                return (
                  <button key={k} className={`mission-stress-b ${stress === k ? 'on' : ''}`}
                          onClick={() => setStress(stress === k ? null : k)}>
                    <span className="thai" style={{ fontWeight: 600 }}>{label}</span>
                    <span className={`chip ${same ? 'ok' : 'warn'} thai`}>
                      <span className="dot" />{same ? 'คำตอบเดิมยังดีที่สุด' : `เปลี่ยนเป็น ${alt[0].stagger || 'ไม่เหลื่อม'}`}
                    </span>
                    <span className="thai mission-note">
                      ค้างคิว {kt(alt[0].result.queued)} · ถ่ายภาพที่ {alt[0].imaged.join(' และ ') || 'ไม่ถ่าย'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn thai" onClick={() => { setStep(0); setStagger(null); setImaged([]); setSkipped([]); }}>
            เล่นใหม่
          </button>
        </div>
      )}
    </div>
  );
}

window.Mission = Mission;
