import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeSoilByLocation, type SoilData } from '@/lib/soilAnalysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const soilQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  elevation: z.number().min(0).max(3000).default(400)
});

export type SoilAnalysisResponse = {
  success: boolean;
  data?: SoilData;
  error?: string;
  cached?: boolean;
  timestamp: string;
};

// Simple in-memory cache (store for 1 hour per request)
const soilCache = new Map<string, { data: SoilData; expires: number }>();

function getCacheKey(lat: number, lng: number, elevation: number): string {
  // Round to 0.01 degrees to reduce cache misses from tiny movements
  return `${(lat * 100).toFixed(0)}_${(lng * 100).toFixed(0)}_${Math.round(elevation / 10)}`;
}

export async function POST(request: Request): Promise<NextResponse<SoilAnalysisResponse>> {
  try {
    const body = await request.json().catch(() => null);
    const parsed = soilQuerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid soil query parameters',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const { lat, lng, elevation } = parsed.data;
    const cacheKey = getCacheKey(lat, lng, elevation);

    // Check cache
    const cached = soilCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(
        {
          success: true,
          data: cached.data,
          cached: true,
          timestamp: new Date().toISOString()
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour on client
            'X-Cache': 'HIT'
          }
        }
      );
    }

    // Analyze soil
    const soilData = analyzeSoilByLocation(lat, lng, elevation);

    // Store in cache (1 hour)
    soilCache.set(cacheKey, {
      data: soilData,
      expires: Date.now() + 60 * 60 * 1000
    });

    return NextResponse.json(
      {
        success: true,
        data: soilData,
        cached: false,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'MISS'
        }
      }
    );
  } catch (error) {
    console.error('Soil analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze soil',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request): Promise<NextResponse<SoilAnalysisResponse>> {
  // Also support GET with query parameters
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const elevation = parseFloat(searchParams.get('elevation') || '400');

  const req = new Request(request, {
    method: 'POST',
    body: JSON.stringify({ lat, lng, elevation })
  });

  return POST(req);
}
