import { describe, it, expect } from 'vitest';
import { classifyTexture, classifyDrainage, classifyAcidity, fertilityScore, mergeLddSoil, type SoilContext } from './soil';
import type { LddSoilGroupContext } from './ldd';

describe('soil classifiers (agronomic thresholds)', () => {
  it('classifies texture by the USDA triangle', () => {
    expect(classifyTexture(20, 20, 60).en).toBe('clay');
    expect(classifyTexture(90, 5, 5).en).toBe('sand');
    expect(classifyTexture(40, 45, 15).en).toBe('loam');
  });

  it('maps drainage to clay/sand content', () => {
    expect(classifyDrainage(20, 40).d).toBe('poor');   // heavy clay → waterlogs
    expect(classifyDrainage(70, 10).d).toBe('good');    // sandy → drains fast
    expect(classifyDrainage(40, 28).d).toBe('moderate');
  });

  it('maps pH to acidity classes', () => {
    expect(classifyAcidity(4.5).a).toBe('strong');
    expect(classifyAcidity(5.2).a).toBe('moderate');
    expect(classifyAcidity(6.0).a).toBe('slight');
    expect(classifyAcidity(7.0).a).toBe('neutral');
  });

  it('fertility rewards organic carbon, CEC, and near-neutral pH', () => {
    const rich = fertilityScore(3, 250, 6.3);
    const poor = fertilityScore(0.2, 20, 4.3);
    expect(rich).toBeGreaterThan(poor);
    expect(rich).toBeLessThanOrEqual(1);
    expect(poor).toBeGreaterThanOrEqual(0);
  });
});

const LDD: LddSoilGroupContext = {
  soilGroup: '33', soilGroupLabel: 'กลุ่มชุดดิน 33', textureTopCode: 'sil', textureTopTh: 'ดินร่วนปนทรายแป้ง',
  textureLowCode: 'sicl', textureLowTh: 'ดินร่วนเหนียวปนทรายแป้ง', phTopRange: '6.0-7.0', phLowRange: '6.0-7.0',
  phEstimate: 6.5, acidity: 'slight', acidityTh: 'กรดเล็กน้อย', fertilityCode: 'M', fertilityTh: 'ปานกลาง',
  fertility: 0.55, drainage: 'moderate', drainageTh: 'ระบายน้ำปานกลาง', limitations: [],
  source: 'LDD กลุ่มชุดดิน จ.น่าน 1:25,000', scale: '1:25,000',
};

describe('mergeLddSoil — data-honesty of the LDD/SoilGrids merge', () => {
  it('keeps SoilGrids as the measured source and overlays LDD drainage/acidity', () => {
    const soilgrids: SoilContext = {
      ph: 5.4, organicCarbonPct: 1.8, nitrogenPct: 0.12, clayPct: 30, sandPct: 40, siltPct: 30, cec: 120,
      texture: 'ดินร่วนเหนียว', textureEn: 'clay loam', drainage: 'good', drainageTh: 'ระบายน้ำดี',
      acidity: 'moderate', acidityTh: 'กรดปานกลาง', fertility: 0.5, fertilityTh: 'ปานกลาง',
      depthLabel: '0–15 ซม. (เฉลี่ย)', source: 'SoilGrids (ISRIC) 250 m', sdmFeatureSource: 'soilgrids',
    };
    const merged = mergeLddSoil(soilgrids, LDD)!;
    expect(merged.sdmFeatureSource).toBe('soilgrids'); // real measurements still feed the model
    expect(merged.drainage).toBe('moderate');          // LDD overlay wins for local drainage
    expect(merged.organicCarbonPct).toBe(1.8);         // measured value preserved
  });

  it('flags LDD-only soil as NOT model-grade so fabricated chemistry never enters the SDM', () => {
    const merged = mergeLddSoil(null, LDD)!;
    // sdmFeatureSource 'none' is the guard that keeps the 0% OC / 0 CEC placeholders
    // out of the model feature vector (the UI now labels them "ยังไม่มีผลตรวจ").
    expect(merged.sdmFeatureSource).toBe('none');
    expect(merged.organicCarbonPct).toBe(0);
    expect(merged.ldd).toBeTruthy();
    expect(merged.drainage).toBe('moderate');
  });

  it('returns the SoilGrids reading unchanged when there is no LDD polygon', () => {
    expect(mergeLddSoil(null, null)).toBeNull();
  });
});
