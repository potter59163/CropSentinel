import { NextResponse } from 'next/server';
import { fetchClimate } from '@/lib/climate';
import { parseLatLng, isValidElevation } from '@/lib/geoBounds';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const limited = rateLimited(request, 'climate', 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const coords = parseLatLng(searchParams);
  const elevationM = Number(searchParams.get('elevationM'));
  if (!coords || !isValidElevation(elevationM)) {
    return NextResponse.json({ error: 'lat, lng and elevationM must be numbers within Thailand bounds' }, { status: 400 });
  }
  // fetchClimate throws when NASA POWER is unavailable; report that honestly as
  // climate:null rather than fabricating an all-NaN payload.
  try {
    const climate = await fetchClimate(coords.lat, coords.lng, elevationM);
    return NextResponse.json({ climate }, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } });
  } catch (error) {
    return NextResponse.json(
      { climate: null, error: error instanceof Error ? error.message : 'climate source unavailable' },
      { status: 502 },
    );
  }
}
