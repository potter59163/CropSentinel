import { useState } from 'react';
import type { CropAssumption, FarmInput, Goal, Layer } from '../data/types';
import { byLayer, LAYER_META, PLANTS } from '../data/plants';
import { NAN_AMPHOE, NAN_CENTER } from '../data/nan';
import { Card, Field } from './ui';
import { PlantGlyph } from './PlantGlyph';
import { getGeolocation, fetchElevation } from '../lib/elevation';
import { GoogleMapPicker } from './GoogleMapPicker';

const goals: Array<{ id: Goal; label: string; desc: string }> = [
  { id: 'balanced', label: '‡∏™‡∏°‡∏î‡∏∏‡∏•', desc: '‡πÄ‡∏´‡πá‡∏ô‡∏ú‡∏•‡πÑ‡∏ß + ‡∏Å‡∏≥‡πÑ‡∏£‡∏î‡∏µ' },
  { id: 'fast', label: '‡πÄ‡∏´‡πá‡∏ô‡∏ú‡∏•‡πÑ‡∏ß', desc: '‡∏Ñ‡∏∑‡∏ô‡∏ó‡∏∏‡∏ô‡πÄ‡∏£‡πá‡∏ß‡∏ó‡∏µ‡πà‡∏™‡∏∏‡∏î' },
  { id: 'profit', label: '‡∏Å‡∏≥‡πÑ‡∏£‡∏™‡∏π‡∏á‡∏™‡∏∏‡∏î', desc: '‡∏°‡∏≠‡∏á‡∏¢‡∏≤‡∏ß 10 ‡∏õ‡∏µ' },
];

const CURRENT_CROPS = ['‡∏Ç‡πâ‡∏≤‡∏ß‡πÇ‡∏û‡∏î‡πÄ‡∏•‡∏µ‡πâ‡∏¢‡∏á‡∏™‡∏±‡∏ï‡∏ß‡πå', '‡∏Ç‡πâ‡∏≤‡∏ß‡πÑ‡∏£‡πà', '‡∏¢‡∏≤‡∏á‡∏û‡∏≤‡∏£‡∏≤', '‡∏°‡∏±‡∏ô‡∏™‡∏≥‡∏õ‡∏∞‡∏´‡∏•‡∏±‡∏á', '‡∏û‡∏∑‡πâ‡∏ô‡∏ó‡∏µ‡πà‡∏ß‡πà‡∏≤‡∏á/‡πÄ‡∏û‡∏¥‡πà‡∏á‡∏ñ‡∏≤‡∏á'];
const LAYERS: Layer[] = ['canopy', 'shrub', 'groundcover', 'root'];

