import { describe, it, expect } from 'vitest';
import { PLANTS } from '../data/plants';
import { provenanceOf, provenanceNote, TIER_META } from './provenance';
import sdmModel from '../data/sdm_model.json';

/**
 * The provenance badge is the app's answer to "ตัวเลขนี้เอามาจากไหน", printed beside every
 * species. An overstated badge is worse than no badge — it invites a reviewer to open the source
 * and find it does not say what the app claims.
 */
describe('provenance', () => {
  it('gives every species a tier with a rendered label', () => {
    for (const p of PLANTS) {
      const tier = provenanceOf(p.id);
      expect(TIER_META[tier], `${p.nameTh} has an unrenderable tier`).toBeDefined();
      expect(TIER_META[tier].shortTh.length).toBeGreaterThan(0);
    }
  });

  it('names the mismatch for every partially-backed species', () => {
    // The whole point of the middle tier: "official but not quite" is only useful if it says
    // which way it is off. A partial tier with no note reads as a weaker official claim.
    const partial = PLANTS.filter((p) => provenanceOf(p.id) === 'research');
    expect(partial.length).toBeGreaterThan(0);
    for (const p of partial) {
      expect(provenanceNote(p.id), `${p.nameTh} is 'research' with no explanation`).toBeTruthy();
    }
  });

  it('does not claim official backing for a different product of the same plant', () => {
    // ชาเมี่ยง and กาแฟ are the two cases: the species matches an OAE series, the product does
    // not. Assam tea in the cost workbook is a managed tea garden; ชาเมี่ยง is fermented leaf
    // off old shade-grown stands, on a local market.
    expect(provenanceOf('tea')).toBe('research');
    expect(provenanceOf('coffee')).toBe('research');
    expect(provenanceNote('tea')).toMatch(/ชาอัสสัม/);
  });

  it('has no species pointing at a distribution model that does not exist', () => {
    // ชาเมี่ยง carried sdmId 'tea' with no such key in the model, so it advertised an SDM while
    // silently using the elevation envelope. A dangling id is indistinguishable on screen from
    // a real one.
    const keys = new Set(Object.keys((sdmModel as Record<string, unknown>).species ?? sdmModel));
    const dangling = PLANTS.filter((p) => p.sdmId && !keys.has(p.sdmId));
    expect(dangling.map((p) => `${p.id} -> ${p.sdmId}`)).toEqual([]);
  });
});
