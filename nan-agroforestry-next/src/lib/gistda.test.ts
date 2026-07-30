import { describe, it, expect, afterEach, vi } from 'vitest';
import { checkProtected, UNCHECKED_LEGAL_CLASSES } from './gistda';

// The park/sanctuary lookup decides whether the UI may say anything reassuring about
// legality. Before protectedStatus existed, the two queries sat un-wrapped: a single
// HTTP error rejected checkProtected, planRunner turned it into `protectedArea: null`,
// and every optional-chained UI branch fell through to the SAME "plantable" headline a
// genuine clear result produces. On a rural connection that is a routine outage, so the
// app could tell a farmer their land was fine because the network failed.

const NAN_LAT = 19.179;
const NAN_LNG = 100.907;

function stubFetch(handler: (url: string) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = handler(url);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body } as Response;
  }));
}

// Only layer 2 carries a real protected-area boundary; layer 1 is forest cover.
const isProtectedLayerQuery = (url: string) => url.includes('/MapServer/2/query');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkProtected — an outage must never read as a clear result', () => {
  it('reports protectedStatus "unavailable" when the park/sanctuary query fails', async () => {
    stubFetch((url) => {
      if (isProtectedLayerQuery(url)) throw new Error('GISTDA HTTP 503');
      return { features: [] };
    });

    const r = await checkProtected(NAN_LAT, NAN_LNG);
    expect(r.protectedStatus).toBe('unavailable');
    // inside/near are meaningless defaults here — the UI must gate on protectedStatus,
    // never on `!inside && !near`.
    expect(r.inside).toBe(false);
    expect(r.near).toBe(false);
  });

  it('still resolves (does not reject) so the rest of the plan survives the outage', async () => {
    stubFetch((url) => {
      if (isProtectedLayerQuery(url)) throw new Error('GISTDA HTTP 500');
      return { features: [] };
    });
    // The whole point: one failed legal query used to take down every other signal.
    await expect(checkProtected(NAN_LAT, NAN_LNG)).resolves.toBeTruthy();
  });

  it('reports protectedStatus "ok" with a genuine negative, distinguishable from an outage', async () => {
    stubFetch(() => ({ features: [] }));
    const r = await checkProtected(NAN_LAT, NAN_LNG);
    expect(r.protectedStatus).toBe('ok');
    expect(r.inside).toBe(false);
    expect(r.near).toBe(false);
  });

  it('detects a genuine wildlife-sanctuary hit from layer 2 and names it from FR_NAME', async () => {
    stubFetch((url) => {
      if (url.includes('/MapServer/2/query')) {
        // DESC_TH on this layer is truncated to 16 chars, so FR_NAME must win.
        return { features: [{ attributes: { FR_NAME: 'ดอยผาช้าง', DESC_TH: 'พื้นที่เขตรักษาพ', CHANGWAT_T: 'น่าน' } }] };
      }
      return { features: [] };
    });

    const r = await checkProtected(NAN_LAT, NAN_LNG);
    expect(r.inside).toBe(true);
    expect(r.protectedStatus).toBe('ok');
    expect(r.type).toBe('เขตรักษาพันธุ์สัตว์ป่า');
    expect(r.name).toBe('ดอยผาช้าง');
  });

  // GISTDA layer 1 is *named* "เขตอุทยานแห่งชาติ" but its content is a 2013-14 LANDSAT-8
  // forest-COVER interpretation — its only DESC_TH value is "พื้นที่ที่มีป่าไม้ปกคลุม …" and it
  // holds no park names. Wired up as a legal boundary it told farmers in บ่อเกลือ and
  // แม่จริม their ordinary farmland was inside a national park purely because it had tree
  // cover in 2014 — worse the more trees they had kept. It must never set inside/near.
  it('treats layer 1 as forest cover only — it can never produce a legal verdict', async () => {
    stubFetch((url) => {
      if (url.includes('/MapServer/1/query')) {
        return { features: [{ attributes: { DESC_TH: 'พื้นที่ที่มีป่าไม้ปกคลุม ซึ่งรวมทั้งป่าธรรมชาติ และพื้นที่ปลูกสร้างสวนป่า' } }] };
      }
      return { features: [] };
    });

    const r = await checkProtected(NAN_LAT, NAN_LNG);
    expect(r.forestCover).toBe(true);
    expect(r.forestCoverStatus).toBe('ok');
    // The legal verdict must stay clear of it entirely.
    expect(r.inside).toBe(false);
    expect(r.near).toBe(false);
    expect(r.type).toBeUndefined();
  });

  it('degrades forest cover independently of the legal check', async () => {
    stubFetch((url) => {
      if (url.includes('/MapServer/1/query')) throw new Error('GISTDA HTTP 500');
      return { features: [] };
    });
    const r = await checkProtected(NAN_LAT, NAN_LNG);
    expect(r.forestCoverStatus).toBe('unavailable');
    expect(r.protectedStatus).toBe('ok');
  });

  // ป่าสงวนแห่งชาติ is the class that decides whether clearing Nan highland farmland is
  // prosecutable: on a 48-point Nan grid it hits 70.8% of points vs 8.3% for the sanctuary
  // layer. Its source is an unofficial 2019 mirror of RFD data with an approximate boundary,
  // so a hit is a warning and a miss is never clearance.
  describe('reserved forest (ป่าสงวนแห่งชาติ)', () => {
    const rfHit = {
      features: [{ attributes: { FR_ID: 'H2.016', FR_NAME: 'ป่าดอยภูคาและป่าผาแดง', AREA_RAI: 1565312 } }],
    };
    const isReservedQuery = (url: string) => url.includes('/FeatureServer/4/query');

    it('reports a hit with its name, code and area', async () => {
      stubFetch((url) => (isReservedQuery(url) ? rfHit : { features: [] }));
      const r = await checkProtected(NAN_LAT, NAN_LNG);
      expect(r.reservedForest).toBe(true);
      expect(r.reservedForestStatus).toBe('ok');
      expect(r.reservedForestName).toBe('ป่าดอยภูคาและป่าผาแดง');
      expect(r.reservedForestCode).toBe('H2.016');
      expect(r.reservedForestAreaRai).toBe(1565312);
    });

    it('does not let a reserved-forest hit masquerade as a sanctuary determination', async () => {
      // These are separate legal classes with separate consequences; a reserved-forest hit
      // must not set `inside`, which drives the hard "หยุด · ผิดกฎหมาย" stop.
      stubFetch((url) => (isReservedQuery(url) ? rfHit : { features: [] }));
      const r = await checkProtected(NAN_LAT, NAN_LNG);
      expect(r.inside).toBe(false);
      expect(r.near).toBe(false);
    });

    it('marks a failed query unavailable rather than reporting "not in reserved forest"', async () => {
      stubFetch((url) => {
        if (isReservedQuery(url)) throw new Error('RFD reserved-forest HTTP 503');
        return { features: [] };
      });
      const r = await checkProtected(NAN_LAT, NAN_LNG);
      expect(r.reservedForestStatus).toBe('unavailable');
      expect(r.reservedForest).toBe(false); // meaningless default — UI must gate on the status
    });

    it('treats an ArcGIS error object (HTTP 200, no features array) as a failure', async () => {
      // ArcGIS returns errors with a 200, so a missing `features` array must not read as
      // an empty result — that would render as "ไม่พบ" and imply the land is clear.
      stubFetch((url) => (isReservedQuery(url)
        ? { error: { code: 400, message: 'Invalid query parameters' } }
        : { features: [] }));
      const r = await checkProtected(NAN_LAT, NAN_LNG);
      expect(r.reservedForestStatus).toBe('unavailable');
    });

    it('degrades independently of the sanctuary check', async () => {
      stubFetch((url) => {
        if (isReservedQuery(url)) throw new Error('down');
        return { features: [] };
      });
      const r = await checkProtected(NAN_LAT, NAN_LNG);
      expect(r.reservedForestStatus).toBe('unavailable');
      expect(r.protectedStatus).toBe('ok');
    });
  });

  it('names the legal classes it cannot check, so the UI can state the gap', () => {
    // อุทยานแห่งชาติ is listed because this GISTDA service exposes no genuine park layer,
    // and ลุ่มน้ำชั้น 1A because no live source exists by any route.
    expect(UNCHECKED_LEGAL_CLASSES).toContain('อุทยานแห่งชาติ');
    expect(UNCHECKED_LEGAL_CLASSES).toContain('ลุ่มน้ำชั้น 1A');
    // ป่าสงวนแห่งชาติ IS now checked, so it must have been removed from the unchecked list —
    // otherwise the UI tells the farmer it was skipped while a warning for it is on screen.
    expect(UNCHECKED_LEGAL_CLASSES).not.toContain('ป่าสงวนแห่งชาติ');
  });
});
