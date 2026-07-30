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

  it('names the legal classes it cannot check, so the UI can state the gap', () => {
    // A negative result covers the sanctuary layer only. These are what actually decide
    // whether clearing Nan highland farmland is prosecutable — and อุทยานแห่งชาติ belongs
    // here too, because this GISTDA service exposes no genuine park boundary layer.
    expect(UNCHECKED_LEGAL_CLASSES).toContain('อุทยานแห่งชาติ');
    expect(UNCHECKED_LEGAL_CLASSES).toContain('ป่าสงวนแห่งชาติ');
    expect(UNCHECKED_LEGAL_CLASSES).toContain('ลุ่มน้ำชั้น 1A');
  });
});
