import { NextResponse } from 'next/server';
import { farmInputSchema } from '@/lib/planSchema';
import { runPlan } from '@/lib/planRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = farmInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid farm input', issues: parsed.error.flatten() }, { status: 400 });
  }
  const result = await runPlan(parsed.data);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
