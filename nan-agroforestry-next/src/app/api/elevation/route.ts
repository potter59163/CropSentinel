import { NextResponse } from 'next/server';
import { fetchElevation } from '@/lib/elevation';
import { parseLatLng } from '@/lib/geoBounds';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const limited = rateLimited(request, 'elevation', 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const coords = parseLatLng(searchParams);
  if (!coords) {
    return NextResponse.json({ error: 'lat and lng must be numbers within Thailand bounds' }, { status: 400 });
  }
  const { lat, lng } = coords;
  try {
    const elevationM = await fetchElevation(lat, lng);
    return NextResponse.json({ elevationM }, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'elevation source unavailable' },
      { status: 502 },
    );
  }
}
