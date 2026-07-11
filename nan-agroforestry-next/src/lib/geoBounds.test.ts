import { describe, it, expect } from 'vitest';
import { isValidLatLng, isValidElevation, parseLatLng } from './geoBounds';

describe('geoBounds — coordinate validation (external-API abuse guard)', () => {
  it('accepts real Nan-province coordinates', () => {
    expect(isValidLatLng(18.78, 100.78)).toBe(true);
    expect(isValidLatLng(19.4, 101.2)).toBe(true);
  });

  it('rejects out-of-Thailand and garbage coordinates', () => {
    expect(isValidLatLng(999999, 100.78)).toBe(false); // the audit's abuse case
    expect(isValidLatLng(0, 0)).toBe(false);
    expect(isValidLatLng(18.78, 200)).toBe(false);
    expect(isValidLatLng(NaN, 100)).toBe(false);
    expect(isValidLatLng(18.78, NaN)).toBe(false);
  });

  it('bounds elevation to the Thai physical range', () => {
    expect(isValidElevation(400)).toBe(true);
    expect(isValidElevation(0)).toBe(true);
    expect(isValidElevation(2600)).toBe(true);
    expect(isValidElevation(99999)).toBe(false);
    expect(isValidElevation(-10)).toBe(false);
    expect(isValidElevation(NaN)).toBe(false);
  });

  it('parseLatLng returns coords for valid params and null for invalid', () => {
    expect(parseLatLng(new URLSearchParams('lat=18.78&lng=100.78'))).toEqual({ lat: 18.78, lng: 100.78 });
    expect(parseLatLng(new URLSearchParams('lat=999&lng=100'))).toBeNull();
    expect(parseLatLng(new URLSearchParams('lat=abc&lng=100'))).toBeNull();
    expect(parseLatLng(new URLSearchParams(''))).toBeNull();
  });
});
