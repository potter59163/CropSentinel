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

// asOf lets the admin date the price to when the source report was published
// (e.g. an OAE bulletin from last month) instead of the moment it was typed
// in — "อัปเดตล่าสุด" should mean the data's age, not the edit's age.
//
// Which is exactly why the read above must not use updated_at to decide which row wins, and why
// this replaces instead of appending. Back-dating a correction to an OAE bulletin from June,
// over an override entered in August, wrote a row that lost the DISTINCT ON ... ORDER BY
// updated_at DESC race — so the admin saw "บันทึกแล้ว" and the old price stayed live, with
// nothing on screen to reveal it. Correcting a price to an older, better-sourced figure is the
// normal case for this button, not an edge case.
//
// One admin row per species makes "the latest edit wins" true by construction rather than by an
// ordering a legitimate back-date breaks. It costs the edit history, which was already lost
// anyway — clearCropPriceOverride deletes every admin row for the species. Restoring an audit
// trail means adding a created_at column and a migration, which is a deliberate change, not
// something to smuggle in behind a bug fix.
export async function setCropPriceOverride(plantId: string, pricePerKg: number, asOf?: string): Promise<void> {
  const db = sql();
  await db`
    DELETE FROM crop_assumptions
    WHERE plant_id = ${plantId} AND source = 'admin_price_update'
  `;
  await db`
    INSERT INTO crop_assumptions (plant_id, source, price_per_kg, validation_status, updated_at)
    VALUES (${plantId}, 'admin_price_update', ${pricePerKg}, 'expert_confirmed', ${asOf ?? new Date().toISOString()})
  `;
}

/**
 * Remove the admin override for one species, so the researched price in data/plants.ts wins
 * again.
 *
 * Deletes rather than writing a new row equal to the default: with the default written as a
 * row, a later correction to plants.ts would be silently shadowed by a stale copy of the OLD
 * default — which is exactly the failure this whole change exists to make visible.
 */
export async function clearCropPriceOverride(plantId: string): Promise<void> {
  const db = sql();
  await db`
    DELETE FROM crop_assumptions
    WHERE plant_id = ${plantId} AND source = 'admin_price_update'
  `;
}
