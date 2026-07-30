#!/usr/bin/env python3
"""
Independent check that src/data/sdm_model.json is exactly what src/lib/suitability.ts
expects. Re-implements the DEPLOYED TypeScript inference in Python from scratch
(feature-vector assembly, median imputation, standardisation, GBM traversal,
envelope + agronomic guardrail) and prints the resulting scores.

This catches schema drift that a Python-side unit test would not: wrong array
lengths, features that no runtime context can supply (which would silently become
the training median), a GBM `init` exported as a probability instead of a log-odds,
or feature indices that no longer line up with `features`.
"""
import json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'src')
M = json.load(open(os.path.join(SRC, 'data', 'sdm_model.json')))

fail = []


def check(ok, msg):
    print(('  OK   ' if ok else '  FAIL ') + msg)
    if not ok:
        fail.append(msg)


print('1) schema invariants suitability.ts relies on')
check(isinstance(M.get('base'), list), 'base is an array (READY guard)')
check(isinstance(M.get('median'), list), 'median is an array (READY guard)')
check(isinstance(M.get('species'), dict) and len(M['species']) > 0, 'species is a non-empty object')
check(len(M['median']) == len(M['base']), f'len(median)=={len(M["median"])} == len(base)=={len(M["base"])}')
check(M['features'] == M['base'] + [f'{n}_sq' for n in M['sq']], 'features == base + [f"{n}_sq" for n in sq]')
check(len(M['mean']) == len(M['features']), f'len(mean)=={len(M["mean"])} == len(features)=={len(M["features"])}')
check(len(M['std']) == len(M['features']), f'len(std)=={len(M["std"])} == len(features)=={len(M["features"])}')
check(all(s != 0 for s in M['std']), 'no zero std (would divide by 1 via `|| 1` but signals a constant feature)')
for tid, sp in M['species'].items():
    if len(sp['w']) != len(M['features']):
        check(False, f'{tid}: len(w)={len(sp["w"])} != len(features)={len(M["features"])}')
    if sp.get('gbm'):
        mx = max(max(t['feature']) for t in sp['gbm']['trees'])
        if mx >= len(M['features']):
            check(False, f'{tid}: gbm feature index {mx} out of range')
check(all(len(sp['w']) == len(M['features']) for sp in M['species'].values()), 'every species w matches feature count')

print('\n2) every base feature name is resolvable by suitability.ts vector()')
sut = open(os.path.join(SRC, 'lib', 'suitability.ts')).read()
clim = open(os.path.join(SRC, 'lib', 'climate.ts')).read()
clim_keys = set(re.findall(r'(\w+):\s*number', re.search(r'export interface Climate \{(.*?)\n\}', clim, re.S).group(1)))
dis_keys = set(re.findall(r'^\s{4}(\w+):', re.search(r'export function disasterFeatureContext.*?\n\}', sut, re.S).group(0), re.M))
soil_keys = set(re.findall(r'^\s+(soil_\w+):', re.search(r'export function soilFeatureContext.*?^\}', sut, re.S | re.M).group(0), re.M))
resolvable = clim_keys | dis_keys | soil_keys
for n in M['base']:
    check(n in resolvable, f'base feature "{n}" is supplied at inference'
                           + ('' if n in resolvable else '  <-- would silently fall back to the training median'))
print(f'  (runtime can supply: {sorted(resolvable)})')

print('\n3) replicate the deployed JS inference')
PLANTS = {}
for m in re.finditer(r"P\('([\w]+)',\s*'[^']*',\s*'[^']*',\s*'(\w+)',\s*'[^']*',\s*(\d+),\s*(\d+),", open(os.path.join(SRC, 'data', 'plants.ts')).read()):
    PLANTS[m.group(1)] = {'layer': m.group(2), 'elevMin': int(m.group(3)), 'elevMax': int(m.group(4))}
AUC_MIN = 0.65


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def envelope(p, elev):
    if p['elevMin'] <= elev <= p['elevMax']:
        return 1.0
    d = p['elevMin'] - elev if elev < p['elevMin'] else elev - p['elevMax']
    return clamp(1 - d / 450, 0.05, 1)


def guardrail(score, p, elev):
    ef = envelope(p, elev)
    return clamp(min(score * 0.78 + ef * 0.22, 0.35 + ef * 0.65), 0.05, 1)


