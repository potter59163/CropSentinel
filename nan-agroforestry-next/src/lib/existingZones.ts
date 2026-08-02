import type { ExistingZone, FarmInput } from '../data/types';

/**
 * What the plot was before — resolved in ONE place, because the display and the model diverged.
 *
 * The form pre-fills a maize zone, which is the right prior: converting maize land is the whole
 * premise of this tool, and Nan planted 407,341 rai of it last season. But that default was
 * computed inside the form for RENDERING only. A farmer who looked at "ข้าวโพดเลี้ยงสัตว์ · 10 ไร่",
 * agreed with it, and moved on changed nothing — so the request carried existingZones: [] and the
 * engine planned the plot as bare land: no clearing cost, no herbicide carry-over, no acid-soil
 * flag, no rubber replanting grant. The screen said one thing and the model did another, and the
 * farmer had no way to see the difference.
 *
 * Anyone who needs to know the previous land use calls this, so there is nothing left to diverge.
 */

/**
 * Ordered by how common each is on a Nan smallholding, so the first entry is also the default.
 * "พื้นที่ว่าง/เพิ่งถาง" exists precisely so a farmer with bare land can opt OUT of the maize
 * assumption deliberately, rather than by leaving a field alone and never learning it mattered.
 */
export const CURRENT_CROPS = [
  'ข้าวโพดเลี้ยงสัตว์', 'ข้าวไร่', 'มันสำปะหลัง', 'ยางพารา',
  'ไม้ผลผสม', 'สวนผสม', 'ป่า/ไม้ยืนต้นเดิม', 'พื้นที่ว่าง/เพิ่งถาง', 'พื้นที่เสื่อมโทรม', 'อื่นๆ',
];

export const DEFAULT_CURRENT_CROP = CURRENT_CROPS[0];

/**
 * The zones to plan on. Falls back through: explicit zones, the legacy single-crop field, then
 * the pre-filled default — the same order the form displays them in.
 *
 * Returns [] when the plot size is unknown, since a zone with no area tells the engine nothing
 * and would only invent a transition cost out of a blank form.
 */
export function resolveExistingZones(input: Pick<FarmInput, 'existingZones' | 'currentCropId' | 'sizeRai'>): ExistingZone[] {
  const explicit = (input.existingZones ?? [])
    .filter((z) => z.cropId && Number.isFinite(z.areaRai) && z.areaRai > 0);
  if (explicit.length) return explicit;

  if (!Number.isFinite(input.sizeRai) || input.sizeRai <= 0) return [];

  return [{
    id: 'zone-1',
    cropId: input.currentCropId ?? DEFAULT_CURRENT_CROP,
    areaRai: input.sizeRai,
  }];
}
