'use client';

import { useEffect, useRef, useState } from 'react';

// Single shared loader so the Maps script is injected once per page.
let mapsPromise: Promise<any> | null = null;
function loadMaps(key: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=th&region=TH`;
    script.async = true;
    script.onload = () => resolve((window as any).google.maps);
    script.onerror = () => { mapsPromise = null; reject(new Error('Google Maps failed to load')); };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export function GoogleMapPicker({
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
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [err, setErr] = useState<string | null>(null);

  const centerLat = lat ?? 18.78;
  const centerLng = lng ?? 100.78;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // init the map once
  useEffect(() => {
    if (!key) { setErr('missing-key'); return; }
    let alive = true;
    loadMaps(key)
      .then((maps) => {
        if (!alive || !elRef.current || mapRef.current) return;
        const center = { lat: centerLat, lng: centerLng };
        const map = new maps.Map(elRef.current, {
          center,
          zoom: 13,
          mapTypeId: 'hybrid', // satellite + labels — best for picking a farm plot
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        const marker = new maps.Marker({ position: center, map, draggable: true });
        mapRef.current = map;
        markerRef.current = marker;
        const emit = (p: any) => void pickRef.current(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)));
        map.addListener('click', (e: any) => { marker.setPosition(e.latLng); emit(e.latLng); });
        marker.addListener('dragend', (e: any) => emit(e.latLng));
      })
      .catch(() => { if (alive) setErr('load-failed'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // keep marker/center in sync when the parent changes lat/lng (amphoe / GPS)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const p = { lat: centerLat, lng: centerLng };
    markerRef.current.setPosition(p);
    mapRef.current.panTo(p);
  }, [centerLat, centerLng]);

  return (
    <div className="agro-osm">
      <div className="agro-osm-head">
        <div>
          <span className="agro-impact-k">Google Maps</span>
          <div className="agro-osm-title thai">เลือกพิกัดแปลงจากแผนที่ดาวเทียม</div>
        </div>
        <a
          className="agro-osm-link"
          href={`https://www.google.com/maps/@${centerLat},${centerLng},15z`}
          target="_blank"
          rel="noreferrer"
        >
          เปิด Google Maps
        </a>
      </div>

      {err ? (
        <div className="agro-gmap agro-gmap-fallback thai">
          {err === 'missing-key'
            ? 'แผนที่ดาวเทียมยังไม่พร้อมใช้ในขณะนี้ · เลือกตำแหน่งด้วยปุ่ม GPS หรืออำเภอด้านล่างได้เลย'
            : 'โหลดแผนที่ไม่สำเร็จ (อินเทอร์เน็ตอาจช้า) · ใช้ GPS หรือเลือกอำเภอด้านล่างแทนได้'}
        </div>
      ) : (
        <div
          ref={elRef}
          className={`agro-gmap ${loading ? 'loading' : ''}`}
          aria-label="เลือกพิกัดแปลงจาก Google Maps"
        />
      )}

      <div className="agro-osm-meta">
        <span>lat {centerLat.toFixed(5)}</span>
        <span>lng {centerLng.toFixed(5)}</span>
        <span>{Number.isFinite(elevationM) ? `${elevationM.toLocaleString('en-US')} ม.` : 'รอความสูง'}</span>
        {loading && <span className="thai">กำลังดึงความสูง…</span>}
      </div>
    </div>
  );
}
