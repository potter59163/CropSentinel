#!/usr/bin/env python3
"""
Final soil decision, run AFTER merge_soil.py has topped up the SoilGrids cache.

Round 1 found that adding the five raw soil columns HURT the honest blocked-CV AUC
(0.7126 with soil vs 0.7185 without). That test was confounded, though: only 30% of
in-region cells had real soil, so 70% of them carried an identical median-imputed
row. This re-runs the same comparison with coverage roughly doubled, which is the
fair version of the test.

Prints a verdict so the shipped feature set follows the measurement rather than the
other way round.
"""
import numpy as np
from experiments import Data, Cfg, CLIMATE_BASE, SOIL_RAW, SOIL_DERIVED, run, in_region, ck

data = Data(derived='runtime')
n_in = sum(1 for c in data.cells if in_region(c))
cov_in = sum(1 for c in data.cells if in_region(c) and data.feat.get(ck(c), {}).get('soil_ph') is not None)
print(f'in-region soil coverage now: {cov_in}/{n_in} ({100*cov_in/n_in:.0f}%)\n')

SQ = ['t2m', 'prec', 'elev']
tests = [
    ('climate_only', Cfg('climate_only', base=CLIMATE_BASE, sq=SQ,
                         neg_mode='region_matched', model='nested')),
    ('climate+soil_raw', Cfg('climate+soil_raw', base=CLIMATE_BASE + SOIL_RAW, sq=SQ,
                             neg_mode='region_matched', model='nested')),
    ('climate+soil_raw+derived', Cfg('climate+soil_raw+derived',
                                     base=CLIMATE_BASE + SOIL_RAW + SOIL_DERIVED, sq=SQ,
                                     neg_mode='region_matched', model='nested')),
    ('climate+soil_ph_oc', Cfg('climate+soil_ph_oc', base=CLIMATE_BASE + ['soil_ph', 'soil_oc'], sq=SQ,
                               neg_mode='region_matched', model='nested')),
]

out = {}
per_all = {}
for label, cfg in tests:
    s, per = run(data, cfg, verbose=False)
    out[label] = s
    per_all[label] = per
    print(f'{label:28s} nsp={s["species"]:3d} meanAUC={s["meanAuc"]:.4f} minAUC={s["minAuc"]:.3f} '
          f'Brier={s["meanBrier"]:.4f}')

base = out['climate_only']['meanAuc']
print()
best = max(out, key=lambda k: out[k]['meanAuc'])
for label in out:
    d = out[label]['meanAuc'] - base
    print(f'  {label:28s} delta vs climate_only = {d:+.4f}')
print(f'\nVERDICT: best = {best} (mean AUC {out[best]["meanAuc"]:.4f})')
if best == 'climate_only':
    print('  -> soil does NOT earn a place in the v4 feature set; ship climate-only and say so.')
else:
    print(f'  -> ship {best}.')

# per-species delta for whichever soil variant won, so the report can be specific
if best != 'climate_only':
    print(f'\nper-species: climate_only -> {best}')
    for n in sorted(per_all['climate_only']):
        a = per_all['climate_only'][n]['auc']
        b = per_all[best][n]['auc']
        print(f'  {n:12s} {a:.3f} -> {b:.3f}  ({b-a:+.3f})')
