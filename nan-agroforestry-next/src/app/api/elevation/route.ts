import { NextResponse } from 'next/server';
import { fetchElevation } from '@/lib/elevation';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 });
  }
  const elevationM = await fetchElevation(lat, lng);
  return NextResponse.json({ elevationM }, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } });
}
