import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

const TILE = 256;
const MIN_ZOOM = 9;
const MAX_ZOOM = 13;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function project(lat: number, lng: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function tileUrl(x: number, y: number, zoom: number) {
  const max = 2 ** zoom;
  const wrappedX = ((x % max) + max) % max;
  const safeY = clamp(y, 0, max - 1);
  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${safeY}.png`;
}

export function OsmPicker({
  lat,
  lng,
  elevationM,
  loading,
  onPick,
}: {
  lat?: number;
  lng?: number;
  elevationM: number;
  loading?: boolean;
  onPick: (lat: number, lng: number) => void | Promise<void>;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(10);
  const [size, setSize] = useState({ width: 900, height: 320 });
  const centerLat = lat ?? 18.78;
  const centerLng = lng ?? 100.78;

  useEffect(() => {
    if (!mapRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({ width: Math.max(280, rect.width), height: Math.max(220, rect.height) });
    });
    ro.observe(mapRef.current);
    return () => ro.disconnect();
  }, []);

  const center = useMemo(() => project(centerLat, centerLng, zoom), [centerLat, centerLng, zoom]);
  const tiles = useMemo(() => {
    const startX = Math.floor((center.x - size.width / 2) / TILE);
    const endX = Math.floor((center.x + size.width / 2) / TILE);
    const startY = Math.floor((center.y - size.height / 2) / TILE);
    const endY = Math.floor((center.y + size.height / 2) / TILE);
    const out: Array<{ key: string; url: string; left: number; top: number }> = [];
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        out.push({
          key: `${zoom}-${x}-${y}`,
          url: tileUrl(x, y, zoom),
          left: x * TILE - center.x + size.width / 2,
          top: y * TILE - center.y + size.height / 2,
        });
      }
    }
    return out;
  }, [center, size, zoom]);

  const pick = (event: MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current || loading) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = center.x + event.clientX - rect.left - rect.width / 2;
    const y = center.y + event.clientY - rect.top - rect.height / 2;
    const next = unproject(x, y, zoom);
    void onPick(Number(next.lat.toFixed(6)), Number(next.lng.toFixed(6)));
  };

  const pickCenter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (loading) return;
    void onPick(Number(centerLat.toFixed(6)), Number(centerLng.toFixed(6)));
  };

  return (
    <div className="agro-osm">
      <div className="agro-osm-head">
        <div>
          <span className="agro-impact-k">OpenStreetMap</span>
          <div className="agro-osm-title thai">เลือกพิกัดแปลงจากแผนที่</div>
        </div>
        <a
          className="agro-osm-link"
          href={`https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLng}#map=${zoom}/${centerLat}/${centerLng}`}
          target="_blank"
          rel="noreferrer"
        >
          เปิด OSM
        </a>
      </div>

      <div
        ref={mapRef}
        className={`agro-osm-map ${loading ? 'loading' : ''}`}
        onClick={pick}
        onKeyDown={pickCenter}
        role="button"
        tabIndex={0}
        aria-label="เลือกพิกัดจาก OpenStreetMap"
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            alt=""
            draggable={false}
            src={tile.url}
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
        <div className="agro-osm-crosshair" />
        <div className="agro-osm-marker" style={{ left: '50%', top: '50%' }} />
        <div className="agro-osm-zoom" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setZoom((z) => clamp(z + 1, MIN_ZOOM, MAX_ZOOM))}>+</button>
          <button type="button" onClick={() => setZoom((z) => clamp(z - 1, MIN_ZOOM, MAX_ZOOM))}>-</button>
        </div>
        <div className="agro-osm-attrib">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
        </div>
      </div>

      <div className="agro-osm-meta">
        <span>lat {centerLat.toFixed(5)}</span>
        <span>lng {centerLng.toFixed(5)}</span>
        <span>{elevationM.toLocaleString('en-US')} m</span>
        {loading && <span className="thai">กำลังดึงความสูง…</span>}
      </div>
    </div>
  );
}
