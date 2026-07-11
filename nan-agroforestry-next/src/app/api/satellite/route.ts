import { NextResponse } from 'next/server';
import { satContext } from '@/lib/satellite';
import { parseLatLng } from '@/lib/geoBounds';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const limited = rateLimited(request, 'satellite', 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const coords = parseLatLng(searchParams);
  if (!coords) {
    return NextResponse.json({ error: 'lat and lng must be numbers within Thailand bounds' }, { status: 400 });
  }
  return NextResponse.json({ satellite: satContext(coords.lat, coords.lng) }, { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } });
}
