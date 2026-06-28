export const nf = (v: number) => v.toLocaleString('en-US');
export const nf0 = (v: number) => Math.round(v).toLocaleString('en-US');
export const nf1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const raiToK = (rai: number) => `${Math.round(rai / 1000).toLocaleString('en-US')}k`;

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
export function round2(v: number) {
  return Math.round(v * 100) / 100;
}
export function avg(arr: number[]) {
  const valid = arr.filter((v) => v != null && !Number.isNaN(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}
