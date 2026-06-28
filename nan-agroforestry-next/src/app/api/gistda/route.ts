import { NextResponse } from 'next/server';
import { checkProtected } from '@/lib/gistda';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 });
  }
  const protectedArea = await checkProtected(lat, lng);
  return NextResponse.json({ protectedArea }, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } });
}
