import { describe, it, expect } from 'vitest';
import { PLANTS, HABIT_META, LAYER_META } from './plants';
import type { Habit } from './types';

/**
 * The layer axis was made positional so it would stop claiming ไผ่ and กล้วย are trees. That
 * fix only holds if the OTHER axis actually says what each plant is, on screen, in words a
 * farmer reads. These tests pin that promise rather than the internals.
 */
describe('habit (วิสัย)', () => {
  it('has a label and an explanation for every habit in use', () => {
    const used = new Set<Habit>(PLANTS.map((p) => p.habit));
    for (const h of used) {
      expect(HABIT_META[h], `${h} has no HABIT_META entry`).toBeDefined();
      expect(HABIT_META[h].chip.length).toBeGreaterThan(0);
      // A note that only restates the label teaches a farmer nothing.
      expect(HABIT_META[h].note.length).toBeGreaterThan(20);
    }
  });

  it('tells the farmer bamboo is a grass, not a tree', () => {
    // Bambusoideae is a subfamily of Poaceae. The bare word "ไผ่" answers nothing on its own,
    // which is the whole reason this label carries the family.
    expect(HABIT_META['ไผ่'].chip).toContain('หญ้า');
    expect(HABIT_META['ไผ่'].note).toContain('Poaceae');

    const bamboo = PLANTS.filter((p) => p.habit === 'ไผ่');
    expect(bamboo.length).toBeGreaterThan(0);
    // Bamboo sits in the SUB-canopy positional layer, not the top one — matching โครงการ
    // "สร้างป่า สร้างรายได้", the source this whole positional scheme cites. It shipped in
    // 'canopy' at first, contradicting that source, until a farmer looking at a plan asked why
    // it sat with สัก and มะม่วง. Pinned here so that regresses loudly rather than quietly.
    expect(bamboo.every((p) => p.layer === 'shrub')).toBe(true);
  });

  it('never puts the word ไม้ on a plant that has no wood', () => {
    // The objection that produced this rule: a farmer reads ไม้ as WOOD, so labelling a banana
    // "ไม้ล้มลุกขนาดใหญ่" told them it was a kind of wood. Standard Thai botanical vocabulary
    // uses ไม้ to mean "plant", but the audience here does not hold that convention.
    const nonWoody: Habit[] = [
      'พืชล้มลุก', 'พืชล้มลุกขนาดใหญ่', 'พืชล้มลุกมีเหง้า', 'พืชล้มลุกมีหัว',
      'เถาล้มลุก', 'ไผ่', 'หญ้า', 'เฟิร์น',
    ];
    for (const h of nonWoody) {
      expect(HABIT_META[h].chip, `${h} still leads with ไม้`).not.toMatch(/^ไม้/);
    }
    // And the converse: the habits that KEEP ไม้ must genuinely be woody, or the word stops
    // meaning anything. ไม้เถา holds rattan, which is sold as cane — ไม้ is honest there.
    const woody: Habit[] = ['ไม้ต้น', 'ไม้พุ่ม', 'ไม้เถา'];
    for (const h of woody) {
      expect(HABIT_META[h].note, `${h} does not say it is woody`).toMatch(/เนื้อแข็ง|แก่น/);
    }
  });

  it('separates a rhizome crop from a plant that dies off each season', () => {
    // ขิง ขมิ้น ข่า were all "ไม้ล้มลุก", which reads as a one-season crop to be replanted.
    // The rhizome IS the plant, it persists, and it is what gets sold — that is the fact a
    // farmer needs when deciding what goes in the ground.
    const rhizome = PLANTS.filter((p) => p.habit === 'พืชล้มลุกมีเหง้า');
    expect(rhizome.map((p) => p.id).sort()).toEqual(['galangal', 'ginger', 'reao', 'turmeric']);
    expect(HABIT_META['พืชล้มลุกมีเหง้า'].note).toMatch(/เหง้าใต้ดิน/);
  });

  it('keeps every layer name free of growth-form claims', () => {
    // If a layer name ever says ไม้ยืนต้น again, the whole two-axis split has quietly collapsed.
    for (const meta of Object.values(LAYER_META)) {
      expect(meta.th).not.toContain('ไม้ยืนต้น');
    }
  });
});
