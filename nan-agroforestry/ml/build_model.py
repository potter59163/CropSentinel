#!/usr/bin/env python3
"""
Species Distribution Model (SDM) v2 — all real data, richer features.

Real sources (free, no key):
  • GBIF            — real occurrence coordinates (presence) via taxonKey match.
  • NASA POWER      — monthly climatology → annual + bioclim-style features.
  • SoilGrids/ISRIC — real soil (pH, organic C, clay, sand) per point.
  • Open-Meteo      — elevation (DEM).

Model: logistic regression on 13 base features + 4 quadratic terms (captures
climatic optima — a species prefers a RANGE, not a monotonic trend). Interpretable,
tiny JSON, trivial in-browser inference. A Gradient-Boosting CV-AUC is reported
as a benchmark. 5-fold cross-validated ROC-AUC reported per species.

Exports ../src/data/sdm_model.json  (features spec + per-species weights).
"""
import json, os, time, random, ssl, urllib.parse, urllib.request
import certifi

random.seed(7)
SSL = ssl.create_default_context(cafile=certifi.where())
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache'); os.makedirs(CACHE, exist_ok=True)
OUT = os.path.join(HERE, '..', 'src', 'data', 'sdm_model.json')

SPECIES = {
    'coffee': 'Coffea arabica', 'macadamia': 'Macadamia integrifolia', 'avocado': 'Persea americana',
    'cashew': 'Anacardium occidentale', 'longan': 'Dimocarpus longan', 'mango': 'Mangifera indica',
    'maikhwaen': 'Zanthoxylum rhetsa', 'banana': 'Musa acuminata', 'bamboo': 'Bambusa', 'teak': 'Tectona grandis',
}
REGION = (5.0, 28.0, 92.0, 112.0)   # lat0,lat1,lon0,lon1 (SE Asia)
GRID, PRES_CAP = 0.25, 150
MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
# soil (SoilGrids) dropped: it is CORS-blocked in the browser, so it cannot be
# provided at inference time — training on it would inflate AUC vs deployment.
# Features here are all available at BOTH train and runtime (NASA POWER + DEM).
BASE = ['t2m', 'prec', 'drym', 'pseas', 'trange', 'solar', 'rh', 'gwet', 'elev']
SQ = ['t2m', 'prec', 'elev']   # quadratic terms (capture climatic optima)
FEATURES = BASE + [f'{n}_sq' for n in SQ]


def http(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=45, context=SSL) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1: raise
            time.sleep(1.0 * (i + 1))


def snap(v): return round(round(v / GRID) * GRID, 3)


def taxon_key(sci):
    d = http('https://api.gbif.org/v1/species/match?name=' + urllib.parse.quote(sci))
    return d.get('usageKey')


def fetch_presence():
    path = os.path.join(CACHE, 'presence_v2.json')
    if os.path.exists(path): return json.load(open(path))
    out = {}
    for tid, sci in SPECIES.items():
        key = taxon_key(sci)
        cells = set()
        def pull(bbox):
            off = 0
            while len(cells) < PRES_CAP and off < 900:
                q = {'hasCoordinate': 'true', 'limit': 300, 'offset': off}
                if key: q['taxonKey'] = key
                else: q['scientificName'] = sci
                if bbox:
                    q['decimalLatitude'] = f'{REGION[0]},{REGION[1]}'
                    q['decimalLongitude'] = f'{REGION[2]},{REGION[3]}'
                d = http('https://api.gbif.org/v1/occurrence/search?' + urllib.parse.urlencode(q))
                res = d.get('results', [])
                if not res: break
                for r in res:
                    la, lo = r.get('decimalLatitude'), r.get('decimalLongitude')
                    if la is not None and lo is not None: cells.add((snap(la), snap(lo)))
                off += 300
                if d.get('endOfRecords'): break
        pull(True)
        if len(cells) < 40: pull(False)   # global fallback for rare species → climate envelope
        out[tid] = [list(c) for c in list(cells)[:PRES_CAP]]
        print(f'  GBIF {tid:10s} key={key} -> {len(out[tid])} cells')
        time.sleep(0.4)
    json.dump(out, open(path, 'w')); return out


