import { it } from 'vitest';
import { buildSystems } from './engine';
import type { Climate } from './climate';
import type { FarmInput } from '../data/types';
const baseInput = (over: Partial<FarmInput> = {}): FarmInput => ({
  currentCropId: null, sizeRai: 10, elevationM: 420, locationLabel: 'test', lat: 19.1, lng: 100.9,
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] }, goal: 'balanced', ...over,
});
const climate = (elev: number): Climate => ({ t2m:25, prec:1200, drym:4, pseas:60, trange:12, solar:18, rh:72, gwet:0.55, elev });

it('probe2', () => {
  const s = buildSystems(baseInput({ elevationM: 400 }), climate(400), null, null)[0];
  console.log('sizeRai 10, profit10 =', s.profit10, ' = ', Math.round(s.profit10/10/10), 'THB/rai/yr');
  console.log('\nper-pick 10-yr gross contribution (share x price x yield x cycles, ignoring ramp/fade):');
  let tot = 0;
  const rows = s.picks.map(p => {
    const g = p.plant.pricePerKg*p.plant.yieldKgPerRai*p.plant.cyclesPerYear*p.shareRai;
    tot += g; return { n: p.plant.nameTh, id: p.plant.id, layer: p.layer, share: p.shareRai, g };
  });
  rows.forEach(r => console.log(r.n.padEnd(24), r.layer.padEnd(12), 'share', r.share.toFixed(2), 'rai  gross/yr', String(Math.round(r.g)).padStart(8), ' =', ((r.g/tot)*100).toFixed(1)+'% of plan gross'));
  console.log('\nnow: same plan but pakkut price halved 50->25 and ginger 30->15');
  const s2 = buildSystems(baseInput({ elevationM: 400, cropAssumptions: [
    { plantId: 'pakkut', pricePerKg: 25 }, { plantId: 'ginger', pricePerKg: 15 },
  ]}), climate(400), null, null)[0];
  console.log('profit10 =', s2.profit10, '=', Math.round(s2.profit10/10/10), 'THB/rai/yr  (picks:', s2.picks.map(p=>p.plant.nameTh).join(' '), ')');
});
