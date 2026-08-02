import { useMemo, useState } from 'react';
import type { FarmInput, Layer, Plant } from '../data/types';
import { byLayer, HABIT_META, LAYER_META, PLANTS } from '../data/plants';
import { PlantGlyph } from './PlantGlyph';
import { Icon } from './Icon';
import { provenanceOf } from '../lib/provenance';

/**
 * Choosing from 55 species.
 *
 * At 21 this was a flat grid of chips per layer and it worked. At 55 it became a wall: no way
 * to find a species by name, no way to see which ones suit this plot, and no way to answer the
 * questions a farmer actually arrives with — "what gives me money in year one", "what fixes
 * the soil", "what survives on my hill". The meeting asked for freedom to try combinations,
 * so the picker has to make trying cheap.
 *
 * Three things do that:
 *   1. SEARCH by Thai or English name.
 *   2. FILTERS phrased as farmer questions, not as data fields.
 *   3. A live summary of what the current mix does, so the consequence of a pick is visible
 *      without running the plan.
 *
 * The elevation filter is the important one: with the plot's elevation already entered, most
 * of the 55 are simply wrong for this land, and hiding them is more helpful than ranking them.
 */

type FilterKey = 'fits' | 'fast' | 'nfix' | 'shade' | 'sell';

const FILTERS: Array<{ key: FilterKey; label: string; hint: string; test: (p: Plant, elev: number) => boolean }> = [
  {
    key: 'fits',
    label: 'ขึ้นได้ที่ความสูงนี้',
    hint: 'ตัดพืชที่ความสูงแปลงไม่เหมาะออก',
    test: (p, elev) => !Number.isFinite(elev) || (elev >= p.elevMin && elev <= p.elevMax),
  },
  {
    key: 'fast',
    label: 'ได้เงินใน 1–2 ปี',
    hint: 'พืชที่เริ่มเก็บขายได้เร็ว',
    test: (p) => p.yearsToYield <= 2 && p.pricePerKg > 0,
  },
  {
    key: 'nfix',
    label: 'บำรุงดิน',
    hint: 'ตรึงไนโตรเจน ลดค่าปุ๋ย',
    test: (p) => p.nFixing,
  },
  {
    key: 'shade',
    label: 'ปลูกใต้ร่มได้',
    hint: 'ทนร่มเงาเมื่อเรือนยอดปิด',
    test: (p) => p.shadeTol >= 0.5,
  },
  {
    key: 'sell',
    label: 'มีราคาอ้างอิงราชการ',
    hint: 'ตัวเลขเงินเชื่อถือได้มากกว่า',
    test: (p) => provenanceOf(p.id) === 'official',
  },
];

const LAYERS: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

