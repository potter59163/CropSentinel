// Thailand bounding box (generous margin around Nan province) and elevation
// range (Doi Inthanon, the country's highest peak, is ~2565m). Used to reject
// bogus coordinates before we spend external API quota (NASA POWER, GISTDA,
// ISRIC, Open-Meteo) on them.
export const TH_LAT_MIN = 5;
export const TH_LAT_MAX = 22;
export const TH_LNG_MIN = 97;
export const TH_LNG_MAX = 106.5;
export const TH_ELEV_MIN = 0;
export const TH_ELEV_MAX = 2600;

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= TH_LAT_MIN && lat <= TH_LAT_MAX &&
    lng >= TH_LNG_MIN && lng <= TH_LNG_MAX
  );
}

export function isValidElevation(elevationM: number): boolean {
  return Number.isFinite(elevationM) && elevationM >= TH_ELEV_MIN && elevationM <= TH_ELEV_MAX;
}

export function parseLatLng(searchParams: URLSearchParams): { lat: number; lng: number } | null {
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}