def vector(clim_vals, disaster, soilf):
    base = []
    for i, n in enumerate(M['base']):
        v = clim_vals.get(n, disaster.get(n, soilf.get(n)))
        base.append(v if isinstance(v, (int, float)) and math.isfinite(v) else M['median'][i])
    sq = [base[M['base'].index(n)] ** 2 for n in M['sq']]
    return base + sq


def sigmoid(v):
    return 1 / (1 + math.exp(-v))


def logit_predict(sp, x):
    lin = sp['b']
    for i, xi in enumerate(x):
        lin += sp['w'][i] * ((xi - M['mean'][i]) / (M['std'][i] or 1))
    return sigmoid(lin)


def gbm_predict(sp, x):
    if not sp.get('gbm'):
        return logit_predict(sp, x)
    raw = sp['gbm']['init']
    for t in sp['gbm']['trees']:
        node = 0
        while t['children_left'][node] != -1 and t['children_right'][node] != -1:
            node = t['children_left'][node] if x[t['feature'][node]] <= t['threshold'][node] else t['children_right'][node]
        raw += sp['gbm']['learningRate'] * t['value'][node]
    return sigmoid(raw)


def suitability(tid, clim_vals):
    sp = M['species'].get(tid)
    p = PLANTS[tid]
    if sp and sp['auc'] >= AUC_MIN and math.isfinite(clim_vals.get('t2m', float('nan'))):
        x = vector(clim_vals, {}, {})
        s = gbm_predict(sp, x) if sp.get('preferred') == 'gbm' and sp.get('gbm') else logit_predict(sp, x)
        return guardrail(s, p, clim_vals['elev']), 'model'
    return envelope(p, clim_vals.get('elev', p['elevMin'])), 'envelope'


# the exact fixture from src/lib/suitability.test.ts
NAN_LOWLAND = dict(t2m=26, prec=1450, drym=3, pseas=62, trange=22, solar=18, rh=79, gwet=0.65, elev=300)
NAN_HIGHLAND = dict(t2m=21, prec=1500, drym=3, pseas=60, trange=20, solar=17, rh=82, gwet=0.7, elev=1200)

print('   src/lib/suitability.test.ts fixture NAN_LOWLAND (no soil/disaster supplied):')
b, src_b = suitability('banana', NAN_LOWLAND)
print(f'     banana    -> {b:.4f}  source={src_b}')
print(f'       test asserts source=="model" and 0.2 < score < 0.32  ->  '
      f'{"PASS" if src_b == "model" and 0.2 < b < 0.32 else "FAIL (golden band needs updating)"}')
mac, _ = suitability('macadamia', NAN_LOWLAND)
print(f'     macadamia -> {mac:.4f}   (test asserts banana > macadamia -> {"PASS" if b > mac else "FAIL"})')
mango1, _ = suitability('mango', NAN_LOWLAND)
mango2, _ = suitability('mango', NAN_LOWLAND)
print(f'     mango determinism -> {"PASS" if mango1 == mango2 else "FAIL"}')

print('\n   plausible Nan highland plot (1200 m), ranked:')
rows = []
for tid in PLANTS:
    s, srcs = suitability(tid, NAN_HIGHLAND)
    sp = M['species'].get(tid)
    rows.append((s, tid, srcs, sp['auc'] if sp else None))
for s, tid, srcs, auc in sorted(rows, reverse=True):
    tag = f'auc={auc}' if auc is not None else 'EXCLUDED->expert judgement'
    print(f'     {tid:12s} {s:.3f}  {srcs:9s} {tag}')

print('\n4) species coverage vs src/data/plants.ts sdmIds')
sdm_ids = set(re.findall(r"P\('(\w+)'", open(os.path.join(SRC, 'data', 'plants.ts')).read()))
modelled = set(M['species'])
excluded = set(M.get('excludedSpecies', {}))
print(f'   plants: {len(sdm_ids)}  modelled: {len(modelled)}  explicitly excluded: {len(excluded)}')
silent = sdm_ids - modelled - excluded
check(not silent, f'no plant is silently absent from the model JSON (silent: {sorted(silent)})')
gated = sorted(t for t, sp in M['species'].items() if sp['auc'] < AUC_MIN)
print(f'   modelled but BELOW the 0.65 gate (runtime -> envelope, confidence "low"): {gated}')
print(f'   count above gate = {len([1 for sp in M["species"].values() if sp["auc"] >= AUC_MIN])}'
      f'  (suitability.test.ts asserts >= 15)')

print('\n' + ('ALL CHECKS PASSED' if not fail else f'{len(fail)} CHECK(S) FAILED'))
sys.exit(1 if fail else 0)
