#!/usr/bin/env python3
"""
Species Distribution Model (SDM) v4.

┌───────────────────────────────────────────────────────────────────────────────┐
│ WARNING — THIS TRAINER IS AHEAD OF THE SHIPPED MODEL.                        │
│                                                                               │
│ src/data/sdm_model.json is still the **v3** export (mean AUC 0.8415).         │
│ Running this file will produce a DIFFERENT feature set and different AUCs.    │
│ Do not ship its output without re-reading ml/MODEL-FINDINGS.md and re-running  │
│ the full app verification — changing suitability changes every species         │
│ ranking and every 10-year cashflow in the product.                            │
│                                                                               │
│ Headline reason to read that file first: the shipped 0.8415 is inflated by     │
│ optimistic background sampling and model-selection peeking; the region-matched │
│ nested estimate is ~0.72. Adding soil features did NOT improve AUC.           │
└───────────────────────────────────────────────────────────────────────────────┘

What changed from v3:
  - Keeps SoilGrids numeric properties in the trained feature set.
  - Adds derived soil indices (drainage/acidity/fertility) that can be computed
    consistently from SoilGrids during training and from LDD/SoilGrids at runtime.
  - Keeps all-layer GBIF training, pseudo-background cells, GISTDA disaster
    features, spatial-block validation, and the logistic/GBM ensemble export.

What changed from v2:
  - GBIF occurrence cap is higher and covers every plant layer, not canopy only.
  - Adds pseudo-background cells so absence sampling is not just "other crops".
  - Adds GISTDA disaster features when GISTDA_DISASTER_API_KEY is available.
  - Reports spatial-block ROC-AUC, not only random K-fold.
  - Exports both logistic regression and a small Gradient Boosting ensemble for
    in-browser inference; runtime can prefer GBM when its spatial AUC is better.

The script still exports a compact JSON to ../src/data/sdm_model.json.
"""
import concurrent.futures
import json, math, os, random, ssl, time, urllib.parse, urllib.request
from typing import Dict, Iterable, List, Tuple

import certifi

random.seed(9)
SSL = ssl.create_default_context(cafile=certifi.where())
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache'); os.makedirs(CACHE, exist_ok=True)
OUT = os.getenv('SDM_OUT') or os.path.join(HERE, '..', 'src', 'data', 'sdm_model.json')

SPECIES = {
    # canopy
    'banana': 'Musa acuminata',
    'mango': 'Mangifera indica',
    'longan': 'Dimocarpus longan',
    'cashew': 'Anacardium occidentale',
    'avocado': 'Persea americana',
    'macadamia': 'Macadamia integrifolia',
    'maikhwaen': 'Zanthoxylum rhetsa',
    'bamboo': 'Bambusa',
    'teak': 'Tectona grandis',
    # shrub
    'coffee': 'Coffea arabica',
    'chili': 'Capsicum annuum',
    'tea': 'Camellia sinensis',
    'lemongrass': 'Cymbopogon citratus',
    # groundcover
    'peanut': 'Arachis hypogaea',
    'pumpkin': 'Cucurbita moschata',
    'sweetpotato': 'Ipomoea batatas',
    'pineapple': 'Ananas comosus',
    # root
    'ginger': 'Zingiber officinale',
    'turmeric': 'Curcuma longa',
    'taro': 'Colocasia esculenta',
    'galangal': 'Alpinia galanga',
}

REGION = (5.0, 28.0, 92.0, 112.0)  # lat0, lat1, lon0, lon1 (SE Asia)
GRID = float(os.getenv('SDM_GRID', '0.25'))
PRES_CAP = int(os.getenv('SDM_PRES_CAP', '650'))
BACKGROUND_CAP = int(os.getenv('SDM_BACKGROUND_CAP', '900'))
POWER_WORKERS = int(os.getenv('SDM_POWER_WORKERS', '10'))
GISTDA_CELL_CAP = int(os.getenv('SDM_GISTDA_CELL_CAP', '140'))
SKIP_GBIF_TOPUP = os.getenv('SDM_SKIP_GBIF_TOPUP', '0') == '1'
MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

CLIMATE_BASE = ['t2m', 'prec', 'drym', 'pseas', 'trange', 'solar', 'rh', 'gwet', 'elev']
DISASTER_BASE = ['fire7d_near', 'burn_freq_near', 'flood7d_near', 'flood_freq_near', 'drought_layers']
# Real soil from SoilGrids (ISRIC), same physical units as runtime src/lib/soil.ts.
# The *_idx features are derived from the same raw values; at runtime they can
# also be derived from LDD soil-group context when SoilGrids is missing.
SOIL_RAW = ['soil_ph', 'soil_clay', 'soil_sand', 'soil_oc', 'soil_cec']
SOIL_DERIVED = ['soil_drainage_idx', 'soil_acidity_idx', 'soil_fertility_idx']
SOIL_BASE = SOIL_RAW + SOIL_DERIVED
# Ablation switch: SDM_DISABLE_SOIL=1 trains without any soil columns, using the
# exact same cached presence/background/climate pool, to isolate whether an AUC
# change comes from soil features or from a change in the occurrence data itself.
DISABLE_SOIL = os.getenv('SDM_DISABLE_SOIL', '0') == '1'

