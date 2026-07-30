#!/usr/bin/env python3
"""Leakage / honesty diagnostics for the shipped SDM. Offline (cache only)."""
import json, math, os, random
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupKFold

from experiments import Data, Cfg, in_region, blocks, OLD_BASE, OLD_SQ, ck

HERE = os.path.dirname(os.path.abspath(__file__))
data = Data()

print('CELLS with climate:', len(data.cells))
print('  in-region:', sum(1 for c in data.cells if in_region(c)))

print('\n--- D1: how much of each species AUC is explainable by geography alone? ---')
print('    "region-only AUC" fits a model whose ONLY feature is the in-region flag,')
print('    on the exact same positives/negatives the real recipe uses.')
rng = random.Random(9)
idx = {c: i for i, c in enumerate(data.cells)}
rows_report = []
for name, cs in data.pres.items():
    pos = [c for c in cs if c in idx]
    if len(pos) < 18:
        continue
    posset = set(pos)
    pool = [c for c in data.cells if c not in posset]
    neg = rng.sample(pool, min(len(pool), max(len(pos) * 2, 180)))
    cells = pos + neg
    y = np.array([1] * len(pos) + [0] * len(neg))
    flag = np.array([[1.0 if in_region(c) else 0.0] for c in cells])
    # AUC of the single "in region" flag (rank-based, no fitting needed)
    auc_flag = roc_auc_score(y, -flag[:, 0])  # presences tend to be OUT of region
    pin_pos = sum(1 for c in pos if in_region(c)) / len(pos)
    pin_neg = sum(1 for c in neg if in_region(c)) / len(neg)
    rows_report.append((name, len(pos), pin_pos, pin_neg, max(auc_flag, 1 - auc_flag)))
print(f"    {'species':12s} {'n':>4s} {'%pos in-reg':>11s} {'%neg in-reg':>11s} {'region-only AUC':>15s}")
for name, n, pp, pn, a in sorted(rows_report, key=lambda r: -r[4]):
    print(f"    {name:12s} {n:4d} {100*pp:10.1f}% {100*pn:10.1f}% {a:15.3f}")
print(f"    mean region-only AUC = {np.mean([r[4] for r in rows_report]):.4f}")

print('\n--- D2: is soil MISSINGNESS a geographic shortcut? ---')
n_in = n_in_soil = n_out = n_out_soil = 0
for c in data.cells:
    has = data.feat.get(ck(c), {}).get('soil_ph') is not None
    if in_region(c):
        n_in += 1; n_in_soil += has
    else:
        n_out += 1; n_out_soil += has
print(f"    in-region  cells {n_in:5d}  with real soil {n_in_soil:5d} ({100*n_in_soil/n_in:.1f}%)")
print(f"    out-region cells {n_out:5d}  with real soil {n_out_soil:5d} ({100*n_out_soil/n_out:.1f}%)")
print('    -> median-imputing missing soil creates a constant-valued "sentinel" row')
print('       whose frequency differs by region, i.e. a proxy for geography.')

print('\n--- D3: how near-constant are the disaster features? ---')
for nm in ['fire7d_near', 'burn_freq_near', 'flood7d_near', 'flood_freq_near', 'drought_layers']:
    v = np.array([data.feat.get(ck(c), {}).get(nm) or 0.0 for c in data.cells], float)
    nz = int((v != 0).sum())
    vin = np.array([data.feat.get(ck(c), {}).get(nm) or 0.0 for c in data.cells if in_region(c)], float)
    print(f"    {nm:18s} nonzero {nz:5d}/{len(v)} ({100*nz/len(v):5.2f}%)  "
          f"nonzero-in-region {int((vin!=0).sum()):5d}/{len(vin)}  max {v.max():.3f}")
