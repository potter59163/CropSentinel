import { describe, it, expect } from 'vitest';
import { resolveExistingZones, DEFAULT_CURRENT_CROP, CURRENT_CROPS } from './existingZones';

/**
 * The bug these pin: the form pre-filled a maize zone for DISPLAY only, so a farmer who agreed
 * with it changed nothing and the request carried existingZones: [] — planning the plot as bare
 * land with no clearing cost, no herbicide carry-over and no rubber grant. Measured on a 10 rai
 * Pua plot the difference was a transition cost of 0 versus ฿24,000 and two missing year-0
 * actions. Anything that quietly returns [] again brings that back.
 */
describe('resolveExistingZones', () => {
  it('falls back to the maize default a farmer sees pre-filled', () => {
    const zones = resolveExistingZones({ existingZones: [], currentCropId: null, sizeRai: 10 });
    expect(zones).toHaveLength(1);
    expect(zones[0].cropId).toBe(DEFAULT_CURRENT_CROP);
    expect(zones[0].cropId).toBe('ข้าวโพดเลี้ยงสัตว์');
    // The default has to cover the whole plot, or the transition cost silently under-counts.
    expect(zones[0].areaRai).toBe(10);
  });

  it('lets a farmer opt out of the maize assumption deliberately', () => {
    // Not a theoretical path: bare or newly cleared land is common, and the only honest way to
    // say so is an explicit choice — not leaving a field alone.
    expect(CURRENT_CROPS).toContain('พื้นที่ว่าง/เพิ่งถาง');
    const zones = resolveExistingZones({ existingZones: [], currentCropId: 'พื้นที่ว่าง/เพิ่งถาง', sizeRai: 5 });
    expect(zones[0].cropId).toBe('พื้นที่ว่าง/เพิ่งถาง');
  });

  it('keeps explicit zones untouched', () => {
    const explicit = [
      { id: 'a', cropId: 'ยางพารา', areaRai: 6 },
      { id: 'b', cropId: 'ข้าวไร่', areaRai: 4 },
    ];
    expect(resolveExistingZones({ existingZones: explicit, currentCropId: null, sizeRai: 10 })).toEqual(explicit);
  });

  it('drops zones with no crop or no area rather than passing junk to the engine', () => {
    const zones = resolveExistingZones({
      existingZones: [
        { id: 'a', cropId: 'ยางพารา', areaRai: 6 },
        { id: 'b', cropId: '', areaRai: 4 },
        { id: 'c', cropId: 'ข้าวไร่', areaRai: Number.NaN },
        { id: 'd', cropId: 'ข้าวไร่', areaRai: 0 },
      ],
      currentCropId: null,
      sizeRai: 10,
    });
    expect(zones.map((z) => z.id)).toEqual(['a']);
  });

  it('returns nothing when the plot size is unknown', () => {
    // A zone with no area tells the engine nothing, and inventing one from a blank form would
    // charge a transition cost against a plot nobody has described yet.
    expect(resolveExistingZones({ existingZones: [], currentCropId: null, sizeRai: Number.NaN })).toEqual([]);
    expect(resolveExistingZones({ existingZones: [], currentCropId: null, sizeRai: 0 })).toEqual([]);
  });
});