# --- v4 feature set ----------------------------------------------------------
# The GISTDA disaster columns are dropped. In the training pool they are
# effectively constants: flood7d_near is 0 in 4245/4245 cells, fire7d_near is
# nonzero in 13, burn_freq_near in 22, flood_freq_near in 70 — and drought_layers
# is a 0/3 flag that is 3 exactly when the GISTDA scan reached that cell, i.e. a
# "this cell is in Thailand" indicator rather than a drought measurement. Keeping
# them let the model buy AUC with geography and created a train/serve skew, since
# at inference these same columns carry REAL nonzero counts for a Nan plot.
# See ml/diagnose.py (D3) and the F1/F4 rows of ml/matrix.py.
KEEP_DISASTER: List[str] = []
INCLUDE_SOIL_DERIVED = os.getenv('SDM_SOIL_DERIVED', '0') == '1'

BASE = (CLIMATE_BASE + KEEP_DISASTER
        + ([] if DISABLE_SOIL else SOIL_RAW + (SOIL_DERIVED if INCLUDE_SOIL_DERIVED else [])))
SQ = ['t2m', 'prec', 'elev']
FEATURES = BASE + [f'{n}_sq' for n in SQ]

# --- v4 training protocol ----------------------------------------------------
MIN_POS = int(os.getenv('SDM_MIN_POS', '40'))
NEG_RATIO = int(os.getenv('SDM_NEG_RATIO', '4'))
NEG_FLOOR = int(os.getenv('SDM_NEG_FLOOR', '400'))
BLOCK_DEG = float(os.getenv('SDM_BLOCK_DEG', '2'))

SOILGRIDS = 'https://rest.isric.org/soilgrids/v2.0/properties/query'
SOIL_PROPS = ['phh2o', 'soc', 'clay', 'sand', 'cec']
SOIL_DEPTHS = ['0-5cm', '5-15cm']
SOIL_CONV = {'phh2o': lambda v: v / 10, 'soc': lambda v: v / 100, 'clay': lambda v: v / 10, 'sand': lambda v: v / 10, 'cec': lambda v: v}
# ISRIC's free SoilGrids endpoint is slow and occasionally hangs under bulk use;
# give it its own short timeout/retry budget so a handful of bad cells can't
# stall the whole pipeline for minutes each (the generic http_json() below is
# tuned for GBIF/NASA POWER, which behave far better).
SOIL_TIMEOUT = float(os.getenv('SDM_SOIL_TIMEOUT', '12'))
SOIL_TRIES = int(os.getenv('SDM_SOIL_TRIES', '2'))
# Hard wall-clock budget (seconds) for the whole soil-fetch stage. Whatever is
# still missing when the budget runs out is left as None (median-imputed at
# train time and at runtime), so the pipeline always finishes in bounded time
# instead of hanging on a slow/unreachable API.
SOIL_TIME_BUDGET_SEC = float(os.getenv('SDM_SOIL_TIME_BUDGET_SEC', '600'))
SOIL_WORKERS = int(os.getenv('SDM_SOIL_WORKERS', '8'))


def http_json(url, tries=4, timeout=45):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=timeout, context=SSL) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1.0 * (i + 1))


def snap(v: float) -> float:
    return round(round(v / GRID) * GRID, 3)


def cell_key(cell: Tuple[float, float]) -> str:
    return f'{cell[0]},{cell[1]}'


def taxon_key(sci: str):
    d = http_json('https://api.gbif.org/v1/species/match?name=' + urllib.parse.quote(sci))
    return d.get('usageKey')


