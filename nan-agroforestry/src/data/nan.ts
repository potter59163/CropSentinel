// Nan province amphoe with representative centroid elevation (m).
export interface Amphoe { id: string; nameTh: string; lat: number; lng: number; elevationM: number }

export const NAN_AMPHOE: Amphoe[] = [
  { id: 'mueang', nameTh: 'เมืองน่าน', lat: 18.783, lng: 100.778, elevationM: 210 },
  { id: 'pua', nameTh: 'ปัว', lat: 19.179, lng: 100.907, elevationM: 420 },
  { id: 'thawangpha', nameTh: 'ท่าวังผา', lat: 19.110, lng: 100.799, elevationM: 280 },
  { id: 'wiangsa', nameTh: 'เวียงสา', lat: 18.566, lng: 100.745, elevationM: 200 },
  { id: 'nanoi', nameTh: 'นาน้อย', lat: 18.317, lng: 100.706, elevationM: 320 },
  { id: 'santisuk', nameTh: 'สันติสุข', lat: 18.900, lng: 100.939, elevationM: 480 },
  { id: 'bokluea', nameTh: 'บ่อเกลือ', lat: 19.094, lng: 101.165, elevationM: 950 },
  { id: 'chaloemphrakiat', nameTh: 'เฉลิมพระเกียรติ', lat: 19.470, lng: 101.247, elevationM: 1080 },
  { id: 'thungchang', nameTh: 'ทุ่งช้าง', lat: 19.408, lng: 100.882, elevationM: 520 },
  { id: 'chiangklang', nameTh: 'เชียงกลาง', lat: 19.296, lng: 100.866, elevationM: 460 },
  { id: 'maecharim', nameTh: 'แม่จริม', lat: 18.683, lng: 100.967, elevationM: 360 },
  { id: 'banluang', nameTh: 'บ้านหลวง', lat: 18.836, lng: 100.585, elevationM: 540 },
];

export const NAN_CENTER = { lat: 18.78, lng: 100.78 };
