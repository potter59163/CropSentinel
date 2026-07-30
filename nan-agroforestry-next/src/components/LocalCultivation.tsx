import type { CultivationContext } from '../lib/cultivation';
import type { SystemPlan } from '../data/types';
import { Icon } from './Icon';
import { nf0 } from '../lib/format';

/**
 * "What is actually grown near this plot", shown as a market-and-feasibility signal.
 *
 * Kept visually and verbally separate from the suitability score on purpose. This answers a
 * question the app previously could not answer at all — not "will it grow" but "can I sell
 * it, and can I get seedlings and advice" — and it is a count from government statistics
 * rather than a model output. See lib/cultivation.ts for why it must never be folded into
 * suitability or the cashflow.
 *
 * Two readings are surfaced, because both are actionable:
 *   - grown nearby -> there is a supply chain, a seedling source, and neighbours to ask
 *   - rated well but grown nowhere nearby -> worth asking why, because a local reason the
 *     climate data cannot see (disease, labour, a collapsed buyer) may be the explanation
 */
export function LocalCultivation({ sys, cultivation }: {
  sys: SystemPlan;
  cultivation: CultivationContext | null;
}) {
  if (!cultivation) return null;

  const rows = sys.picks.map((p) => ({
    id: p.plant.id,
    nameTh: p.plant.nameTh,
    suit: p.suitability,
    c: cultivation.byPlant[p.plant.id],
  }));
  if (!rows.length) return null;

  // A crop the model likes that nobody nearby grows. Threshold matches the app's own
  // "เหมาะ" cut so the flag never contradicts the badge shown on the plant row.
  const unexplained = rows.filter((r) => !r.c && r.suit >= 0.6);
  const grown = rows.filter((r) => r.c).sort((a, b) => (b.c!.rai) - (a.c!.rai));

  if (cultivation.unavailable) {
    return (
      <section className="agro-cultivation">
        <div className="agro-compare-head">
          <span className="agro-impact-k">การปลูกในพื้นที่</span>
          <b className="thai">ข้อมูลการปลูกจริงรอบแปลงยังไม่พร้อมใช้รอบนี้</b>
        </div>
        <p className="thai agro-cultivation-lead">
          <b>ไม่ได้แปลว่าไม่มีใครปลูก</b> · ควรถามเกษตรอำเภอว่าพืชที่เลือกมีคนปลูกและมีคนรับซื้อในพื้นที่หรือไม่
        </p>
      </section>
    );
  }

  return (
    <section className="agro-cultivation">
      <div className="agro-compare-head">
        <span className="agro-impact-k">การปลูกในพื้นที่</span>
        <b className="thai">พืชในแผนนี้ มีคนปลูกรอบแปลงจริงแค่ไหน (รัศมี {cultivation.radiusKm} กม.)</b>
      </div>

      <p className="thai agro-cultivation-lead">
        ตัวเลขนี้เป็น<b>การนับจากสถิติราชการ ไม่ใช่คะแนนความเหมาะสม</b> และไม่ได้นำไปคิดในกราฟรายได้
        · ใช้ดูว่า<b>มีตลาดรับซื้อ หาต้นกล้าได้ และมีคนให้ถามไหม</b>
      </p>

      {grown.length > 0 && (
        <div className="agro-cultivation-grid">
          {grown.map((r) => (
            <div key={r.id} className="agro-cultivation-row">
              <b className="thai">{r.nameTh}</b>
              <span className="thai">
                <Icon name="plot" size={13} /> {nf0(r.c!.tambons)} ตำบล · {nf0(r.c!.rai)} ไร่
                {r.c!.nearestKm !== undefined ? ` · ใกล้สุด ${r.c!.nearestKm} กม.` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {rows.some((r) => !r.c) && (
        <div className="agro-cultivation-none thai">
          <Icon name="info" size={15} />
          <span>
            <b>ไม่พบการปลูกในรัศมี {cultivation.radiusKm} กม.:</b>{' '}
            {rows.filter((r) => !r.c).map((r) => r.nameTh).join(' · ')}
            {' '}— <b>ไม่ได้แปลว่าปลูกไม่ได้</b> แต่ต้องเตรียมเรื่องหาต้นกล้าและตลาดเอง
          </span>
        </div>
      )}

      {unexplained.length > 0 && (
        <div className="agro-cultivation-flag thai">
          <Icon name="warning" size={15} />
          <span>
            <b>ควรถามเพิ่ม:</b> {unexplained.map((r) => r.nameTh).join(' · ')}{' '}
            ระบบให้คะแนนความเหมาะสมสูง แต่ไม่มีใครปลูกในรัศมีนี้เลย
            · อาจมีเหตุผลในพื้นที่ที่ข้อมูลภูมิอากาศมองไม่เห็น เช่น โรค แรงงาน หรือไม่มีคนรับซื้อ
            ควรสอบถามเกษตรอำเภอก่อนตัดสินใจ
          </span>
        </div>
      )}

      <div className="agro-gistda-src">ที่มา: {cultivation.source} · นับเฉพาะตำบลที่รายงาน ≥ 20 ไร่</div>
    </section>
  );
}