def fetch_presence() -> Dict[str, List[List[float]]]:
    path = os.path.join(CACHE, 'presence_v3.json')
    out = json.load(open(path)) if os.path.exists(path) else {}
    if SKIP_GBIF_TOPUP and out:
        return {k: v[:PRES_CAP] for k, v in out.items()}
    for tid, sci in SPECIES.items():
        cached_cells = {tuple(c) for c in out.get(tid, [])}
        key = taxon_key(sci)
        cells = set(cached_cells)

        def pull(regional: bool):
            off = 0
            while len(cells) < PRES_CAP and off < 6000:
                q = {
                    'hasCoordinate': 'true',
                    'hasGeospatialIssue': 'false',
                    'limit': 300,
                    'offset': off,
                }
                if key:
                    q['taxonKey'] = key
                else:
                    q['scientificName'] = sci
                if regional:
                    q['decimalLatitude'] = f'{REGION[0]},{REGION[1]}'
                    q['decimalLongitude'] = f'{REGION[2]},{REGION[3]}'
                d = http_json('https://api.gbif.org/v1/occurrence/search?' + urllib.parse.urlencode(q))
                res = d.get('results', [])
                if not res:
                    break
                for r in res:
                    la, lo = r.get('decimalLatitude'), r.get('decimalLongitude')
                    if la is not None and lo is not None:
                        if not regional or (REGION[0] <= la <= REGION[1] and REGION[2] <= lo <= REGION[3]):
                            cells.add((snap(float(la)), snap(float(lo))))
                off += 300
                if d.get('endOfRecords'):
                    break

        if len(cells) < PRES_CAP:
            pull(True)
        if len(cells) < 80:
            pull(False)
        out[tid] = [list(c) for c in list(cells)[:PRES_CAP]]
        print(f'  GBIF {tid:12s} key={key} -> {len(out[tid])} cells')
        time.sleep(0.35)
    json.dump(out, open(path, 'w'), ensure_ascii=False)
    return out


def background_cells() -> List[Tuple[float, float]]:
    path = os.path.join(CACHE, f'background_v3_{BACKGROUND_CAP}.json')
    if os.path.exists(path):
        return [tuple(c) for c in json.load(open(path))]
    lat0, lat1, lon0, lon1 = REGION
    cells = set()
    while len(cells) < BACKGROUND_CAP:
        cells.add((snap(random.uniform(lat0, lat1)), snap(random.uniform(lon0, lon1))))
    out = sorted(cells)
    json.dump([list(c) for c in out], open(path, 'w'))
    return out


def thailandish(cell: Tuple[float, float]) -> bool:
    la, lo = cell
    return 5.0 <= la <= 21.5 and 97.0 <= lo <= 106.5


def bbox(cell: Tuple[float, float], radius_km=25) -> str:
    la, lo = cell
    lat_d = radius_km / 111.32
    lng_d = radius_km / (111.32 * max(math.cos(math.radians(la)), 0.08))
    return ','.join(f'{v:.6f}' for v in [lo - lng_d, la - lat_d, lo + lng_d, la + lat_d])


def gistda_count(path: str, params: dict, api_key: str) -> int:
    q = urllib.parse.urlencode({**params, 'limit': 1, 'offset': 0, 'api_key': api_key})
    try:
        url = f'https://api-gateway.gistda.or.th/api/2.0/resources{path}?{q}'
        with urllib.request.urlopen(url, timeout=12, context=SSL) as r:
            d = json.load(r)
        return int(d.get('numberMatched') or len(d.get('features') or []))
    except Exception:
        return 0


def fetch_disaster(cells: Iterable[Tuple[float, float]]) -> Dict[str, dict]:
    cells = list(cells)
    path = os.path.join(CACHE, 'disaster_v3.json')
    data = json.load(open(path)) if os.path.exists(path) else {}
    key = os.getenv('GISTDA_DISASTER_API_KEY', '').strip().lstrip('-')
    live = sum(1 for v in data.values() if v.get('drought_layers', 0) > 0)
    for n, cell in enumerate(cells):
        k = cell_key(cell)
        if k in data:
            continue
        if not key or not thailandish(cell):
            data[k] = {name: 0 for name in DISASTER_BASE}
            continue
        if live >= GISTDA_CELL_CAP:
            data[k] = {name: 0 for name in DISASTER_BASE}
            data[k]['drought_layers'] = 3
            continue
        b = bbox(cell)
        data[k] = {
            'fire7d_near': math.log1p(gistda_count('/features/viirs/7days', {'bbox': b}, key)),
            'burn_freq_near': math.log1p(gistda_count('/features/burn-freq', {'bbox': b}, key)),
            'flood7d_near': math.log1p(gistda_count('/features/flood/7days', {'bbox': b}, key)),
            'flood_freq_near': math.log1p(gistda_count('/features/flood-freq', {'bbox': b}, key)),
            'drought_layers': 3,
        }
        live += 1
        if live % 10 == 0:
            json.dump(data, open(path, 'w'))
            print(f'    GISTDA disaster live-cells={live} scanned={n}/{len(cells)}')
        time.sleep(0.18)
    json.dump(data, open(path, 'w'))
    return data


