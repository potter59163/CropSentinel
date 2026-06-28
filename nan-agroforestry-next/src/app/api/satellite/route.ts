import { NextResponse } from 'next/server';
import { satContext } from '@/lib/satellite';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 });
  }
  return NextResponse.json({ satellite: satContext(lat, lng) }, { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } });
}
