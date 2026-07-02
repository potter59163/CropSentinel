import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSystems } from './engine';
import type { FarmInput } from '../data/types';

// Offline batch validation: run every sample plot through the engine (no live
// climate/soil — elevation envelope path), assert nothing crashes, and write a
// results CSV RECOFTC/experts can review before the field pilot.
const SAMPLE = join(process.cwd(), 'data-templates/recoftc-farm-plots-30-sample.csv');
const OUTPUT = join(process.cwd(), 'data-templates/batch-results.csv');

function parseCsv(text: string): Record<string, string>[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    const rec: Record<string, string> = {};
    cols.forEach((c, i) => {
      // the trailing "notes" column may itself contain commas → keep the remainder
      rec[c] = i === cols.length - 1 ? cells.slice(i).join(',') : (cells[i] ?? '');
    });
    return rec;
  });
}

function toInput(r: Record<string, string>): FarmInput {
  return {
    currentCropId: r.current_crop || null,
    sizeRai: Number(r.size_rai),
    elevationM: Number(r.elevation_m),
    locationLabel: r.farmer_label || r.amphoe || r.external_ref,
    lat: Number(r.lat),
    lng: Number(r.lng),
    selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
    goal: 'balanced',
  };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

describe('batch — RECOFTC 30-plot sample', () => {
  it('runs every plot and writes a results CSV', () => {
    const rows = parseCsv(readFileSync(SAMPLE, 'utf8'));
    expect(rows.length).toBeGreaterThanOrEqual(20);

    const out = ['external_ref,farmer_label,size_rai,elevation_m,best_badge,profit10_baht,payback_year,agroforestry_pct,carbon10_tco2e,canopy_species'];

    for (const r of rows) {
      const input = toInput(r);
      const systems = buildSystems(input, null, null, null);
      expect(systems.length, `plot ${r.external_ref} produced no system`).toBeGreaterThan(0);

      const best = systems[0];
      expect(Number.isFinite(best.profit10), `plot ${r.external_ref} profit not finite`).toBe(true);
      expect(best.canopy.length).toBeGreaterThanOrEqual(2);

      const canopy = best.canopy.map((p) => p.plant.nameTh).join(' + ');
      out.push([
        r.external_ref, r.farmer_label, String(input.sizeRai), String(input.elevationM),
        best.badge, String(best.profit10), best.paybackYear === null ? '' : String(best.paybackYear),
        String(Math.round(best.scoreParts.agroforestry * 100)), String(best.carbon10), canopy,
      ].map(csvCell).join(','));
    }

    writeFileSync(OUTPUT, out.join('\n') + '\n', 'utf8');
    expect(out.length - 1).toBe(rows.length);
  });
});
