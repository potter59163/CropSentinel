import { NextResponse } from 'next/server';
import { fetchGistdaDisaster } from '@/lib/gistdaDisaster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const radiusKm = searchParams.get('radiusKm');
  const body = await fetchGistdaDisaster(lat, lng, radiusKm);
  const status = body.status === 'bad-request' ? 400 : 200;
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } });
}
