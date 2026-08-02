import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { PLANTS } from '@/data/plants';
import { adminCookieName, isValidAdminToken } from '@/lib/adminAuth';
import { dbConfigured } from '@/lib/db';
import { getCropPriceOverrides, setCropPriceOverride, clearCropPriceOverride, clearAllCropPriceOverrides } from '@/lib/cropPrices';
import { rateLimited } from '@/lib/rateLimit';
import { provenanceOf, provenanceNote, TIER_META } from '@/lib/provenance';

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
  const rows = PLANTS.map((p) => {
    const override = overrides[p.id];
    const tier = provenanceOf(p.id);
    return {
      plantId: p.id,
      nameTh: p.nameTh,
      nameEn: p.nameEn,
      layer: p.layer,
      defaultPricePerKg: p.pricePerKg,
      currentPricePerKg: override?.pricePerKg ?? p.pricePerKg,
      updatedAt: override?.updatedAt ?? null,
      // What is being overridden, so an officer can see whether they are replacing a figure
      // traceable to a named OAE series or a local estimate. Overriding an estimate is
      // routine; overriding a government series should be a deliberate act.
      isOverridden: override != null,
      tier,
      tierLabel: TIER_META[tier].labelTh,
      tierNote: provenanceNote(p.id) ?? null,
      // Signed % the live price departs from the researched default.
      deviationPct: override && p.pricePerKg > 0
        ? Math.round(((override.pricePerKg / p.pricePerKg) - 1) * 100)
        : 0,
    };
  });
  return NextResponse.json({ rows, dbConfigured: dbConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
}

const updateSchema = z.object({
  plantId: z.string().min(1),
  pricePerKg: z.number().positive().max(10000),
  asOf: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date').optional(),
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
  await setCropPriceOverride(parsed.data.plantId, parsed.data.pricePerKg, parsed.data.asOf);
  return NextResponse.json({ status: 'saved' });
}

/**
 * Either one species, or every override at once.
 *
 * `all` exists because clearing them one at a time is 18 clicks, and a job that tedious gets
 * abandoned half-finished — which leaves the dataset in a state nobody chose: some species on
 * researched prices, some on overrides, and no way to tell from a plan which is which.
 */
const deleteSchema = z.union([
  z.object({ plantId: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

/** Drop an override and fall back to the researched price in data/plants.ts. */
export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const limited = rateLimited(request, 'admin-prices-update', 60, 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL ยังไม่ได้ตั้งค่า' }, { status: 503 });
  }

  if ('all' in parsed.data) {
    // Read first, so the response can report exactly what was dropped rather than a bare count.
    // Losing a deliberate local price without a record of what it was is the one way this
    // button could cost someone real information.
    const before = await getCropPriceOverrides();
    const cleared = Object.entries(before).map(([plantId, o]) => {
      const plant = PLANTS.find((p) => p.id === plantId);
      return { plantId, nameTh: plant?.nameTh ?? plantId, was: o.pricePerKg, now: plant?.pricePerKg ?? null };
    });
    await clearAllCropPriceOverrides();
    return NextResponse.json({ status: 'cleared', count: cleared.length, cleared });
  }

  const { plantId } = parsed.data;
  if (!PLANTS.some((p) => p.id === plantId)) {
    return NextResponse.json({ error: 'unknown plantId' }, { status: 400 });
  }
  await clearCropPriceOverride(plantId);
  return NextResponse.json({ status: 'cleared', count: 1 });
}
