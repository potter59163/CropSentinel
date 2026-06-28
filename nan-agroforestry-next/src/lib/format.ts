export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const baht = (v: number) => '฿' + Math.round(v).toLocaleString('en-US');
export const bahtK = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return (v < 0 ? '-' : '') + '฿' + (a / 1_000_000).toFixed(2) + 'M';
  if (a >= 1000) return (v < 0 ? '-' : '') + '฿' + Math.round(a / 1000) + 'k';
  return '฿' + Math.round(v);
};
export const pct = (v: number) => Math.round(v * 100) + '%';
export const nf0 = (v: number) => Math.round(v).toLocaleString('en-US');
