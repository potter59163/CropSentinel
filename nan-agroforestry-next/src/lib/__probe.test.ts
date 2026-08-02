import { it } from 'vitest';
import { buildSystems } from './engine';
import type { Climate } from './climate';
import type { FarmInput } from '../data/types';

const baseInput = (over: Partial<FarmInput> = {}): FarmInput => ({
  currentCropId: null, sizeRai: 10, elevationM: 420, locationLabel: 'test',
  lat: 19.1, lng: 100.9,
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
  goal: 'balanced', ...over,
});
const climate = (elev: number): Climate => ({
  t2m: 25, prec: 1200, drym: 4, pseas: 60, trange: 12, solar: 18, rh: 72, gwet: 0.55, elev,
});

it('probe', () => {
  const counts = new Map<string, number>();
  const lines: string[] = [];
  for (const elev of [250, 400, 600, 800, 1000, 1200]) {
    for (const goal of ['balanced','fast','profit'] as const) {
      const sys = buildSystems(baseInput({ goal, elevationM: elev }), climate(elev), null, null);
      const s = sys[0];
      const ids = s.picks.map(p => `${p.plant.nameTh}(${p.layer[0]})`).join(' ');
      for (const p of s.picks) counts.set(p.plant.id, (counts.get(p.plant.id)??0)+1);
      lines.push(`elev ${String(elev).padStart(4)} ${goal.padEnd(8)} profit10=${String(s.profit10).padStart(9)} /rai/yr=${String(Math.round(s.profit10/10/10)).padStart(7)} payback=${s.paybackYear} :: ${ids}`);
    }
  }
  console.log(lines.join('\n'));
  console.log('\n--- pick frequency (18 top plans) ---');
  [...counts.entries()].sort((a,b)=>b[1]-a[1]).forEach(([id,n])=>console.log(id.padEnd(16), n));
});
