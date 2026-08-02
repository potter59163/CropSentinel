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
    // Bamboo belongs in the tall band on height. That was never the error — calling that band
    // "ไม้ยืนต้น" was.
    expect(bamboo.every((p) => p.layer === 'canopy')).toBe(true);
  });

  it('never calls a non-woody plant a tree', () => {
    const notWoody: Habit[] = ['ไผ่', 'ไม้ล้มลุก', 'ไม้ล้มลุกขนาดใหญ่', 'ไม้เถา', 'หญ้า', 'เฟิร์น'];
    for (const p of PLANTS) {
      if (notWoody.includes(p.habit)) {
        expect(HABIT_META[p.habit].chip, `${p.nameTh} is labelled as a tree`).not.toContain('ไม้ต้น');
      }
    }
  });

  it('keeps every layer name free of growth-form claims', () => {
    // If a layer name ever says ไม้ยืนต้น again, the whole two-axis split has quietly collapsed.
    for (const meta of Object.values(LAYER_META)) {
      expect(meta.th).not.toContain('ไม้ยืนต้น');
    }
  });
});