def fetch_features(cells: List[Tuple[float, float]]) -> Dict[str, dict]:
    path = os.path.join(CACHE, 'features_v3.json')
    feat = json.load(open(path)) if os.path.exists(path) else {}

    miss = [c for c in cells if feat.get(cell_key(c), {}).get('elev') is None]
    for i in range(0, len(miss), 100):
        ch = miss[i:i + 100]
        try:
            d = http_json(
                f"https://api.open-meteo.com/v1/elevation?latitude={','.join(str(c[0]) for c in ch)}&longitude={','.join(str(c[1]) for c in ch)}"
            )
            ev = d.get('elevation', [])
        except Exception:
            ev = [None] * len(ch)
        for c, e in zip(ch, ev):
            feat.setdefault(cell_key(c), {})['elev'] = e
        time.sleep(0.25)

    def power_one(c: Tuple[float, float]):
        k = cell_key(c)
        try:
            p = http_json('https://power.larc.nasa.gov/api/temporal/climatology/point?' + urllib.parse.urlencode({
                'parameters': 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,GWETROOT,T2M_MAX,T2M_MIN',
                'community': 'AG',
                'longitude': c[1],
                'latitude': c[0],
                'format': 'JSON',
            }))['properties']['parameter']
            pr = [p['PRECTOTCORR'][m] for m in MON]
            mm = [x * 30 for x in pr]
            mean = sum(mm) / 12
            return k, {
                't2m': p['T2M']['ANN'],
                'prec': sum(mm),
                'drym': sum(1 for x in mm if x < 50),
                'pseas': (sum((x - mean) ** 2 for x in mm) / 12) ** 0.5 / (mean + 1) * 100,
                'trange': p['T2M_MAX']['ANN'] - p['T2M_MIN']['ANN'],
                'solar': p['ALLSKY_SFC_SW_DWN']['ANN'],
                'rh': p['RH2M']['ANN'],
                'gwet': p['GWETROOT']['ANN'],
            }
        except Exception:
            return k, {'t2m': None}

    todo = [c for c in cells if feat.get(cell_key(c), {}).get('t2m') is None]
    if todo:
        print(f'    POWER parallel workers={POWER_WORKERS} todo={len(todo)}')
    with concurrent.futures.ThreadPoolExecutor(max_workers=POWER_WORKERS) as ex:
        futs = [ex.submit(power_one, c) for c in todo]
        for n, fut in enumerate(concurrent.futures.as_completed(futs), 1):
            k, vals = fut.result()
            feat.setdefault(k, {}).update(vals)
            if n % 50 == 0 or n == len(todo):
                json.dump(feat, open(path, 'w'))
                print(f'    POWER {n}/{len(todo)}')
    json.dump(feat, open(path, 'w'))

    disaster = fetch_disaster(cells)
    for c in cells:
        feat.setdefault(cell_key(c), {}).update(disaster.get(cell_key(c), {}))
    json.dump(feat, open(path, 'w'))
    return feat


def soil_one(c: Tuple[float, float]):
    """
    Returns (cell_key, values_or_None, status) where status is:
      'ok'     -> real SoilGrids values
      'nodata' -> SoilGrids answered but has no soil here (ocean etc.) — cache it
      'error'  -> transport/timeout failure — must NOT be cached, retry next run

    Distinguishing 'nodata' from 'error' matters: the earlier version collapsed both
    into a cached None, so a single ISRIC timeout became a permanent hole in the
    training data. A spot-check retry of 40 such holes recovered 37, i.e. ~92% of
    them were transient failures, not ocean.
    """
    k = cell_key(c)
    q = [('lon', c[1]), ('lat', c[0]), ('value', 'mean')]
    for p in SOIL_PROPS:
        q.append(('property', p))
    for d in SOIL_DEPTHS:
        q.append(('depth', d))
    try:
        d = http_json(SOILGRIDS + '?' + urllib.parse.urlencode(q), tries=SOIL_TRIES, timeout=SOIL_TIMEOUT)
    except Exception:
        return k, None, 'error'
    out = {}
    for layer in (d.get('properties', {}) or {}).get('layers', []) or []:
        name = layer.get('name')
        conv = SOIL_CONV.get(name)
        if not conv:
            continue
        means = [dd.get('values', {}).get('mean') for dd in layer.get('depths', []) if dd.get('values', {}).get('mean') is not None]
        if means:
            out[name] = conv(sum(means) / len(means))
    if 'phh2o' not in out:
        return k, None, 'nodata'
    return k, {
        'soil_ph': out.get('phh2o'),
        'soil_clay': out.get('clay'),
        'soil_sand': out.get('sand'),
        'soil_oc': out.get('soc'),
        'soil_cec': out.get('cec'),
        **soil_indices(out.get('phh2o'), out.get('clay'), out.get('sand'), out.get('soc'), out.get('cec')),
    }, 'ok'


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def soil_indices(ph, clay, sand, oc, cec) -> dict:
    """
    Derived soil indices, computed the way INFERENCE computes them rather than with
    a tidier continuous formula.

    src/lib/soil.ts buckets sand/clay into a 3-level drainage class and pH into a
    4-level acidity class, and src/lib/suitability.ts then maps those classes onto
    fixed constants (0.82/0.55/0.25 and 0.88/0.74/0.48/0.22). An earlier continuous
    version of this function ((sand-clay+50)/100 etc.) produced values on a
    different scale from the ones the deployed model would actually be fed, i.e. a
    train/serve skew. Mirroring the buckets removes it.

    Caveat that still applies: for a plot in Nan, mergeLddSoil() OVERRIDES drainage
    and acidity with the LDD soil-group classes and blends fertility 0.55/0.45 with
    LDD's, so these three columns remain only partly reproducible at inference. That
    is one reason they are not in the v4 feature set by default.
    """
    if ph is None or clay is None or sand is None:
        return {name: None for name in SOIL_DERIVED}
    ph, clay, sand = float(ph), float(clay), float(sand)
    drain = 'poor' if clay >= 35 else 'good' if sand >= 65 else 'moderate' if clay >= 27 else 'good'
    acid = 'strong' if ph < 5.0 else 'moderate' if ph < 5.5 else 'slight' if ph < 6.6 else 'neutral'
    return {
        'soil_drainage_idx': {'good': 0.82, 'moderate': 0.55, 'poor': 0.25}[drain],
        'soil_acidity_idx': {'neutral': 0.88, 'slight': 0.74, 'moderate': 0.48, 'strong': 0.22}[acid],
        # src/lib/soil.ts fertilityScore()
        'soil_fertility_idx': clamp01(clamp01(float(oc or 0) / 3.0) * 0.45
                                      + clamp01(float(cec or 0) / 250.0) * 0.3
                                      + clamp01(1.0 - abs(ph - 6.3) / 2.0) * 0.25),
    }


