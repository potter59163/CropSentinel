import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { PLANTS } from '@/data/plants';
import { adminCookieName, isValidAdminToken } from '@/lib/adminAuth';
import { dbConfigured } from '@/lib/db';
import { getCropPriceOverrides, setCropPriceOverride } from '@/lib/cropPrices';
import { rateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminToken(store.get(adminCookieName())?.value);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const overrides = await getCropPriceOverrides();
  const rows = PLANTS.map((p) => ({
    plantId: p.id,
    nameTh: p.nameTh,
    nameEn: p.nameEn,
    layer: p.layer,
    defaultPricePerKg: p.pricePerKg,
    currentPricePerKg: overrides[p.id]?.pricePerKg ?? p.pricePerKg,
    updatedAt: overrides[p.id]?.updatedAt ?? null,
  }));
  return NextResponse.json({ rows, dbConfigured: dbConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
}

const updateSchema = z.object({
  plantId: z.string().min(1),
  pricePerKg: z.number().positive().max(10000),
});

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const limited = rateLimited(request, 'admin-prices-update', 60, 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!PLANTS.some((p) => p.id === parsed.data.plantId)) {
    return NextResponse.json({ error: 'unknown plantId' }, { status: 400 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL ยังไม่ได้ตั้งค่า บันทึกราคาถาวรไม่ได้' }, { status: 503 });
  }
  await setCropPriceOverride(parsed.data.plantId, parsed.data.pricePerKg);
  return NextResponse.json({ status: 'saved' });
}
