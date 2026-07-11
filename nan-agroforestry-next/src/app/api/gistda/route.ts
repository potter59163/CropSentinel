import { NextResponse } from 'next/server';
import { checkProtected } from '@/lib/gistda';
import { parseLatLng } from '@/lib/geoBounds';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limited = rateLimited(request, 'gistda', 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const coords = parseLatLng(searchParams);
  if (!coords) {
    return NextResponse.json({ error: 'lat and lng must be numbers within Thailand bounds' }, { status: 400 });
  }
  const protectedArea = await checkProtected(coords.lat, coords.lng);
  return NextResponse.json({ protectedArea }, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } });
}