def fetch_soil(cells: List[Tuple[float, float]]) -> Dict[str, dict]:
    path = os.path.join(CACHE, 'soil_v3.json')
    data = json.load(open(path)) if os.path.exists(path) else {}
    for vals in data.values():
        if vals and vals.get('soil_drainage_idx') is None:
            vals.update(soil_indices(vals.get('soil_ph'), vals.get('soil_clay'), vals.get('soil_sand'), vals.get('soil_oc'), vals.get('soil_cec')))
    def needs_fetch(c) -> bool:
        k = cell_key(c)
        if k not in data:
            return True
        v = data[k] or {}
        if v.get('soil_ph') is not None:
            return False
        # An all-None entry is either a real "SoilGrids has nothing here" (ocean) or
        # a transient failure that the pre-fix code froze in permanently. Only the
        # ones this code confirmed are trusted; legacy holes get one more chance.
        return not v.get('nodataConfirmed')

    todo = [c for c in cells if needs_fetch(c)]
    if todo:
        print(f'    SoilGrids soil todo={len(todo)} (cached={len(data)}) budget={SOIL_TIME_BUDGET_SEC:.0f}s workers={SOIL_WORKERS}')
    done = 0
    start = time.monotonic()
    timed_out = False
    with concurrent.futures.ThreadPoolExecutor(max_workers=SOIL_WORKERS) as ex:
        futs = {ex.submit(soil_one, c): c for c in todo}
        pending = set(futs)
        while pending:
            remaining_budget = SOIL_TIME_BUDGET_SEC - (time.monotonic() - start)
            if remaining_budget <= 0:
                timed_out = True
                break
            done_now, pending = concurrent.futures.wait(pending, timeout=remaining_budget, return_when=concurrent.futures.FIRST_COMPLETED)
            for fut in done_now:
                k, vals, status = fut.result()
                if status == 'ok':
                    data[k] = vals
                elif status == 'nodata':
                    data[k] = {name: None for name in SOIL_BASE} | {'nodataConfirmed': True}
                # status == 'error': leave the key absent so the next run retries it
                # instead of freezing a transient ISRIC timeout into a permanent hole.
                done += 1
                if done % 25 == 0 or done == len(todo):
                    json.dump(data, open(path, 'w'))
                    print(f'    SoilGrids {done}/{len(todo)} ({time.monotonic() - start:.0f}s elapsed)')
        if timed_out and pending:
            # Do NOT cache these as a permanent None — that would stop them from
            # ever being retried. Leave them absent from `data` so the next run's
            # `todo` picks them back up (median-imputed for *this* run only).
            print(f'    SoilGrids time budget hit — {len(pending)} cells left unfetched this run (will retry next run; median-imputed for now)')
            for fut in pending:
                fut.cancel()
    json.dump(data, open(path, 'w'))
    return data


def export_tree(tree) -> dict:
    t = tree.tree_
    return {
        'children_left': t.children_left.astype(int).tolist(),
        'children_right': t.children_right.astype(int).tolist(),
        'feature': t.feature.astype(int).tolist(),
        'threshold': [round(float(x), 6) for x in t.threshold.tolist()],
        'value': [round(float(v[0][0]), 6) for v in t.value.tolist()],
    }


def in_region(c: Tuple[float, float]) -> bool:
    return REGION[0] <= c[0] <= REGION[1] and REGION[2] <= c[1] <= REGION[3]


