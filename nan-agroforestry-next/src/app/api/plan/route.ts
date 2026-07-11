import { NextResponse } from 'next/server';
import { farmInputSchema } from '@/lib/planSchema';
import { runPlan } from '@/lib/planRunner';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // /api/plan fans out to several external APIs — cap per-IP burst.
  const limited = rateLimited(request, 'plan', 20, 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = farmInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid farm input', issues: parsed.error.flatten() }, { status: 400 });
  }
  // Real soil (SoilGrids) is fetched server-side inside runPlan and used as an
  // agronomic layer in the engine — see src/lib/soil.ts.
  const result = await runPlan(parsed.data);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
