import { NextResponse } from 'next/server';
import { fetchClimate } from '@/lib/climate';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const elevationM = Number(searchParams.get('elevationM'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(elevationM)) {
    return NextResponse.json({ error: 'lat, lng and elevationM are required numbers' }, { status: 400 });
  }
  const climate = await fetchClimate(lat, lng, elevationM);
  return NextResponse.json({ climate }, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } });
}