def match_region_negatives(rng, posset, pool, n_want):
    """
    Draw background cells whose in-region / out-of-region mix MATCHES the
    positives'.

    Why: GBIF presences for 9 of the 21 species are mostly outside the SE-Asia
    box (macadamia 98% outside, ginger 94%, avocado 92%), while every one of the
    900 random background cells is inside it. Sampling negatives uniformly
    therefore let a model score well by answering "is this cell outside the box?"
    instead of "does this crop like this environment?". ml/diagnose.py measures
    that shortcut directly: a predictor whose ONLY input is the in-region flag
    reaches mean AUC 0.740 on the old positives/negatives.

    Matching the mix makes the flag uninformative by construction, so the AUC that
    survives has to come from climate and soil. It is the standard fix for
    presence/background sampling-extent mismatch.
    """
    inp = [c for c in pool if c not in posset and in_region(c)]
    outp = [c for c in pool if c not in posset and not in_region(c)]
    p_in = sum(1 for c in posset if in_region(c)) / max(1, len(posset))
    n_in = min(len(inp), int(round(n_want * p_in)))
    n_out = min(len(outp), n_want - n_in)
    n_in = min(len(inp), max(n_in, n_want - n_out))
    return rng.sample(inp, n_in) + rng.sample(outp, n_out)


