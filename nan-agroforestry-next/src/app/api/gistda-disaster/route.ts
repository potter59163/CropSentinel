import { NextResponse } from 'next/server';
import { fetchGistdaDisaster } from '@/lib/gistdaDisaster';
import { parseLatLng } from '@/lib/geoBounds';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limited = rateLimited(request, 'gistda-disaster', 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const coords = parseLatLng(searchParams);
  if (!coords) {
    return NextResponse.json({ status: 'bad-request', message: 'lat and lng must be numbers within Thailand bounds' }, { status: 400 });
  }
  const radiusKm = searchParams.get('radiusKm');
  const body = await fetchGistdaDisaster(coords.lat, coords.lng, radiusKm);
  const status = body.status === 'bad-request' ? 400 : 200;
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } });
}
