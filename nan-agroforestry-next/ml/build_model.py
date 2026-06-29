#!/usr/bin/env python3
"""
Species Distribution Model (SDM) v3.

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
OUT = os.path.join(HERE, '..', 'src', 'data', 'sdm_model.json')

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
PRES_CAP = int(os.getenv('SDM_PRES_CAP', '450'))
BACKGROUND_CAP = int(os.getenv('SDM_BACKGROUND_CAP', '900'))
POWER_WORKERS = int(os.getenv('SDM_POWER_WORKERS', '10'))
GISTDA_CELL_CAP = int(os.getenv('SDM_GISTDA_CELL_CAP', '140'))
MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

CLIMATE_BASE = ['t2m', 'prec', 'drym', 'pseas', 'trange', 'solar', 'rh', 'gwet', 'elev']
DISASTER_BASE = ['fire7d_near', 'burn_freq_near', 'flood7d_near', 'flood_freq_near', 'drought_layers']
# Real soil from SoilGrids (ISRIC), same physical units as runtime src/lib/soil.ts
SOIL_BASE = ['soil_ph', 'soil_clay', 'soil_sand', 'soil_oc', 'soil_cec']
BASE = CLIMATE_BASE + DISASTER_BASE + SOIL_BASE
SQ = ['t2m', 'prec', 'elev', 'fire7d_near', 'flood_freq_near']
FEATURES = BASE + [f'{n}_sq' for n in SQ]

SOILGRIDS = 'https://rest.isric.org/soilgrids/v2.0/properties/query'
SOIL_PROPS = ['phh2o', 'soc', 'clay', 'sand', 'cec']
SOIL_DEPTHS = ['0-5cm', '5-15cm']
SOIL_CONV = {'phh2o': lambda v: v / 10, 'soc': lambda v: v / 100, 'clay': lambda v: v / 10, 'sand': lambda v: v / 10, 'cec': lambda v: v}


def http_json(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=45, context=SSL) as r:
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
    if os.path.exists(path):
        cached = json.load(open(path))
        return {k: v[:PRES_CAP] for k, v in cached.items()}
    out = {}
    for tid, sci in SPECIES.items():
        key = taxon_key(sci)
        cells = set()

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
    k = cell_key(c)
    q = [('lon', c[1]), ('lat', c[0]), ('value', 'mean')]
    for p in SOIL_PROPS:
        q.append(('property', p))
    for d in SOIL_DEPTHS:
        q.append(('depth', d))
    try:
        d = http_json(SOILGRIDS + '?' + urllib.parse.urlencode(q), tries=3)
    except Exception:
        return k, None
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
        return k, None
    return k, {
        'soil_ph': out.get('phh2o'),
        'soil_clay': out.get('clay'),
        'soil_sand': out.get('sand'),
        'soil_oc': out.get('soc'),
        'soil_cec': out.get('cec'),
    }


def fetch_soil(cells: List[Tuple[float, float]]) -> Dict[str, dict]:
    path = os.path.join(CACHE, 'soil_v3.json')
    data = json.load(open(path)) if os.path.exists(path) else {}
    todo = [c for c in cells if cell_key(c) not in data]
    if todo:
        print(f'    SoilGrids soil todo={len(todo)} (cached={len(data)})')
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(soil_one, c) for c in todo]
        for fut in concurrent.futures.as_completed(futs):
            k, vals = fut.result()
            data[k] = vals or {name: None for name in SOIL_BASE}
            done += 1
            if done % 25 == 0 or done == len(todo):
                json.dump(data, open(path, 'w'))
                print(f'    SoilGrids {done}/{len(todo)}')
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


def main():
    import numpy as np
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import GroupKFold, StratifiedKFold, cross_val_score

    print('1) GBIF presence (all layers)...')
    pres = fetch_presence()
    cells = sorted({tuple(c) for cs in pres.values() for c in cs} | set(background_cells()))
    print(f'   {len(cells)} total unique cells with background')

    print('2) features: DEM + NASA POWER + GISTDA Disaster...')
    feat = fetch_features(cells)

    print('2b) soil: SoilGrids (ISRIC) for climate-present cells...')
    climate_cells = [c for c in cells if feat.get(cell_key(c), {}).get('t2m') is not None]
    soil = fetch_soil(climate_cells)
    for c in cells:
        feat.setdefault(cell_key(c), {}).update(soil.get(cell_key(c), {}))
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

    def expand(X):
        sq = np.column_stack([X[:, BASE.index(n)] ** 2 for n in SQ])
        return np.column_stack([X, sq])

    X_all = expand(Xb)
    mean, std = X_all.mean(0), X_all.std(0)
    std[std == 0] = 1
    idx = {tuple(c): i for i, c in enumerate(pool)}

    def spatial_groups(rows):
        out = []
        for r in rows:
            la, lo = pool[r]
            out.append(int(math.floor(la / 2) * 1000 + math.floor(lo / 2)))
        return np.array(out)

    print(f'3) train v3 ({len(pool)} cells, {len(FEATURES)} features)...')
    model = {
        'version': 3,
        'validation': 'spatial-block-2deg-group-kfold',
        'base': BASE,
        'sq': SQ,
        'features': FEATURES,
        'mean': mean.round(5).tolist(),
        'std': std.round(5).tolist(),
        'median': [round(float(m), 4) for m in medians],
        'species': {},
    }

    for tid, cs in pres.items():
        pos = [tuple(c) for c in cs if tuple(c) in idx]
        if len(pos) < 18:
            print(f'  {tid:12s} {len(pos)} pts -> skip')
            continue
        posset = set(pos)
        neg_pool = [c for c in pool if c not in posset]
        neg = random.sample(neg_pool, min(len(neg_pool), max(len(pos) * 2, 180)))
        rows = [idx[c] for c in pos] + [idx[c] for c in neg]
        X = X_all[rows]
        Xz = (X - mean) / std
        y = np.array([1] * len(pos) + [0] * len(neg))
        groups = spatial_groups(rows)

        logit = LogisticRegression(max_iter=4000)
        gbm = GradientBoostingClassifier(n_estimators=90, max_depth=2, learning_rate=0.055, subsample=0.85, random_state=3)
        cv = StratifiedKFold(5, shuffle=True, random_state=2)

        try:
            auc_random = float(cross_val_score(logit, Xz, y, cv=cv, scoring='roc_auc').mean())
        except Exception:
            auc_random = float('nan')

        def group_auc(estimator, Xmat):
            scores = []
            splits = min(5, len(set(groups)))
            if splits < 3:
                return float('nan')
            for train, test in GroupKFold(n_splits=splits).split(Xmat, y, groups):
                if len(set(y[test])) < 2:
                    continue
                est = estimator.__class__(**estimator.get_params())
                est.fit(Xmat[train], y[train])
                scores.append(roc_auc_score(y[test], est.predict_proba(Xmat[test])[:, 1]))
            return float(np.mean(scores)) if scores else float('nan')

        try:
            auc_spatial = group_auc(logit, Xz)
        except Exception:
            auc_spatial = float('nan')
        try:
            auc_gbm_spatial = group_auc(gbm, X)
        except Exception:
            auc_gbm_spatial = float('nan')
        try:
            auc_gbm_random = float(cross_val_score(gbm, X, y, cv=cv, scoring='roc_auc').mean())
        except Exception:
            auc_gbm_random = float('nan')

        logit.fit(Xz, y)
        gbm.fit(X, y)
        init = float(gbm.init_.class_prior_[1])
        init_logit = math.log(init / max(1e-9, 1 - init))

        use_auc = auc_gbm_spatial if auc_gbm_spatial == auc_gbm_spatial and auc_gbm_spatial >= auc_spatial else auc_spatial
        preferred = 'gbm' if auc_gbm_spatial == auc_gbm_spatial and auc_gbm_spatial >= auc_spatial else 'logit'
        model['species'][tid] = {
            'w': logit.coef_[0].round(4).tolist(),
            'b': round(float(logit.intercept_[0]), 4),
            'auc': round(float(use_auc), 3) if use_auc == use_auc else round(float(auc_random), 3),
            'aucLogitSpatial': round(float(auc_spatial), 3) if auc_spatial == auc_spatial else None,
            'aucLogitRandom': round(float(auc_random), 3) if auc_random == auc_random else None,
            'aucGBM': round(float(auc_gbm_spatial), 3) if auc_gbm_spatial == auc_gbm_spatial else None,
            'aucGBMRandom': round(float(auc_gbm_random), 3) if auc_gbm_random == auc_gbm_random else None,
            'preferred': preferred,
            'n': len(pos),
            'gbm': {
                'learningRate': round(float(gbm.learning_rate), 6),
                'init': round(init_logit, 6),
                'trees': [export_tree(est[0]) for est in gbm.estimators_],
            },
        }
        print(f'  {tid:12s} n={len(pos):3d} AUC spatial logit={auc_spatial:.3f} gbm={auc_gbm_spatial:.3f} preferred={preferred}')

    json.dump(model, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'\nExported {len(model["species"])} species -> {OUT}')


if __name__ == '__main__':
    main()