def main():
    import numpy as np
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import GroupKFold

    print('1) GBIF presence (all layers)...')
    pres = fetch_presence()
    cells = sorted({tuple(c) for cs in pres.values() for c in cs} | set(background_cells()))
    print(f'   {len(cells)} total unique cells with background')

    print('2) features: DEM + NASA POWER (+ GISTDA disaster, cached but NOT used in v4)...')
    feat = fetch_features(cells)

    if DISABLE_SOIL:
        print('2b) soil: skipped (SDM_DISABLE_SOIL=1, ablation run — no soil columns in BASE)')
    else:
        print('2b) soil: SoilGrids (ISRIC) for climate-present cells...')
        climate_cells = [c for c in cells if feat.get(cell_key(c), {}).get('t2m') is not None]
        soil = fetch_soil(climate_cells)
        for c in cells:
            vals = soil.get(cell_key(c)) or {}
            feat.setdefault(cell_key(c), {}).update({k: v for k, v in vals.items() if k in SOIL_BASE})
        json.dump(feat, open(os.path.join(CACHE, 'features_v3.json'), 'w'))

    def base_vec(cell):
        f = feat.get(cell_key(cell), {})
        if f.get('t2m') is None:
            return None
        return [f.get(n) for n in BASE]

    pool = [c for c in cells if base_vec(c) is not None]
    Xb = np.array([base_vec(c) for c in pool], float)
    imp = SimpleImputer(strategy='median')
    Xb = imp.fit_transform(Xb)
    medians = imp.statistics_

    soil_have = sum(1 for c in pool if feat.get(cell_key(c), {}).get('soil_ph') is not None)
    soil_have_reg = sum(1 for c in pool if in_region(c) and feat.get(cell_key(c), {}).get('soil_ph') is not None)
    n_reg = sum(1 for c in pool if in_region(c))
    print(f'   soil coverage: {soil_have}/{len(pool)} cells overall, '
          f'{soil_have_reg}/{n_reg} in-region ({100 * soil_have_reg / max(1, n_reg):.0f}%)')

    def expand(X):
        if not SQ:
            return X
        sq = np.column_stack([X[:, BASE.index(n)] ** 2 for n in SQ])
        return np.column_stack([X, sq])

    X_all = expand(Xb)
    mean, std = X_all.mean(0), X_all.std(0)
    std[std == 0] = 1
    idx = {tuple(c): i for i, c in enumerate(pool)}

    def make_logit():
        return LogisticRegression(max_iter=4000)

    def make_gbm():
        return GradientBoostingClassifier(n_estimators=90, max_depth=2, learning_rate=0.055,
                                          subsample=0.85, random_state=3)

    def blocks(cs):
        return np.array([int(math.floor(c[0] / BLOCK_DEG) * 1000 + math.floor(c[1] / BLOCK_DEG)) for c in cs])

    def nested_eval(X_raw, Xz, y, groups):
        """
        Spatial-block GroupKFold with the logit-vs-GBM choice made on an INNER
        blocked split of the training folds only.

        v3 reported max(logit_auc, gbm_auc) over the very folds it scored, which is
        an optimistically biased estimate of the deployed model: it credits the
        winner with the noise that made it win. Choosing inside the training fold
        keeps the outer fold untouched, so the number we ship is an estimate of the
        whole select-then-fit procedure rather than of its luckiest branch.
        """
        uniq = sorted(set(groups.tolist()))
        splits = min(5, len(uniq))
        if splits < 3:
            return None
        aucs, briers, picks = [], [], {'logit': 0, 'gbm': 0}
        for train, test in GroupKFold(n_splits=splits).split(X_raw, y, groups):
            if len(set(y[test].tolist())) < 2:
                continue
            g_tr = groups[train]
            inner = min(4, len(set(g_tr.tolist())))
            pick = 'logit'
            if inner >= 3:
                s_l, s_g = [], []
                for itr, ite in GroupKFold(n_splits=inner).split(X_raw[train], y[train], g_tr):
                    if len(set(y[train][ite].tolist())) < 2:
                        continue
                    try:
                        m = make_logit(); m.fit(Xz[train][itr], y[train][itr])
                        s_l.append(roc_auc_score(y[train][ite], m.predict_proba(Xz[train][ite])[:, 1]))
                    except Exception:
                        pass
                    try:
                        m = make_gbm(); m.fit(X_raw[train][itr], y[train][itr])
                        s_g.append(roc_auc_score(y[train][ite], m.predict_proba(X_raw[train][ite])[:, 1]))
                    except Exception:
                        pass
                if s_g and s_l and float(np.mean(s_g)) > float(np.mean(s_l)):
                    pick = 'gbm'
            picks[pick] += 1
            if pick == 'gbm':
                m = make_gbm(); m.fit(X_raw[train], y[train]); p = m.predict_proba(X_raw[test])[:, 1]
            else:
                m = make_logit(); m.fit(Xz[train], y[train]); p = m.predict_proba(Xz[test])[:, 1]
            aucs.append(roc_auc_score(y[test], p))
            briers.append(brier_score_loss(y[test], p))
        if not aucs:
            return None
        return {
            'auc': float(np.mean(aucs)),
            'aucSd': float(np.std(aucs)),
            'brier': float(np.mean(briers)),
            'folds': len(aucs),
            'picks': picks,
        }

    def plain_eval(estimator_factory, X, y, groups):
        splits = min(5, len(set(groups.tolist())))
        if splits < 3:
            return float('nan')
        out = []
        for train, test in GroupKFold(n_splits=splits).split(X, y, groups):
            if len(set(y[test].tolist())) < 2:
                continue
            m = estimator_factory(); m.fit(X[train], y[train])
            out.append(roc_auc_score(y[test], m.predict_proba(X[test])[:, 1]))
        return float(np.mean(out)) if out else float('nan')

    print(f'3) train v4 ({len(pool)} cells, {len(FEATURES)} features: {", ".join(FEATURES)})...')
    model = {
        'version': 4,
        # NOTE: kept comparable to v3 on purpose — same 2-degree spatial blocks and
        # the same GroupKFold estimator — so before/after AUCs measure the same
        # thing. What changed is that model selection is now nested and the
        # background is region-matched; both make the number lower and honest.
        'validation': 'spatial-block-2deg-group-kfold',
        'validationDetail': {
            'scheme': 'GroupKFold over 2-degree lat/lon blocks (<=5 folds)',
            'modelSelection': 'nested — logit vs GBM chosen on an inner blocked split of each training fold; the reported AUC never sees the choice',
            'background': 'target-group + random background, region-matched to each species presence extent',
            'negRatio': NEG_RATIO,
            'minPresences': MIN_POS,
            'aucIsBiasedOptimistic': False,
            'v3Caveats': [
                'v3 reported max(logit, gbm) over the same folds it scored (selection-biased upward)',
                'v3 background was 100% inside the SE-Asia box while most presences for 9 species were outside it, so AUC partly measured geography (region-only control AUC 0.740)',
                'v3 included 5 GISTDA disaster columns that are near-constant in training but carry real nonzero values at inference (train/serve skew)',
            ],
        },
        'scoreMeaning': (
            'Relative habitat suitability = P(presence | presence-or-background) at a 1:%d '
            'presence:background ratio. It is NOT a probability of a successful harvest and '
            'not calibrated to yield.' % NEG_RATIO
        ),
        'featureSources': {
            'climate': 'NASA POWER climatology + Open-Meteo elevation',
            'soilRaw': 'SoilGrids (ISRIC) topsoil 0-15 cm, same physical units as src/lib/soil.ts',
            'disaster': 'GISTDA disaster columns intentionally EXCLUDED in v4 (near-constant in training, train/serve skew at inference)',
        },
        'base': BASE,
        'sq': SQ,
        'features': FEATURES,
        'mean': mean.round(5).tolist(),
        'std': std.round(5).tolist(),
        'median': [round(float(m), 4) for m in medians],
        'species': {},
        # Species deliberately NOT modelled. src/lib/suitability.ts already falls
        # back to the elevation envelope with confidence 'expert' when a plant's
        # sdmId is absent from `species`; this block records WHY, so the absence is
        # auditable instead of looking like an oversight.
        'excludedSpecies': {},
    }

    rng = random.Random(9)
    for tid, cs in pres.items():
        pos = [tuple(c) for c in cs if tuple(c) in idx]
        pos_reg = sum(1 for c in pos if in_region(c))
        if len(pos) < MIN_POS:
            model['excludedSpecies'][tid] = {
                'reason': 'too-few-occurrences',
                'n': len(pos),
                'minRequired': MIN_POS,
                'detail': 'Not enough independent 0.25-degree GBIF cells to fit and spatially validate a model. Use expert judgement / the elevation envelope instead.',
            }
            print(f'  {tid:12s} {len(pos):3d} pts -> EXCLUDED (< {MIN_POS})')
            continue
        posset = set(pos)
        n_want = max(len(pos) * NEG_RATIO, NEG_FLOOR)
        neg = match_region_negatives(rng, posset, pool, n_want)
        rows = [idx[c] for c in pos] + [idx[c] for c in neg]
        cells_rows = [pool[r] for r in rows]
        X = X_all[rows]
        Xz = (X - mean) / std
        y = np.array([1] * len(pos) + [0] * len(neg))
        groups = blocks(cells_rows)

        ev = nested_eval(X, Xz, y, groups)
        if ev is None:
            model['excludedSpecies'][tid] = {
                'reason': 'not-spatially-validatable',
                'n': len(pos),
                'detail': 'Occurrences fall in fewer than 3 distinct 2-degree spatial blocks, so a blocked CV AUC cannot be estimated.',
            }
            print(f'  {tid:12s} {len(pos):3d} pts -> EXCLUDED (< 3 spatial blocks)')
            continue

        # Control: AUC obtainable from the in-region flag ALONE on this species'
        # own train set. Region-matched sampling should pin this near 0.5; if it
        # drifts up, the geographic shortcut has crept back in.
        flag = np.array([1.0 if in_region(c) else 0.0 for c in cells_rows])
        try:
            a_flag = roc_auc_score(y, flag)
            region_only = round(float(max(a_flag, 1 - a_flag)), 3)
        except Exception:
            region_only = None

        auc_logit = plain_eval(lambda: make_logit(), Xz, y, groups)
        auc_gbm = plain_eval(lambda: make_gbm(), X, y, groups)

        logit = make_logit(); logit.fit(Xz, y)
        gbm = make_gbm(); gbm.fit(X, y)
        init = float(gbm.init_.class_prior_[1])
        init_logit = math.log(init / max(1e-9, 1 - init))
        # Apply the SAME selection rule the nested estimate accounted for: the
        # branch the inner splits preferred most often.
        preferred = 'gbm' if ev['picks']['gbm'] > ev['picks']['logit'] else 'logit'

        model['species'][tid] = {
            'w': logit.coef_[0].round(4).tolist(),
            'b': round(float(logit.intercept_[0]), 4),
            # `auc` is the nested (unbiased) blocked-CV AUC of the deployed
            # select-then-fit procedure. src/lib/suitability.ts gates on it.
            'auc': round(float(ev['auc']), 3),
            'aucSd': round(float(ev['aucSd']), 3),
            'brier': round(float(ev['brier']), 4),
            'folds': ev['folds'],
            'aucLogitSpatial': round(float(auc_logit), 3) if auc_logit == auc_logit else None,
            'aucGBM': round(float(auc_gbm), 3) if auc_gbm == auc_gbm else None,
            'regionOnlyControlAuc': region_only,
            'preferred': preferred,
            'n': len(pos),
            'nInRegion': pos_reg,
            'nBackground': len(neg),
            'gbm': {
                'learningRate': round(float(gbm.learning_rate), 6),
                'init': round(init_logit, 6),
                'trees': [export_tree(est[0]) for est in gbm.estimators_],
            },
        }
        print(f'  {tid:12s} n={len(pos):3d} (in-region {pos_reg:3d}) nested AUC={ev["auc"]:.3f}'
              f' +-{ev["aucSd"]:.3f} brier={ev["brier"]:.3f} picks={ev["picks"]}'
              f' region-only-ctrl={region_only} pref={preferred}')

    aucs = [v['auc'] for v in model['species'].values()]
    model['summary'] = {
        'speciesModelled': len(model['species']),
        'speciesExcluded': len(model['excludedSpecies']),
        'meanAuc': round(float(sum(aucs) / len(aucs)), 4) if aucs else None,
        'minAuc': round(float(min(aucs)), 3) if aucs else None,
        'meanRegionOnlyControlAuc': round(float(sum(
            v['regionOnlyControlAuc'] for v in model['species'].values()
            if v['regionOnlyControlAuc'] is not None) / max(1, len(aucs))), 4) if aucs else None,
    }
    json.dump(model, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'\nExported {len(model["species"])} species (excluded {len(model["excludedSpecies"])}) -> {OUT}')
    print(f'  mean nested blocked AUC {model["summary"]["meanAuc"]}  min {model["summary"]["minAuc"]}'
          f'  mean region-only control {model["summary"]["meanRegionOnlyControlAuc"]}')


if __name__ == '__main__':
    main()
