import { sql, dbConfigured } from './db';

export interface PriceOverride {
  pricePerKg: number;
  updatedAt: string;
}

// crop_assumptions is an append-only expert-review log (see db/schema.sql), so
// an admin price edit is a new row, not an UPDATE; the latest row per plant
// wins. Scoped to source='admin_price_update' so a future RECOFTC CSV import
// into the same table can't silently feed unreviewed prices into live plans.
export async function getCropPriceOverrides(): Promise<Record<string, PriceOverride>> {
  if (!dbConfigured()) return {};
  try {
    const db = sql();
    const rows = (await db`
      SELECT DISTINCT ON (plant_id) plant_id, price_per_kg, updated_at
      FROM crop_assumptions
      WHERE source = 'admin_price_update' AND price_per_kg IS NOT NULL
      ORDER BY plant_id, updated_at DESC
    `) as { plant_id: string; price_per_kg: string; updated_at: string }[];
    return Object.fromEntries(
      rows.map((r) => [r.plant_id, { pricePerKg: Number(r.price_per_kg), updatedAt: r.updated_at }]),
    );
  } catch {
    // Price overrides are a nice-to-have layer on top of the static defaults —
    // if the DB hiccups, fall back silently rather than failing plan requests.
    return {};
  }
}

export async function setCropPriceOverride(plantId: string, pricePerKg: number): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO crop_assumptions (plant_id, source, price_per_kg, validation_status)
    VALUES (${plantId}, 'admin_price_update', ${pricePerKg}, 'expert_confirmed')
  `;
}
