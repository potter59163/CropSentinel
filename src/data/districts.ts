import type { District } from './types';

// Representative fire-prone amphoe of Chiang Mai with real centroids.
// maizeAreaRai / forestRai / encroachment are realistic-order prototype figures
// (Chiang Mai is one of Thailand's largest feed-maize + hotspot provinces).
// elevation/slope drive the upslope fire-spread model; fuelSusc reflects
// deciduous dipterocarp leaf-litter loading that peaks in the Feb–Apr dry season.
export const CHIANG_MAI_DISTRICTS: District[] = [
  mk('mueang', 'Mueang Chiang Mai', 'เมืองเชียงใหม่', 18.788, 98.985, 320, 4, 'agriculture', 12000, 48000, 120, 0.45),
  mk('maerim', 'Mae Rim', 'แม่ริม', 18.916, 98.898, 480, 14, 'mixed', 38000, 196000, 640, 0.62),
  mk('hangdong', 'Hang Dong', 'หางดง', 18.688, 98.918, 360, 8, 'mixed', 26000, 92000, 410, 0.55),
  mk('sansai', 'San Sai', 'สันทราย', 18.861, 99.047, 340, 5, 'agriculture', 21000, 64000, 230, 0.48),
  mk('doisaket', 'Doi Saket', 'ดอยสะเก็ด', 18.866, 99.137, 420, 12, 'mixed', 34000, 168000, 720, 0.6),
  mk('samoeng', 'Samoeng', 'สะเมิง', 18.846, 98.728, 1020, 24, 'deciduous', 58000, 286000, 1180, 0.82),
  mk('maetaeng', 'Mae Taeng', 'แม่แตง', 19.118, 98.948, 560, 18, 'mixed', 47000, 244000, 980, 0.68),
  mk('chiangdao', 'Chiang Dao', 'เชียงดาว', 19.366, 98.969, 760, 26, 'deciduous', 52000, 412000, 1520, 0.84),
  mk('maechaem', 'Mae Chaem', 'แม่แจ่ม', 18.503, 98.372, 940, 28, 'deciduous', 96000, 528000, 2640, 0.9),
  mk('chomthong', 'Chom Thong', 'จอมทอง', 18.417, 98.674, 680, 22, 'deciduous', 61000, 318000, 1340, 0.8),
  mk('hot', 'Hot', 'ฮอด', 18.151, 98.594, 520, 20, 'deciduous', 73000, 366000, 1880, 0.83),
  mk('doitao', 'Doi Tao', 'ดอยเต่า', 17.919, 98.692, 440, 17, 'deciduous', 68000, 224000, 1610, 0.81),
  mk('omkoi', 'Omkoi', 'อมก๋อย', 17.792, 98.362, 1080, 30, 'deciduous', 118000, 612000, 3420, 0.94),
  mk('maewang', 'Mae Wang', 'แม่วาง', 18.623, 98.711, 720, 23, 'mixed', 44000, 198000, 1020, 0.74),
];

function mk(
  id: string, name: string, nameTh: string,
  lat: number, lng: number,
  elevationM: number, slopeDeg: number,
  forestType: District['forestType'],
  maizeAreaRai: number, forestRai: number, encroachmentRai: number,
  fuelSusc: number,
): District {
  return {
    id, name, nameTh, lat, lng, elevationM, slopeDeg, forestType,
    maizeAreaRai, forestRai, encroachmentRai, fuelSusc,
    // live fields default to neutral; data sources overwrite them
    ndvi: 0.5, dryness: 0.5, pm25: 40, hotspots: 0, frpSum: 0, fireRisk: 'MEDIUM',
  };
}

// Chiang Mai bounding box for satellite queries (lon/lat)
export const CHIANG_MAI_BBOX = { minLng: 97.9, minLat: 17.3, maxLng: 99.7, maxLat: 19.9 };
export const CHIANG_MAI_CENTER = { lat: 18.79, lng: 98.98 };
