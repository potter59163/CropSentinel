#!/usr/bin/env python3
"""
Round 2. Two questions:
  T*: is the AUC that the GISTDA disaster columns add real, or is it the residual
      "is this cell in Thailand" leak that drought_layers encodes?
  V*: with soil coverage topped up, does real soil finally earn its place?
"""
import sys
import numpy as np
from experiments import (Data, Cfg, CLIMATE_BASE, DISASTER_BASE, SOIL_RAW, SOIL_DERIVED, run,
                         geo_stratum, in_region, thailandish, ck)

only = sys.argv[1:] or None
data = Data(derived='runtime')

cov_in = sum(1 for c in data.cells if in_region(c) and data.feat.get(ck(c), {}).get('soil_ph') is not None)
n_in = sum(1 for c in data.cells if in_region(c))
cov = sum(1 for c in data.cells if data.feat.get(ck(c), {}).get('soil_ph') is not None)
print(f'soil coverage: {cov}/{len(data.cells)} overall, {cov_in}/{n_in} in-region ({100*cov_in/n_in:.0f}%)')

CONFIGS = [
    # T: disaster-column provenance, under the STRICTER geography-matched background
    Cfg('T0_geomatched_climate_only',
        base=CLIMATE_BASE, sq=['t2m', 'prec', 'elev'], neg_mode='geo_matched', model='nested'),
    Cfg('T1_geomatched_climate+all_disaster',
        base=CLIMATE_BASE + DISASTER_BASE, sq=['t2m', 'prec', 'elev'],
        neg_mode='geo_matched', model='nested'),
    Cfg('T2_geomatched_climate+drought_layers_only',
        base=CLIMATE_BASE + ['drought_layers'], sq=['t2m', 'prec', 'elev'],
        neg_mode='geo_matched', model='nested'),
    Cfg('T3_regionmatched_climate+drought_layers_only',
        base=CLIMATE_BASE + ['drought_layers'], sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested'),

    # V: soil, now that the cache holes are filled -- region_matched so it is
    # directly comparable to the F1/F3 rows of round 1
    Cfg('V0_regionmatched_climate_only (== F3 rerun)',
        base=CLIMATE_BASE, sq=['t2m', 'prec', 'elev'], neg_mode='region_matched', model='nested'),
    Cfg('V1_regionmatched_climate+soil_raw (== F1 rerun)',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested'),
    Cfg('V2_regionmatched_climate+soil_raw+derived',
        base=CLIMATE_BASE + SOIL_RAW + SOIL_DERIVED, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested'),
    Cfg('V3_regionmatched_climate+soil_ph_oc_only',
        base=CLIMATE_BASE + ['soil_ph', 'soil_oc'], sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested'),
    Cfg('V4_geomatched_climate+soil_raw',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='geo_matched', model='nested'),

    # W: score ONLY on held-out cells inside the SE-Asia region. This is the closest
    # available proxy for the question the app actually asks -- "rank crops for a plot
    # in Nan" -- since a global test fold rewards telling continents apart.
    Cfg('W0_climate_only_TESTED_IN_REGION',
        base=CLIMATE_BASE, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested', test_scope='region'),
    Cfg('W1_climate+soil_raw_TESTED_IN_REGION',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested', test_scope='region'),
    Cfg('W2_old_v3_featureset_TESTED_IN_REGION',
        base=CLIMATE_BASE + DISASTER_BASE + SOIL_RAW,
        sq=['t2m', 'prec', 'elev', 'fire7d_near', 'flood_freq_near'],
        neg_mode='orig', model='best_peek', test_scope='region'),
]

res = {}
for cfg in CONFIGS:
    if only and not any(o in cfg.name for o in only):
        continue
    s, per = run(data, cfg)
    res[cfg.name] = s

print('\n\n============ ROUND 2 SUMMARY (2-deg blocks, nested selection) ============')
print(f'{"config":52s} {"nsp":>4s} {"meanAUC":>8s} {"minAUC":>7s}')
for k, s in res.items():
    print(f'{k:52s} {s["species"]:4d} {s["meanAuc"]:8.4f} {s["minAuc"]:7.3f}')
