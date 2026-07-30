#!/usr/bin/env python3
"""Fold ml/cache/soil_topup.json back into soil_v3.json + features_v3.json."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from experiments import in_region, soil_indices_runtime, SOIL_DERIVED

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
soil = json.load(open(os.path.join(CACHE, 'soil_v3.json')))
top = json.load(open(os.path.join(CACHE, 'soil_topup.json')))
feat = json.load(open(os.path.join(CACHE, 'features_v3.json')))

before = sum(1 for v in soil.values() if v and v.get('soil_ph') is not None)
added = 0
for k, v in top.items():
    if not v or v.get('soil_ph') is None:
        continue
    soil[k] = v
    added += 1
after = sum(1 for v in soil.values() if v and v.get('soil_ph') is not None)

# keep features_v3 in sync, recomputing the runtime-consistent derived indices
for k, v in soil.items():
    if not v or v.get('soil_ph') is None:
        continue
    merged = dict(v)
    merged.update(soil_indices_runtime(v.get('soil_ph'), v.get('soil_clay'), v.get('soil_sand'),
                                       v.get('soil_oc'), v.get('soil_cec')))
    feat.setdefault(k, {}).update(merged)

json.dump(soil, open(os.path.join(CACHE, 'soil_v3.json'), 'w'))
json.dump(feat, open(os.path.join(CACHE, 'features_v3.json'), 'w'))


def cov(pred):
    keys = [k for k in feat if pred(tuple(float(x) for x in k.split(',')))]
    have = sum(1 for k in keys if feat[k].get('soil_ph') is not None)
    return have, len(keys)

print(f'merged {added} topped-up cells: real-soil cells {before} -> {after}')
h, n = cov(in_region); print(f'  in-region soil coverage : {h}/{n} ({100*h/n:.0f}%)')
h, n = cov(lambda c: True); print(f'  overall  soil coverage : {h}/{n} ({100*h/n:.0f}%)')