def fetch_features(cells):
    path = os.path.join(CACHE, 'features_v2.json')
    feat = json.load(open(path)) if os.path.exists(path) else {}

    # elevation (batched)
    miss = [c for c in cells if feat.get(f'{c[0]},{c[1]}', {}).get('elev') is None]
    for i in range(0, len(miss), 100):
        ch = miss[i:i + 100]
        try:
            d = http(f"https://api.open-meteo.com/v1/elevation?latitude={','.join(str(c[0]) for c in ch)}&longitude={','.join(str(c[1]) for c in ch)}")
            ev = d.get('elevation', [])
        except Exception: ev = [None] * len(ch)
        for c, e in zip(ch, ev): feat.setdefault(f'{c[0]},{c[1]}', {})['elev'] = e
        time.sleep(0.3)

    # NASA POWER monthly climatology -> bioclim features
    todo = [c for c in cells if 't2m' not in feat.get(f'{c[0]},{c[1]}', {})]
    for n, c in enumerate(todo):
        k = f'{c[0]},{c[1]}'
        try:
            p = http('https://power.larc.nasa.gov/api/temporal/climatology/point?' + urllib.parse.urlencode({
                'parameters': 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,GWETROOT,T2M_MAX,T2M_MIN',
                'community': 'AG', 'longitude': c[1], 'latitude': c[0], 'format': 'JSON'}))['properties']['parameter']
            pr = [p['PRECTOTCORR'][m] for m in MON]            # mm/day per month
            mm = [x * 30 for x in pr]                            # mm/month
            mean = sum(mm) / 12
            feat[k]['t2m'] = p['T2M']['ANN']
            feat[k]['prec'] = sum(mm)                            # mm/yr
            feat[k]['drym'] = sum(1 for x in mm if x < 50)
            feat[k]['pseas'] = (sum((x - mean) ** 2 for x in mm) / 12) ** 0.5 / (mean + 1) * 100
            feat[k]['trange'] = p['T2M_MAX']['ANN'] - p['T2M_MIN']['ANN']
            feat[k]['solar'] = p['ALLSKY_SFC_SW_DWN']['ANN']
            feat[k]['rh'] = p['RH2M']['ANN']
            feat[k]['gwet'] = p['GWETROOT']['ANN']
        except Exception: feat[k]['t2m'] = None
        if n % 25 == 0: json.dump(feat, open(path, 'w')); print(f'    POWER {n}/{len(todo)}')
        time.sleep(0.22)
    json.dump(feat, open(path, 'w'))

    return feat  # soil dropped (see BASE note)


def main():
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    from sklearn.impute import SimpleImputer

    print('1) GBIF presence (taxonKey)...'); pres = fetch_presence()
    cells = sorted({tuple(c) for cs in pres.values() for c in cs})
    print(f'   {len(cells)} unique grid cells')
    print('2) features: elevation + NASA POWER monthly + SoilGrids...'); feat = fetch_features(cells)

    def base_vec(cell):
        f = feat.get(f'{cell[0]},{cell[1]}', {})
        if f.get('t2m') is None: return None
        return [f.get(n) for n in BASE]

    pool = [c for c in cells if base_vec(c) is not None]
    Xb = np.array([base_vec(c) for c in pool], float)
    # impute any missing (e.g. SoilGrids gaps) with column median, keep medians for runtime
    imp = SimpleImputer(strategy='median'); Xb = imp.fit_transform(Xb)
    medians = imp.statistics_

    def expand(Xb):
        sq = np.column_stack([Xb[:, BASE.index(n)] ** 2 for n in SQ])
        return np.column_stack([Xb, sq])
    X_all = expand(Xb)
    mean, std = X_all.mean(0), X_all.std(0); std[std == 0] = 1
    idx = {tuple(c): i for i, c in enumerate(pool)}

    print(f'3) train ({len(pool)} cells, {len(FEATURES)} features)...')
    model = {'base': BASE, 'sq': SQ, 'features': FEATURES, 'mean': mean.round(5).tolist(),
             'std': std.round(5).tolist(), 'median': [round(float(m), 4) for m in medians], 'species': {}}
    for tid, cs in pres.items():
        pos = [tuple(c) for c in cs if tuple(c) in idx]
        if len(pos) < 12:
            print(f'  {tid:10s} {len(pos)} pts -> skip (envelope)'); continue
        posset = set(pos)
        neg = random.sample([c for c in pool if c not in posset], min(len(pool) - len(pos), max(len(pos) * 2, 80)))
        rows = [idx[c] for c in pos] + [idx[c] for c in neg]
        X = X_all[rows]; Xz = (X - mean) / std
        y = np.array([1] * len(pos) + [0] * len(neg))
        cv = StratifiedKFold(5, shuffle=True, random_state=1)
        try: auc = float(cross_val_score(LogisticRegression(max_iter=3000), Xz, y, cv=cv, scoring='roc_auc').mean())
        except Exception: auc = float('nan')
        try: aucg = float(cross_val_score(HistGradientBoostingClassifier(max_iter=200), X, y, cv=cv, scoring='roc_auc').mean())
        except Exception: aucg = float('nan')
        clf = LogisticRegression(max_iter=3000).fit(Xz, y)
        model['species'][tid] = {'w': clf.coef_[0].round(4).tolist(), 'b': round(float(clf.intercept_[0]), 4),
                                 'auc': round(auc, 3), 'aucGBM': round(aucg, 3), 'n': len(pos)}
        print(f'  {tid:10s} n={len(pos):3d}  AUC(logit)={auc:.3f}  AUC(GBM)={aucg:.3f}')

    json.dump(model, open(OUT, 'w'), ensure_ascii=False, indent=2)
    print(f'\nExported {len(model["species"])} species -> {OUT}')


if __name__ == '__main__':
    main()
