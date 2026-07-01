import { describe, expect, it } from 'vitest';
import { lookupLddSoilGroup } from './ldd';
import { mergeLddSoil } from './soil';

describe('LDD Nan soil-group overlay', () => {
  it('finds an official LDD soil group for a Nan plot coordinate', () => {
    const ldd = lookupLddSoilGroup(19.179, 100.907);
    expect(ldd).not.toBeNull();
    expect(ldd?.source).toContain('LDD');
    expect(ldd?.soilGroup).toBeTruthy();
  });

  it('uses LDD as agronomic context without pretending it is SoilGrids SDM input', () => {
    const ldd = lookupLddSoilGroup(19.179, 100.907);
    const merged = mergeLddSoil(null, ldd);
    expect(merged).not.toBeNull();
    expect(merged?.ldd?.soilGroup).toBe(ldd?.soilGroup);
    expect(merged?.sdmFeatureSource).toBe('none');
  });
});
