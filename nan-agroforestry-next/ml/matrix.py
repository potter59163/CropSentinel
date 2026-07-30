#!/usr/bin/env python3
"""Experiment matrix. Every config is scored on the SAME cached data with the SAME
spatial-block GroupKFold protocol, so the deltas are apples-to-apples."""
import json, os, sys, time
import numpy as np
from experiments import (Data, Cfg, OLD_BASE, OLD_SQ, CLIMATE_BASE, DISASTER_BASE,
                         SOIL_RAW, SOIL_DERIVED, run)

only = sys.argv[1:] or None
data = Data(derived='runtime')

# Disaster features worth keeping: flood7d_near is identically zero everywhere in the
# training pool, fire7d_near/burn_freq_near/flood_freq_near are >98% zero, and
# drought_layers is a 0/3 "GISTDA was queried here" flag = pure geography.
LEAN_DISASTER = []
KEEP_DISASTER = ['burn_freq_near', 'flood_freq_near']

CONFIGS = [
    # --- reference: the recipe that produced the committed v3 model ---
    Cfg('R0_as_built  (old feats, orig negs, peeked model pick)',
        base=OLD_BASE, sq=OLD_SQ, neg_mode='orig', model='best_peek'),
    Cfg('R1_logit_only (no peeking, logit)',
        base=OLD_BASE, sq=OLD_SQ, neg_mode='orig', model='logit'),
    Cfg('R1_gbm_only   (no peeking, gbm)',
        base=OLD_BASE, sq=OLD_SQ, neg_mode='orig', model='gbm'),
    Cfg('R2_nested     (honest model selection, old feats/negs)',
        base=OLD_BASE, sq=OLD_SQ, neg_mode='orig', model='nested'),

    # --- remove the geographic shortcut ---
    Cfg('G1_regionmatched_negs + nested',
        base=OLD_BASE, sq=OLD_SQ, neg_mode='region_matched', model='nested'),
    Cfg('G1b_regionmatched_negs + best_peek (isolates the neg-sampling effect)',
        base=OLD_BASE, sq=OLD_SQ, neg_mode='region_matched', model='best_peek'),

    # --- feature-set changes, all on the honest G1 protocol ---
    Cfg('F1_drop_all_disaster',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested'),
    Cfg('F2_drop_disaster_add_soil_derived(runtime-consistent)',
        base=CLIMATE_BASE + SOIL_RAW + SOIL_DERIVED,
        sq=['t2m', 'prec', 'elev', 'soil_acidity_idx'],
        neg_mode='region_matched', model='nested'),
    Cfg('F3_climate_only (no soil at all -- soil ablation)',
        base=CLIMATE_BASE, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested'),
    Cfg('F4_keep_2_disaster + soil raw',
        base=CLIMATE_BASE + KEEP_DISASTER + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested'),

    # --- sampling / regularisation on the best feature set (filled in below) ---
    Cfg('S1_more_negs_ratio4',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested', neg_ratio=4, neg_floor=400),
    Cfg('S2_balanced_class_weight',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested', neg_ratio=4, neg_floor=400,
        class_weight='balanced'),
    Cfg('S3_stronger_L2_C0.3',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested', neg_ratio=4, neg_floor=400, C=0.3),
    Cfg('S4_no_quadratics',
        base=CLIMATE_BASE + SOIL_RAW, sq=[],
        neg_mode='region_matched', model='nested', neg_ratio=4, neg_floor=400),
    Cfg('S5_blocks_5deg',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested', neg_ratio=4, neg_floor=400, block_deg=5.0),
    Cfg('S6_blocks_1deg',
        base=CLIMATE_BASE + SOIL_RAW, sq=['t2m', 'prec', 'elev'],
        neg_mode='region_matched', model='nested', neg_ratio=4, neg_floor=400, block_deg=1.0),
]

results = {}
for cfg in CONFIGS:
    if only and not any(o in cfg.name for o in only):
        continue
    t0 = time.time()
    s, per = run(data, cfg)
    s['secs'] = round(time.time() - t0, 1)
    results[cfg.name] = {'summary': s, 'per': per}
    print(f'  ({s["secs"]}s)')

print('\n\n================ SUMMARY (same data, same blocked CV) ================')
print(f'{"config":58s} {"nsp":>4s} {"meanAUC":>8s} {"minAUC":>7s} {"Brier":>7s}')
for k, v in results.items():
    s = v['summary']
    print(f'{k:58s} {s["species"]:4d} {s["meanAuc"]:8.4f} {s["minAuc"]:7.3f} {s["meanBrier"]:7.4f}')

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'matrix_results.json')
json.dump({k: v['summary'] | {'per': {n: {kk: vv for kk, vv in r.items()} for n, r in v['per'].items()}}
           for k, v in results.items()}, open(out, 'w'), indent=1, default=str)
print('\nwrote', out)