export function InputForm({ value, onChange, onSubmit, busy }: {
  value: FarmInput; onChange: (v: FarmInput) => void; onSubmit: () => void; busy: boolean;
}) {
  const [gps, setGps] = useState<'idle' | 'loading' | 'error'>('idle');
  const [osm, setOsm] = useState<'idle' | 'loading' | 'error'>('idle');
  const set = (patch: Partial<FarmInput>) => onChange({ ...value, ...patch });
  const selectedByLayer = value.selectedByLayer ?? { canopy: [], shrub: [], groundcover: [], root: [] };
  const selectedTotal = LAYERS.reduce((sum, layer) => sum + (selectedByLayer[layer]?.length ?? 0), 0);
  const selectedPlantIds = LAYERS.flatMap((layer) => selectedByLayer[layer] ?? []);
  const assumption = (plantId: string) => value.cropAssumptions?.find((a) => a.plantId === plantId) ?? { plantId };
  const setAssumption = (plantId: string, patch: Partial<CropAssumption>) => {
    const current = value.cropAssumptions ?? [];
    const found = current.some((a) => a.plantId === plantId);
    set({
      cropAssumptions: found
        ? current.map((a) => a.plantId === plantId ? { ...a, ...patch } : a)
        : [...current, { plantId, ...patch }],
    });
  };
  const togglePlant = (layer: Layer, id: string) => {
    const a = selectedByLayer[layer] ?? [];
    set({
      selectedByLayer: {
        ...selectedByLayer,
        [layer]: a.includes(id) ? a.filter((x) => x !== id) : [...a, id],
      },
    });
  };

  const useGps = async () => {
    setGps('loading');
    try {
      const { lat, lng } = await getGeolocation();
      const elev = await fetchElevation(lat, lng);
      set({ lat, lng, elevationM: elev, locationLabel: `GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setGps('idle');
    } catch { setGps('error'); }
  };

  const useMapPoint = async (lat: number, lng: number) => {
    setOsm('loading');
    try {
      const elev = await fetchElevation(lat, lng);
      set({ lat, lng, elevationM: elev, locationLabel: `‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setOsm('idle');
    } catch {
      set({ lat, lng, locationLabel: `‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
      setOsm('error');
    }
  };

  return (
    <Card className="agro-form">
      <div className="agro-form-grid">
        <Field label="‡∏Ç‡∏ô‡∏≤‡∏î‡πÅ‡∏õ‡∏•‡∏á (‡πÑ‡∏£‡πà)">
          <input type="number" min={0.5} step={0.5} className="agro-input" value={value.sizeRai}
            onChange={(e) => set({ sizeRai: Math.max(0.5, Number(e.target.value) || 0) })} />
        </Field>
        <Field label="‡∏ï‡∏≠‡∏ô‡∏ô‡∏µ‡πâ‡∏õ‡∏•‡∏π‡∏Å‡∏≠‡∏∞‡πÑ‡∏£" hint="‡∏ñ‡πâ‡∏≤‡∏°‡∏µ">
          <select className="agro-input" value={value.currentCropId ?? ''} onChange={(e) => set({ currentCropId: e.target.value || null })}>
            <option value="">‚Äî ‡πÄ‡∏•‡∏∑‡∏≠‡∏Å / ‡∏¢‡∏±‡∏á‡πÑ‡∏°‡πà‡πÑ‡∏î‡πâ‡∏õ‡∏•‡∏π‡∏Å ‚Äî</option>
            {CURRENT_CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="‡∏£‡∏∞‡∏î‡∏±‡∏ö‡∏Ñ‡∏ß‡∏≤‡∏°‡∏™‡∏π‡∏á (‡πÄ‡∏°‡∏ï‡∏£ ‡∏£‡∏ó‡∏Å.)">
          <div className="agro-elev-row">
            <input type="number" className="agro-input" value={value.elevationM}
              onChange={(e) => set({ elevationM: Number(e.target.value) || 0, locationLabel: '‡∏Å‡∏≥‡∏´‡∏ô‡∏î‡πÄ‡∏≠‡∏á' })} />
            <button type="button" className="agro-gps-btn" onClick={useGps} disabled={gps === 'loading'}>
              üìç {gps === 'loading' ? '‡∏Å‡∏≥‡∏•‡∏±‡∏á‡∏´‡∏≤‚Ä¶' : 'GPS'}
            </button>
          </div>
          {gps === 'error' && <div className="agro-gps-err thai">‡∏Ç‡∏≠‡∏ï‡∏≥‡πÅ‡∏´‡∏ô‡πà‡∏á‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à ‚Äî ‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏≠‡∏≥‡πÄ‡∏†‡∏≠‡∏î‡πâ‡∏≤‡∏ô‡∏•‡πà‡∏≤‡∏á</div>}
          <div className="agro-loc thai">‡∏ï‡∏≥‡πÅ‡∏´‡∏ô‡πà‡∏á: {value.locationLabel}</div>
        </Field>
      </div>

      <Field label="‡∏´‡∏£‡∏∑‡∏≠‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏≠‡∏≥‡πÄ‡∏†‡∏≠‡πÉ‡∏ô‡∏ô‡πà‡∏≤‡∏ô" hint="‡∏ï‡∏±‡πâ‡∏á‡∏û‡∏¥‡∏Å‡∏±‡∏î+‡∏Ñ‡∏ß‡∏≤‡∏°‡∏™‡∏π‡∏á‡∏≠‡∏±‡∏ï‡πÇ‡∏ô‡∏°‡∏±‡∏ï‡∏¥ (‡πÉ‡∏ä‡πâ‡∏ï‡∏£‡∏ß‡∏à GISTDA)">
        <div className="agro-amphoe">
          {NAN_AMPHOE.map((a) => (
            <button key={a.id} type="button"
              className={`agro-chip ${value.locationLabel === a.nameTh ? 'on' : ''}`}
              onClick={() => set({ elevationM: a.elevationM, lat: a.lat, lng: a.lng, locationLabel: a.nameTh })}>
              {a.nameTh} <span className="agro-amphoe-elev">{a.elevationM}‡∏°.</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏û‡∏¥‡∏Å‡∏±‡∏î‡∏à‡∏≤‡∏Å Google Maps" hint="‡∏Ñ‡∏•‡∏¥‡∏Å‡∏ö‡∏ô‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà‡∏î‡∏≤‡∏ß‡πÄ‡∏ó‡∏µ‡∏¢‡∏°‡πÄ‡∏û‡∏∑‡πà‡∏≠‡∏Å‡∏≥‡∏´‡∏ô‡∏î lat/lng ‡πÅ‡∏•‡∏∞‡∏î‡∏∂‡∏á‡∏Ñ‡∏ß‡∏≤‡∏°‡∏™‡∏π‡∏á‡∏≠‡∏±‡∏ï‡πÇ‡∏ô‡∏°‡∏±‡∏ï‡∏¥">
        <GoogleMapPicker
          lat={value.lat ?? NAN_CENTER.lat}
          lng={value.lng ?? NAN_CENTER.lng}
          elevationM={value.elevationM}
          loading={osm === 'loading'}
          onPick={useMapPoint}
        />
        {osm === 'error' && (
          <div className="agro-gps-err thai">‡∏î‡∏∂‡∏á‡∏Ñ‡∏ß‡∏≤‡∏°‡∏™‡∏π‡∏á‡∏à‡∏≤‡∏Å‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà‡πÑ‡∏°‡πà‡∏™‡∏≥‡πÄ‡∏£‡πá‡∏à ‚Äî ‡πÉ‡∏ä‡πâ‡∏û‡∏¥‡∏Å‡∏±‡∏î‡∏à‡∏≤‡∏Å‡πÅ‡∏ú‡∏ô‡∏ó‡∏µ‡πà‡πÅ‡∏•‡πâ‡∏ß ‡πÅ‡∏ï‡πà‡∏Ñ‡∏á‡∏Ñ‡πà‡∏≤‡∏Ñ‡∏ß‡∏≤‡∏°‡∏™‡∏π‡∏á‡πÄ‡∏î‡∏¥‡∏°‡πÑ‡∏ß‡πâ</div>
        )}
      </Field>

      <Field label="üåø ‡∏û‡∏∑‡∏ä‡∏ó‡∏µ‡πà‡∏≠‡∏¢‡∏≤‡∏Å‡πÉ‡∏´‡πâ‡∏£‡∏∞‡∏ö‡∏ö‡∏ô‡∏≥‡πÑ‡∏õ‡∏≠‡∏≠‡∏Å‡πÅ‡∏ö‡∏ö" hint="‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÑ‡∏î‡πâ‡∏ó‡∏∏‡∏Å‡∏ä‡∏±‡πâ‡∏ô ¬∑ ‡πÄ‡∏ß‡πâ‡∏ô‡∏ß‡πà‡∏≤‡∏á‡∏ä‡∏±‡πâ‡∏ô‡πÑ‡∏´‡∏ô ‡∏£‡∏∞‡∏ö‡∏ö‡∏à‡∏∞‡πÄ‡∏ï‡∏¥‡∏°‡∏ä‡∏ô‡∏¥‡∏î‡∏ó‡∏µ‡πà‡πÄ‡∏´‡∏°‡∏≤‡∏∞‡∏Å‡∏±‡∏ö‡∏û‡∏∑‡πâ‡∏ô‡∏ó‡∏µ‡πà‡πÉ‡∏´‡πâ">
        <div className="agro-pick">
          {LAYERS.map((layer) => {
            const m = LAYER_META[layer];
            const selected = selectedByLayer[layer] ?? [];
            return (
              <div key={layer} className={`agro-pick-layer layer-${layer}`}>
                <div className="agro-pick-head">
                  <b className="thai">{m.emoji} {m.th}</b>
                  <span className="thai">{selected.length ? `‡πÄ‡∏•‡∏∑‡∏≠‡∏Å ${selected.length}` : '‡∏≠‡∏±‡∏ï‡πÇ‡∏ô‡∏°‡∏±‡∏ï‡∏¥'}</span>
                </div>
                <div className="agro-chips">
                  {byLayer(layer).map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        className={`agro-chip agro-pick-chip ${on ? 'on' : ''}`}
                        onClick={() => togglePlant(layer, p.id)}
                      >
                        <span className="agro-pick-emoji"><PlantGlyph plantId={p.id} layer={layer} size={22} /></span>
                        <span className="thai">{p.nameTh}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Field>

      <Field label="‡πÄ‡∏Ñ‡∏£‡∏∑‡πà‡∏≠‡∏á‡∏Ñ‡∏¥‡∏î‡πÄ‡∏•‡∏Ç‡∏£‡∏≤‡∏¢‡πÑ‡∏î‡πâ‡∏†‡∏≤‡∏Ñ‡∏™‡∏ô‡∏≤‡∏°" hint="‡∏õ‡∏£‡∏±‡∏ö‡∏™‡∏°‡∏°‡∏ï‡∏¥‡∏ê‡∏≤‡∏ô‡∏Ç‡∏≠‡∏á‡∏û‡∏∑‡∏ä‡∏ó‡∏µ‡πà‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡πÑ‡∏ß‡πâ ‡πÄ‡∏û‡∏∑‡πà‡∏≠‡∏Ñ‡∏∏‡∏¢‡∏Å‡∏±‡∏ö‡πÄ‡∏Å‡∏©‡∏ï‡∏£‡∏Å‡∏£/ReCorp">
        <div className="agro-calculator">
          <div className="agro-calc-target">
            <span className="thai">‡πÄ‡∏õ‡πâ‡∏≤‡∏´‡∏°‡∏≤‡∏¢‡∏£‡∏≤‡∏¢‡πÑ‡∏î‡πâ/‡∏õ‡∏µ</span>
            <input
              type="number"
              min={0}
              className="agro-input"
              value={value.targetAnnualIncome ?? ''}
              placeholder="‡πÄ‡∏ä‡πà‡∏ô 180000"
              onChange={(e) => set({ targetAnnualIncome : Number(e.target.value) || undefined })}
            />
          </div>
          {selectedPlantIds.length === 0 ? (
            <div className="agro-calc-empty thai">‡πÄ‡∏•‡∏∑‡∏≠‡∏Å‡∏û‡∏∑‡∏ä‡∏î‡πâ‡∏≤‡∏ô‡∏ö‡∏ô‡∏Å‡πà‡∏≠‡∏ô ‡∏£‡∏∞‡∏ö‡∏ö‡∏à‡∏∞‡πÅ‡∏™‡∏î‡∏á‡∏ä‡πà‡∏≠‡∏á‡∏õ‡∏£‡∏±‡∏ö‡∏£‡∏≤‡∏Ñ‡∏≤ ‡∏ú‡∏•‡∏ú‡∏•‡∏¥% ‡πÅ‡∏•‡∏∞ survival rate ‡∏£‡∏≤‡∏¢‡∏ä‡∏ô‡∏¥‡∏îΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄ§ÄËÄ†(ÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÖù…ºµçÖ±åµù…•êà¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌÕï±ïç—ïëA±Öπ—%ëÃπµÖ¿†°•ê§ÄÙ¯ÅÏ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅçΩπÕ–Å¡±Öπ–ÄÙÅA19QLπô•πê†°¿§ÄÙ¯Å¿π•êÄÙÙÙÅ•ê§Ï(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ•òÄ†Ö¡±Öπ–§Å…ï—’…∏Åπ’±∞Ï(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅçΩπÕ–ÅÑÄÙÅÖÕÕ’µ¡—•Ω∏°•ê§Ï(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ…ï—’…∏Ä†(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅ≠ï‰ıÌ•ëÙÅç±ÖÕÕ9ÖµîÙâÖù…ºµçÖ±åµ…Ω‹à¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒàÅç±ÖÕÕ9ÖµîÙâ—°Ö§ÅÖù…ºµçÖ±åµπÖµîà¯ÒA±Öπ—±Â¡†Å¡±Öπ—%êıÌ¡±Öπ–π•ëÙÅ±ÖÂï»ıÌ¡±Öπ–π±ÖÂï…ÙÅÕ•ÈîıÏ»¡ÙÄº¯ÅÌ¡±Öπ–ππÖµïQ°ÙΩà¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏˚Ç‚¸Ω≠úΩÕ¡Ö∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–Å—Â¡îÙâπ’µâï»àÅç±ÖÕÕ9ÖµîÙâÖù…ºµ•π¡’–àÅŸÖ±’îıÌÑπ¡…•çïAï…-úÄ¸¸Å¡±Öπ–π¡…•çïAï…-ùÙ(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ°ÖπùîıÏ°î§ÄÙ¯ÅÕï—ÕÕ’µ¡—•Ω∏°•ê∞ÅÏÅ¡…•çïAï…-úËÅ9’µâï»°îπ—Ö…ùï–πŸÖ±’î§ÅÒÅ¡±Öπ–π¡…•çïAï…-úÅÙ•ÙÄº¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ±Öâï∞¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏˘≠úΩ…Ö§ΩÕ¡Ö∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–Å—Â¡îÙâπ’µâï»àÅç±ÖÕÕ9ÖµîÙâÖù…ºµ•π¡’–àÅŸÖ±’îıÌÑπÂ•ï±ë-ùAï…IÖ§Ä¸¸Å¡±Öπ–πÂ•ï±ë-ùAï…IÖ•Ù(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ°ÖπùîıÏ°î§ÄÙ¯ÅÕï—ÕÕ’µ¡—•Ω∏°•ê∞ÅÏÅÂ•ï±ë-ùAï…IÖ§ËÅ9’µâï»°îπ—Ö…ùï–πŸÖ±’î§ÅÒÅ¡±Öπ–πÂ•ï±ë-ùAï…IÖ§ÅÙ•ÙÄº¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ±Öâï∞¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏˘Õ’…Ÿ•ŸÖ∞ΩÕ¡Ö∏¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–Å—Â¡îÙâπ’µâï»àÅµ•∏ıÏ¿∏≈ÙÅµÖ‡ıÏƒ∏…ÙÅÕ—ï¿ıÏ¿∏¿’ÙÅç±ÖÕÕ9ÖµîÙâÖù…ºµ•π¡’–àÅŸÖ±’îıÌÑπÕ’…Ÿ•ŸÖ±IÖ—îÄ¸¸Ä≈Ù(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ°ÖπùîıÏ°î§ÄÙ¯ÅÕï—ÕÕ’µ¡—•Ω∏°•ê∞ÅÏÅÕ’…Ÿ•ŸÖ±IÖ—îËÅ9’µâï»°îπ—Ö…ùï–πŸÖ±’î§ÅÒÄƒÅÙ•ÙÄº¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ±Öâï∞¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ§Ï(ÄÄÄÄÄÄÄÄÄÄÄÄÄÅÙ•Ù(ÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄ•Ù(ÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄΩ•ï±ê¯((ÄÄÄÄÄÄÒ•ï±êÅ±Öâï∞ÙãÇÊÇ‚oÇÊ'Ç‚ÀÇ‚ØÇ‚áÇ‚ÀÇ‚ãÇ‚Ç‚∑Ç‚Ç‚Ç‚„Ç‚Là¯(ÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÖù…ºµùΩÖ±Ãà¯(ÄÄÄÄÄÄÄÄÄÅÌùΩÖ±ÃπµÖ¿†°ú§ÄÙ¯Ä†(ÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏Å≠ï‰ıÌúπ•ëÙÅ—Â¡îÙââ’——Ω∏àÅç±ÖÕÕ9ÖµîıÌÅÖù…ºµùΩÖ∞ÄëÌŸÖ±’îπùΩÖ∞ÄÙÙÙÅúπ•êÄ¸ÄùΩ∏úÄËÄúùıÅÙÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï–°ÏÅùΩÖ∞ËÅúπ•êÅÙ•Ù¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÖù…ºµùΩÖ∞µ±Öâï∞Å—°Ö§à˘Ìúπ±Öâï±ÙΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâÖù…ºµùΩÖ∞µëïÕåÅ—°Ö§à˘ÌúπëïÕçÙΩë•ÿ¯(ÄÄÄÄÄÄÄÄÄÄÄÄΩâ’——Ω∏¯(ÄÄÄÄÄÄÄÄÄÄ§•Ù(ÄÄÄÄÄÄÄÄΩë•ÿ¯(ÄÄÄÄÄÄΩ•ï±ê¯((ÄÄÄÄÄÄÒâ’——Ω∏Å—Â¡îÙââ’——Ω∏àÅç±ÖÕÕ9ÖµîÙââ—∏Å¡…•µÖ…‰Å—°Ö§ÅÖù…ºµÕ’âµ•–àÅΩπ±•ç¨ıÌΩπM’âµ•—ÙÅë•ÕÖâ±ïêıÌâ’ÕÂÙ¯(ÄÄÄÄÄÄÄÅÌâ’Õ‰Ä¸Äüä>ÃÉÇ‚Ç‚œÇ‚óÇ‚«Ç‚Ç‚üÇ‚ﬂÇÊÇ‚Ç‚èÇ‚ÀÇ‚√Ç‚ØÇÊ3Ç‚ÇÊ'Ç‚∑Ç‚áÇ‚ÁÇ‚óÇ‚SÇ‚ÀÇ‚üÇÊÇ‚_Ç‚◊Ç‚ãÇ‚áäòúÄËÄü¬~2ƒÉÇ‚∑Ç‚∑Ç‚ÇÊÇ‚kÇ‚kÇ‚kÇ‚èÇ‚√Ç‚kÇ‚kÇ‚üÇ‚gÇÊÇ‚Ç‚ßÇ‚WÇ‚èùÙ(ÄÄÄÄÄÄΩâ’——Ω∏¯(ÄÄÄÄΩÖ…ê¯(ÄÄ§Ï)Ù(