export function PlantPicker({ value, onChange }: {
  value: FarmInput;
  onChange: (v: FarmInput) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Set<FilterKey>>(new Set());

  const selectedByLayer = value.selectedByLayer ?? { canopy: [], shrub: [], groundcover: [], root: [] };
  const elev = value.elevationM;

  const toggleFilter = (k: FilterKey) => setActive((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const togglePlant = (layer: Layer, id: string) => {
    const a = selectedByLayer[layer] ?? [];
    onChange({
      ...value,
      selectedByLayer: {
        ...selectedByLayer,
        [layer]: a.includes(id) ? a.filter((x) => x !== id) : [...a, id],
      },
    });
  };

  const clearAll = () => onChange({
    ...value,
    selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
  });

  const q = query.trim().toLowerCase();
  const matches = (p: Plant) => {
    if (q && !p.nameTh.toLowerCase().includes(q) && !p.nameEn.toLowerCase().includes(q)
      && !p.category.toLowerCase().includes(q)) return false;
    for (const f of FILTERS) if (active.has(f.key) && !f.test(p, elev)) return false;
    return true;
  };

  const allSelected = useMemo(
    () => LAYERS.flatMap((l) => (selectedByLayer[l] ?? []).map((id) => PLANTS.find((p) => p.id === id))).filter(Boolean) as Plant[],
    [selectedByLayer],
  );

  // What the current mix actually does — visible before running the plan, because that is
  // what makes trying a combination cheap.
  const summary = useMemo(() => {
    const canopyCount = (selectedByLayer.canopy ?? []).length;
    return {
      total: allSelected.length,
      canopyCount,
      needsCanopy: canopyCount > 0 && canopyCount < 2,
      hasNFix: allSelected.some((p) => p.nFixing),
      fastIncome: allSelected.filter((p) => p.yearsToYield <= 2 && p.pricePerKg > 0).length,
      offElevation: Number.isFinite(elev)
        ? allSelected.filter((p) => elev < p.elevMin || elev > p.elevMax)
        : [],
    };
  }, [allSelected, selectedByLayer, elev]);

  const totalShown = PLANTS.filter(matches).length;

  return (
    <div className="agro-picker">
      <div className="agro-picker-tools">
        <label className="agro-picker-search">
          <Icon name="crosshair" size={16} />
          <input
            type="search"
            className="agro-input"
            placeholder="ค้นชื่อพืช เช่น ลำไย กาแฟ ถั่ว"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="ค้นหาพืช"
          />
        </label>
        <div className="agro-picker-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={active.has(f.key)}
              title={f.hint}
              className={`agro-picker-filter thai ${active.has(f.key) ? 'on' : ''}`}
              onClick={() => toggleFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="agro-picker-count thai">
          แสดง {totalShown} จาก {PLANTS.length} ชนิด
          {summary.total > 0 && (
            <button type="button" className="agro-picker-clear thai" onClick={clearAll}>ล้างที่เลือก</button>
          )}
        </div>
      </div>

      {/* Live consequence of the current mix. */}
      {summary.total > 0 && (
        <div className="agro-picker-summary">
          <span className="thai"><b>{summary.total}</b> ชนิด</span>
          <span className={`thai ${summary.hasNFix ? 'ok' : 'warn'}`}>
            {summary.hasNFix ? '✓ มีพืชบำรุงดิน' : 'ยังไม่มีพืชบำรุงดิน'}
          </span>
          <span className={`thai ${summary.fastIncome > 0 ? 'ok' : 'warn'}`}>
            {summary.fastIncome > 0 ? `✓ ได้เงินเร็ว ${summary.fastIncome} ชนิด` : 'ยังไม่มีพืชที่ได้เงินใน 1–2 ปี'}
          </span>
          {summary.needsCanopy && (
            <span className="thai warn">ไม้เรือนยอดต้องมีอย่างน้อย 2 ชนิด</span>
          )}
          {summary.offElevation.length > 0 && (
            <span className="thai bad">
              ไม่เหมาะกับความสูง {elev} ม.: {summary.offElevation.map((p) => p.nameTh).join(' · ')}
            </span>
          )}
        </div>
      )}

      <div className="agro-pick">
        {LAYERS.map((layer) => {
          const m = LAYER_META[layer];
          const selected = selectedByLayer[layer] ?? [];
          const list = byLayer(layer).filter(matches);
          return (
            <div key={layer} className={`agro-pick-layer layer-${layer}`}>
              <div className="agro-pick-head">
                <b className="thai">
                  <span className="agro-pick-headglyph"><PlantGlyph plantId="" layer={layer} size={20} /></span> {m.th}
                </b>
                <span className="thai">{selected.length ? `เลือก ${selected.length}` : 'อัตโนมัติ'}</span>
              </div>
              {list.length === 0 ? (
                <p className="thai agro-pick-empty">ไม่มีชนิดที่ตรงเงื่อนไขในชั้นนี้ · ลองปิดตัวกรองบางอัน</p>
              ) : (
                <div className="agro-chips">
                  {list.map((p) => {
                    const on = selected.includes(p.id);
                    const offElev = Number.isFinite(elev) && (elev < p.elevMin || elev > p.elevMax);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        className={`agro-chip agro-pick-chip ${on ? 'on' : ''} ${offElev ? 'off-elev' : ''}`}
                        title={offElev ? `เหมาะกับความสูง ${p.elevMin}–${p.elevMax} ม.` : p.note}
                        onClick={() => togglePlant(layer, p.id)}
                      >
                        <span className="agro-pick-icon"><PlantGlyph plantId={p.id} layer={layer} size={22} /></span>
                        <span className="agro-pick-text">
                          <span className="thai">{p.nameTh}</span>
                          <span className="agro-pick-habit thai">
                            {HABIT_META[p.habit].chip}
                            {p.nFixing ? ' · บำรุงดิน' : ''}
                            {p.pricePerKg === 0 && p.yearsToYield <= 10 ? ' · ไม่ได้ขาย' : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
