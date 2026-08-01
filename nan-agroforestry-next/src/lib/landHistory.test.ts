import { describe, it, expect } from 'vitest';
import { landHistoryProfile, transitionBreakdown } from './landHistory';
import type { ExistingZone } from '../data/types';

const zone = (cropId: string, areaRai: number): ExistingZone => ({ id: cropId, cropId, areaRai });

describe('land history — the previous crop must change the recommendation, not just the cost', () => {
  it('gives maize and freshly cleared land genuinely different guidance', () => {
    const maize = landHistoryProfile('ข้าวโพดเลี้ยงสัตว์');
    const cleared = landHistoryProfile('พื้นที่ว่าง/เพิ่งถาง');
    // The whole point of the meeting's question: these two used to be identical apart from
    // a baht figure.
    expect(maize.flags.acidRisk).toBe(true);
    expect(cleared.flags.acidRisk).toBe(false);
    expect(cleared.flags.nurseRequired).toBe(true);
    expect(maize.flags.nurseRequired).toBe(false);
    expect(maize.year0Actions).not.toEqual(cleared.year0Actions);
  });

  it('flags maize herbicide but only as a one-season watch', () => {
    expect(landHistoryProfile('ข้าวโพดเลี้ยงสัตว์').flags.herbicideWatch).toBe(true);
    // Cassava and rubber carry no herbicide-carryover claim.
    expect(landHistoryProfile('มันสำปะหลัง').flags.herbicideWatch).toBe(false);
    expect(landHistoryProfile('ยางพารา').flags.herbicideWatch).toBe(false);
  });

  it('treats cassava as a potassium problem specifically, not a generic one', () => {
    const cassava = landHistoryProfile('มันสำปะหลัง');
    expect(cassava.flags.kDeficit).toBe(true);
    expect(landHistoryProfile('ข้าวโพดเลี้ยงสัตว์').flags.kDeficit).toBe(false);
  });

  it('gates expensive trees only where the soil cannot carry them', () => {
    expect(landHistoryProfile('พื้นที่เสื่อมโทรม').gatedSpecies).toContain('avocado');
    expect(landHistoryProfile('พื้นที่เสื่อมโทรม').gatedSpecies).toContain('coffee');
    expect(landHistoryProfile('สวนผสม').gatedSpecies ?? []).toHaveLength(0);
  });
});

describe('rubber — the case the old model got backwards', () => {
  const rubber = landHistoryProfile('ยางพารา');

  // It was the most expensive prior use in the table at 6,800 ฿/rai, with no source, while
  // RAOT pays a replanting grant and the wood itself sells.
  it('refuses to invent a clearing cost, because no published Thai figure exists', () => {
    expect(rubber.clearingCostPerRai).toBeNull();
  });

  it('points at the กยท. grant without quoting a rate', () => {
    expect(rubber.grantPointer).toBeTruthy();
    expect(rubber.flags.grantEligible).toBe(true);
    // Rates and application windows reset every fiscal year — a hard-coded number would be
    // stale within a year and wrong in a farmer's hands.
    expect(rubber.grantPointer).not.toMatch(/\d{4,}/);
  });

  it('offers the officially documented under-rubber species instead of forcing a fell', () => {
    expect(rubber.flags.standingRubber).toBe(true);
    // กรมวิชาการเกษตร's age-banded list; all six already exist in this app.
    expect(rubber.underplantSpecies).toEqual(
      expect.arrayContaining(['ginger', 'galangal', 'turmeric', 'banana']),
    );
  });

  it('does not treat rubber land as arriving in better shape than maize', () => {
    expect(rubber.flags.erosionUrgent).toBe(true);
  });
});

describe('claims the model deliberately does NOT make', () => {
  it('never mentions a multi-year paraquat or glyphosate wait', () => {
    const all = Object.values([
      'ข้าวโพดเลี้ยงสัตว์', 'มันสำปะหลัง', 'ยางพารา', 'ข้าวไร่', 'ไม้ผลผสม',
      'สวนผสม', 'ป่า/ไม้ยืนต้นเดิม', 'พื้นที่ว่าง/เพิ่งถาง', 'พื้นที่เสื่อมโทรม', 'อื่นๆ',
    ].map(landHistoryProfile));
    const text = all.flatMap((p) => [...p.year0Actions, p.warning ?? '']).join(' ');
    expect(text).not.toMatch(/พาราควอต|ไกลโฟเซต|glyphosate|paraquat/i);
  });

  it('keeps farmer-facing output short — at most one warning and three actions per use', () => {
    for (const id of ['ข้าวโพดเลี้ยงสัตว์', 'ยางพารา', 'พื้นที่เสื่อมโทรม']) {
      const p = landHistoryProfile(id);
      expect(p.year0Actions.length).toBeLessThanOrEqual(2);
      expect(typeof p.warning === 'string' || p.warning === undefined).toBe(true);
    }
  });
});

describe('transitionBreakdown', () => {
  it('splits the cost instead of returning one opaque number', () => {
    const b = transitionBreakdown([zone('ข้าวโพดเลี้ยงสัตว์', 10)]);
    expect(b.clearing).toBe(9000);
    expect(b.soilRepair).toBe(15000);
    expect(b.total).toBe(24000);
    expect(b.clearingNeedsQuote).toBe(false);
  });

  // A null clearing cost is "go get a quote", which must not silently become 0 in a total
  // the farmer reads as complete.
  it('reports rubber clearing as needing a quote rather than counting it as free', () => {
    const b = transitionBreakdown([zone('ยางพารา', 10)]);
    expect(b.clearingNeedsQuote).toBe(true);
    expect(b.clearing).toBe(0);
    expect(b.soilRepair).toBe(6000);
    expect(b.grantPointers.length).toBe(1);
  });

  it('ORs flags across mixed zones — any zone needing care makes the plot need it', () => {
    const b = transitionBreakdown([zone('สวนผสม', 5), zone('มันสำปะหลัง', 5)]);
    expect(b.flags.kDeficit).toBe(true);
    expect(b.flags.erosionUrgent).toBe(true);
  });

  it('ignores zones with no area or no crop', () => {
    const b = transitionBreakdown([
      zone('ข้าวโพดเลี้ยงสัตว์', 0),
      { id: 'x', cropId: '', areaRai: 5 },
    ]);
    expect(b.total).toBe(0);
    expect(b.flags.acidRisk).toBe(false);
  });

  it('resists a prototype-chain cropId', () => {
    const b = transitionBreakdown([zone('constructor', 10)]);
    expect(Number.isFinite(b.total)).toBe(true);
    expect(b.total).toBe(14000); // falls back to อื่นๆ: 700 + 700
  });

  it('de-duplicates guidance when two zones share a history', () => {
    const b = transitionBreakdown([zone('ข้าวโพดเลี้ยงสัตว์', 5), zone('ข้าวโพดเลี้ยงสัตว์', 5)]);
    expect(b.warnings).toHaveLength(1);
    expect(b.year0Actions).toHaveLength(2);
    expect(b.total).toBe(24000); // still costed per rai across both zones
  });
});
