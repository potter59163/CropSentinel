// Real plot features for the SDM — same set the model was trained on.
// NASA POWER monthly climatology (→ bioclim) + DEM elevation. Free, no key, CORS-OK.
// (Soil was dropped: SoilGrids is CORS-blocked in-browser, so it can't be served at
//  inference time; training without it keeps train/runtime consistent and honest.)
export interface Climate {
  t2m: number; prec: number; drym: number; pseas: number; trange: number;
  solar: number; rh: number; gwet: number; elev: number;
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const tfetch = (url: string, ms = 9000) => fetch(url, { signal: AbortSignal.timeout(ms) });

async function powerFeatures(lat: number, lng: number) {
  const url =
    'https://power.larc.nasa.gov/api/temporal/climatology/point' +
    '?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,GWETROOT,T2M_MAX,T2M_MIN' +
    `&community=AG&longitude=${lng}&latitude=${lat}&format=JSON`;
  const p = (await (await tfetch(url)).json()).properties.parameter;
  const mm = MON.map((m) => p.PRECTOTCORR[m] * 30); // mm/month
  const mean = mm.reduce((a, b) => a + b, 0) / 12;
  const sd = Math.sqrt(mm.reduce((s, x) => s + (x - mean) ** 2, 0) / 12);
  return {
    t2m: p.T2M.ANN,
    prec: mm.reduce((a, b) => a + b, 0),
    drym: mm.filter((x) => x < 50).length,
    pseas: (sd / (mean + 1)) * 100,
    trange: p.T2M_MAX.ANN - p.T2M_MIN.ANN,
    solar: p.ALLSKY_SFC_SW_DWN.ANN,
    rh: p.RH2M.ANN,
    gwet: p.GWETROOT.ANN,
  };
}

// Deliberately does NOT swallow the POWER error. If we returned NaN features
// here, the SDM would silently impute the training median and still report
// source:'model' at full confidence — i.e. rank crops as if we had real climate
// when we have none. Throwing lets planRunner catch it, surface a warning, and
// fall back to the honest elevation-only envelope (source:'envelope', low
// confidence). Callers that hit this directly must handle the rejection.
export async function fetchClimate(lat: number, lng: number, elevationM: number): Promise<Climate> {
  const pw = await powerFeatures(lat, lng);
  return { ...pw, elev: elevationM };
}
