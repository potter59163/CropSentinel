import { NextResponse } from 'next/server';
import { farmInputSchema } from '@/lib/planSchema';
import { runPlan } from '@/lib/planRunner';
import { analyzeSoilByLocation } from '@/lib/soilAnalysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = farmInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid farm input', issues: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch soil data if coordinates are available
  let soilData = null;
  if (parsed.data.lat && parsed.data.lng) {
    try {
      soilData = analyzeSoilByLocation(
        parsed.data.lat,
        parsed.data.lng,
        parsed.data.elevationM
      );
    } catch (error) {
      console.warn('Soil analysis failed, continuing without soil data:', error);
    }
  }

  // Run plan with optional soil context
  const result = await runPlan(parsed.data, soilData);
  return NextResponse.json(
    {
      ...result,
      soilContext: soilData ? {
        soilType: soilData.soilType,
        ph: soilData.ph,
        suitableCrops: soilData.suitableCrops
      } : null
    },
    {
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}
