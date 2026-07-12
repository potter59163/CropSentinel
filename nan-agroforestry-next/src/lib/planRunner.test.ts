import { describe, it, expect } from 'vitest';
import { withPriceOverrides } from './planRunner';
import type { FarmInput } from '../data/types';

const baseInput: FarmInput = {
  currentCropId: null,
  sizeRai: 5,
  elevationM: 500,
  locationLabel: 'test',
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
  goal: 'balanced',
};

describe('withPriceOverrides — site-wide admin price vs per-plan farmer override', () => {
  it('leaves input untouched when there are no admin overrides', () => {
    expect(withPriceOverrides(baseInput, {})).toBe(baseInput);
  });

  it('injects an admin price as a synthesized crop assumption', () => {
    const result = withPriceOverrides(baseInput, { mango: { pricePerKg: 33 } });
    expect(result.cropAssumptions).toEqual([{ plantId: 'mango', pricePerKg: 33 }]);
  });

  it('lets an explicit farmer-typed price win over the admin default', () => {
    const input: FarmInput = { ...baseInput, cropAssumptions: [{ plantId: 'mango', pricePerKg: 50 }] };
    const result = withPriceOverrides(input, { mango: { pricePerKg: 33 } });
    expect(result.cropAssumptions).toEqual([{ plantId: 'mango', pricePerKg: 50 }]);
  });

  it('keeps the admin price when the farmer overrides a different field on the same crop', () => {
    const input: FarmInput = { ...baseInput, cropAssumptions: [{ plantId: 'mango', yieldKgPerRai: 1200 }] };
    const result = withPriceOverrides(input, { mango: { pricePerKg: 33 } });
    expect(result.cropAssumptions).toEqual([{ plantId: 'mango', pricePerKg: 33, yieldKgPerRai: 1200 }]);
  });
});
