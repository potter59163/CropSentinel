#!/usr/bin/env python3
"""
Offline SDM experiment harness.

Reads ONLY the cached feature/presence/background JSON under ml/cache (no network),
so a full experiment matrix runs in minutes and every config is scored on exactly
the same data. Used to decide what (if anything) actually improves the
spatial-block cross-validated AUC before touching src/data/sdm_model.json.

Everything here is evaluation-only; ml/build_model.py does the shipping export.
"""
import json, math, os, random
from dataclasses import dataclass, field, replace
from typing import Dict, List, Optional, Tuple

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, brier_score_loss
from sklearn.model_selection import GroupKFold

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')

REGION = (5.0, 28.0, 92.0, 112.0)

CLIMATE_BASE = ['t2m', 'prec', 'drym', 'pseas', 'trange', 'solar', 'rh', 'gwet', 'elev']
DISASTER_BASE = ['fire7d_near', 'burn_freq_near', 'flood7d_near', 'flood_freq_near', 'drought_layers']
SOIL_RAW = ['soil_ph', 'soil_clay', 'soil_sand', 'soil_oc', 'soil_cec']
SOIL_DERIVED = ['soil_drainage_idx', 'soil_acidity_idx', 'soil_fertility_idx']

# The feature set the currently-committed sdm_model.json (v3) was built with.
OLD_BASE = CLIMATE_BASE + DISASTER_BASE + SOIL_RAW
OLD_SQ = ['t2m', 'prec', 'elev', 'fire7d_near', 'flood_freq_near']


def in_region(c) -> bool:
    return REGION[0] <= c[0] <= REGION[1] and REGION[2] <= c[1] <= REGION[3]


def ck(c) -> str:
    return f'{c[0]},{c[1]}'


def clamp01(v):
    return max(0.0, min(1.0, v))


def soil_indices(ph, clay, sand, oc, cec):
    """Derived soil indices, computed to mirror src/lib/soil.ts + suitability.ts."""
    if ph is None or clay is None or sand is None:
        return {n: None for n in SOIL_DERIVED}
    drainage = clamp01((float(sand) - float(clay) + 50.0) / 100.0)
    acidity = clamp01(1.0 - abs(float(ph) - 6.3) / 2.2)
    fertility = clamp01((float(oc or 0) / 3.0) * 0.45 + (float(cec or 0) / 250.0) * 0.3 + acidity * 0.25)
    return {'soil_drainage_idx': drainage, 'soil_acidity_idx': acidity, 'soil_fertility_idx': fertility}


def soil_indices_runtime(ph, clay, sand, oc, cec):
    """
    Derived soil indices computed the way src/lib/suitability.ts ACTUALLY computes
    them at inference: soil.ts buckets sand/clay -> drainage class and pH -> acidity
    class, then suitability.ts maps those classes to fixed constants.
    Reproducing this at train time removes the train/serve skew that the continuous
    soil_indices() above would introduce.
    """
    if ph is None or clay is None or sand is None:
        return {n: None for n in SOIL_DERIVED}
    sand = float(sand); clay = float(clay); ph = float(ph)
    # src/lib/soil.ts classifyDrainage
    if clay >= 35:
        drain = 'poor'
    elif sand >= 65:
        drain = 'good'
    elif clay >= 27:
        drain = 'moderate'
    else:
        drain = 'good'
    # src/lib/soil.ts classifyAcidity
    if ph < 5.0:
        acid = 'strong'
    elif ph < 5.5:
        acid = 'moderate'
    elif ph < 6.6:
        acid = 'slight'
    else:
        acid = 'neutral'
    # src/lib/suitability.ts soilFeatureContext constants
    d_idx = {'good': 0.82, 'moderate': 0.55, 'poor': 0.25}[drain]
    a_idx = {'neutral': 0.88, 'slight': 0.74, 'moderate': 0.48, 'strong': 0.22}[acid]
    # src/lib/soil.ts fertilityScore (note /2 not /2.2 for the pH term)
    f_idx = clamp01(clamp01(float(oc or 0) / 3.0) * 0.45
                    + clamp01(float(cec or 0) / 250.0) * 0.3
                    + clamp01(1.0 - abs(ph - 6.3) / 2.0) * 0.25)
    return {'soil_drainage_idx': d_idx, 'soil_acidity_idx': a_idx, 'soil_fertility_idx': f_idx}


class Data:
    def __init__(self, derived='runtime'):
        self.pres: Dict[str, List[Tuple[float, float]]] = {
            k: [tuple(c) for c in v] for k, v in json.load(open(os.path.join(CACHE, 'presence_v3.json'))).items()
        }
        self.feat: Dict[str, dict] = json.load(open(os.path.join(CACHE, 'features_v3.json')))
        self.bg = [tuple(c) for c in json.load(open(os.path.join(CACHE, 'background_v3_900.json')))]
        # refresh soil cache (it may have been topped up since features_v3 was written)
        soil_path = os.path.join(CACHE, 'soil_v3.json')
        soil = json.load(open(soil_path)) if os.path.exists(soil_path) else {}
        idx_fn = soil_indices_runtime if derived == 'runtime' else soil_indices
        for k, v in soil.items():
            if not v:
                continue
            merged = dict(v)
            merged.update(idx_fn(v.get('soil_ph'), v.get('soil_clay'), v.get('soil_sand'),
                                 v.get('soil_oc'), v.get('soil_cec')))
            self.feat.setdefault(k, {}).update(merged)
        cells = sorted({c for cs in self.pres.values() for c in cs} | set(self.bg))
        self.cells = [c for c in cells if self.feat.get(ck(c), {}).get('t2m') is not None]
        self.pos_index = {name: set(cs) for name, cs in self.pres.items()}

    def matrix(self, base: List[str], sq: List[str]):
        Xb = np.array([[self.feat.get(ck(c), {}).get(n) for n in base] for c in self.cells], dtype=float)
        imp = SimpleImputer(strategy='median')
        Xb = imp.fit_transform(Xb)
        cols = [Xb[:, base.index(n)] ** 2 for n in sq]
        X = np.column_stack([Xb] + cols) if cols else Xb
        return X, imp.statistics_


@dataclass
class Cfg:
    name: str
    base: List[str] = field(default_factory=lambda: list(OLD_BASE))
    sq: List[str] = field(default_factory=lambda: list(OLD_SQ))
    neg_mode: str = 'orig'          # 'orig' | 'region_matched'
    neg_ratio: int = 2
    neg_floor: int = 180
    model: str = 'best_peek'        # 'logit' | 'gbm' | 'best_peek' | 'nested'
    test_scope: str = 'all'         # 'all' | 'region'
    block_deg: float = 2.0
    C: float = 1.0
    class_weight: Optional[str] = None
    gbm_kw: dict = field(default_factory=lambda: dict(n_estimators=90, max_depth=2, learning_rate=0.055,
                                                      subsample=0.85, random_state=3))
    min_pos: int = 18
    seed: int = 9


def make_logit(cfg: Cfg):
    return LogisticRegression(max_iter=4000, C=cfg.C, class_weight=cfg.class_weight)


def make_gbm(cfg: Cfg):
    return GradientBoostingClassifier(**cfg.gbm_kw)


def blocks(cells, deg):
    return np.array([int(math.floor(c[0] / deg) * 1000 + math.floor(c[1] / deg)) for c in cells])


def thailandish(c) -> bool:
    """The box fetch_disaster() actually queried GISTDA inside."""
    return 5.0 <= c[0] <= 21.5 and 97.0 <= c[1] <= 106.5


def geo_stratum(c) -> int:
    """0 = inside the GISTDA/Thailand box, 1 = in-region but outside it, 2 = out of region."""
    if not in_region(c):
        return 2
    return 0 if thailandish(c) else 1


def sample_negatives(rng, pos: set, all_cells: List[Tuple[float, float]], cfg: Cfg):
    n_want = max(len(pos) * cfg.neg_ratio, cfg.neg_floor)
    pool = [c for c in all_cells if c not in pos]
    if cfg.neg_mode == 'orig':
        return rng.sample(pool, min(len(pool), n_want))
    if cfg.neg_mode == 'geo_matched':
        # Stricter than region_matched: also matches the Thailand sub-box, because
        # drought_layers is 3 exactly inside it and 0 outside, so region_matched
        # alone still leaves "is this cell in Thailand" as a usable shortcut.
        buckets = {s: [c for c in pool if geo_stratum(c) == s] for s in (0, 1, 2)}
        want = {}
        for s in (0, 1, 2):
            share = sum(1 for c in pos if geo_stratum(c) == s) / max(1, len(pos))
            want[s] = int(round(n_want * share))
        out = []
        deficit = 0
        for s in (0, 1, 2):
            take = min(len(buckets[s]), want[s])
            deficit += want[s] - take
            out += rng.sample(buckets[s], take)
        # spread any shortfall over the strata that still have spare cells
        for s in (0, 1, 2):
            if deficit <= 0:
                break
            spare = [c for c in buckets[s] if c not in set(out)]
            take = min(len(spare), deficit)
            out += rng.sample(spare, take)
            deficit -= take
        return out
    # region_matched: make the in-region / out-of-region mix of the negatives match
    # the positives', so "which continent is this cell on" carries no information.
    p_in = sum(1 for c in pos if in_region(c)) / max(1, len(pos))
    inp = [c for c in pool if in_region(c)]
    outp = [c for c in pool if not in_region(c)]
    n_in = min(len(inp), int(round(n_want * p_in)))
    n_out = min(len(outp), n_want - n_in)
    # if one side is short, top up from the other so total stays near n_want
    if n_in < int(round(n_want * p_in)):
        n_out = min(len(outp), n_want - n_in)
    if n_out < n_want - n_in:
        n_in = min(len(inp), n_want - n_out)
    return rng.sample(inp, n_in) + rng.sample(outp, n_out)


def fold_auc(est_factory, X, y, groups, cells, cfg: Cfg):
    """Spatial-block GroupKFold AUC. Returns (mean_auc, mean_brier, n_folds)."""
    uniq = len(set(groups.tolist()))
    splits = min(5, uniq)
    if splits < 3:
        return float('nan'), float('nan'), 0
    aucs, briers = [], []
    for train, test in GroupKFold(n_splits=splits).split(X, y, groups):
        if cfg.test_scope == 'region':
            test = np.array([i for i in test if in_region(cells[i])], dtype=int)
        if len(test) == 0 or len(set(y[test].tolist())) < 2:
            continue
        est = est_factory()
        est.fit(X[train], y[train])
        p = est.predict_proba(X[test])[:, 1]
        aucs.append(roc_auc_score(y[test], p))
        briers.append(brier_score_loss(y[test], p))
    if not aucs:
        return float('nan'), float('nan'), 0
    return float(np.mean(aucs)), float(np.mean(briers)), len(aucs)


def nested_auc(X_raw, Xz, y, groups, cells, cfg: Cfg):
    """
    Honest model selection: pick logit-vs-gbm on an INNER blocked split of the
    training fold only, then score the winner on the untouched outer test fold.
    This is what the current build_model.py does NOT do -- it takes
    max(logit_auc, gbm_auc) over the same folds it reports, which is optimistic.
    """
    uniq = len(set(groups.tolist()))
    splits = min(5, uniq)
    if splits < 3:
        return float('nan'), float('nan'), 0, {}
    aucs, briers, picks = [], [], {'logit': 0, 'gbm': 0}
    for train, test in GroupKFold(n_splits=splits).split(X_raw, y, groups):
        if cfg.test_scope == 'region':
            test = np.array([i for i in test if in_region(cells[i])], dtype=int)
        if len(test) == 0 or len(set(y[test].tolist())) < 2:
            continue
        g_tr = groups[train]
        inner_splits = min(4, len(set(g_tr.tolist())))
        pick = 'logit'
        if inner_splits >= 3:
            s_l, s_g = [], []
            for itr, ite in GroupKFold(n_splits=inner_splits).split(X_raw[train], y[train], g_tr):
                if len(set(y[train][ite].tolist())) < 2:
                    continue
                try:
                    m = make_logit(cfg); m.fit(Xz[train][itr], y[train][itr])
                    s_l.append(roc_auc_score(y[train][ite], m.predict_proba(Xz[train][ite])[:, 1]))
                except Exception:
                    pass
                try:
                    m = make_gbm(cfg); m.fit(X_raw[train][itr], y[train][itr])
                    s_g.append(roc_auc_score(y[train][ite], m.predict_proba(X_raw[train][ite])[:, 1]))
                except Exception:
                    pass
            if s_g and s_l and np.mean(s_g) > np.mean(s_l):
                pick = 'gbm'
        picks[pick] += 1
        if pick == 'gbm':
            m = make_gbm(cfg); m.fit(X_raw[train], y[train]); p = m.predict_proba(X_raw[test])[:, 1]
        else:
            m = make_logit(cfg); m.fit(Xz[train], y[train]); p = m.predict_proba(Xz[test])[:, 1]
        aucs.append(roc_auc_score(y[test], p))
        briers.append(brier_score_loss(y[test], p))
    if not aucs:
        return float('nan'), float('nan'), 0, picks
    return float(np.mean(aucs)), float(np.mean(briers)), len(aucs), picks


def run(data: Data, cfg: Cfg, verbose=True):
    X_all, medians = data.matrix(cfg.base, cfg.sq)
    mean, std = X_all.mean(0), X_all.std(0)
    std = np.where(std == 0, 1.0, std)
    idx = {c: i for i, c in enumerate(data.cells)}
    rng = random.Random(cfg.seed)
    out = {}
    for name, cs in data.pres.items():
        pos = [c for c in cs if c in idx]
        if len(pos) < cfg.min_pos:
            out[name] = {'n': len(pos), 'skipped': True}
            continue
        posset = set(pos)
        neg = sample_negatives(rng, posset, data.cells, cfg)
        rows = [idx[c] for c in pos] + [idx[c] for c in neg]
        cells = [data.cells[r] for r in rows]
        X_raw = X_all[rows]
        Xz = (X_raw - mean) / std
        y = np.array([1] * len(pos) + [0] * len(neg))
        g = blocks(cells, cfg.block_deg)

        rec = {'n': len(pos), 'nneg': len(neg), 'skipped': False,
               'pos_in_region': sum(1 for c in pos if in_region(c))}
        if cfg.model == 'nested':
            a, b, k, picks = nested_auc(X_raw, Xz, y, g, cells, cfg)
            rec.update(auc=a, brier=b, folds=k, picks=picks)
        elif cfg.model == 'logit':
            a, b, k = fold_auc(lambda: make_logit(cfg), Xz, y, g, cells, cfg)
            rec.update(auc=a, brier=b, folds=k)
        elif cfg.model == 'gbm':
            a, b, k = fold_auc(lambda: make_gbm(cfg), X_raw, y, g, cells, cfg)
            rec.update(auc=a, brier=b, folds=k)
        else:  # best_peek -- replicates current build_model.py behaviour
            al, bl, kl = fold_auc(lambda: make_logit(cfg), Xz, y, g, cells, cfg)
            ag, bg, kg = fold_auc(lambda: make_gbm(cfg), X_raw, y, g, cells, cfg)
            use_gbm = ag == ag and (al != al or ag >= al)
            rec.update(auc=ag if use_gbm else al, brier=bg if use_gbm else bl,
                       folds=kg if use_gbm else kl, aucLogit=al, aucGBM=ag,
                       preferred='gbm' if use_gbm else 'logit')
        out[name] = rec
    ok = [v for v in out.values() if not v['skipped'] and v['auc'] == v['auc']]
    summary = {
        'cfg': cfg.name,
        'species': len(ok),
        'meanAuc': float(np.mean([v['auc'] for v in ok])) if ok else float('nan'),
        'minAuc': float(np.min([v['auc'] for v in ok])) if ok else float('nan'),
        'meanBrier': float(np.mean([v['brier'] for v in ok if v['brier'] == v['brier']])) if ok else float('nan'),
    }
    if verbose:
        print(f"\n=== {cfg.name} ===")
        for name, v in sorted(out.items()):
            if v['skipped']:
                print(f"  {name:12s} n={v['n']:3d}  SKIPPED (< {cfg.min_pos} presences)")
            else:
                extra = ''
                if 'preferred' in v:
                    extra = f" logit={v['aucLogit']:.3f} gbm={v['aucGBM']:.3f} pref={v['preferred']}"
                if 'picks' in v:
                    extra = f" picks={v['picks']}"
                print(f"  {name:12s} n={v['n']:3d} (in-region {v['pos_in_region']:3d}) neg={v['nneg']:4d} "
                      f"AUC={v['auc']:.3f} brier={v['brier']:.3f} folds={v['folds']}{extra}")
        print(f"  -> {summary['species']} species, mean AUC {summary['meanAuc']:.4f}, "
              f"min {summary['minAuc']:.3f}, mean Brier {summary['meanBrier']:.4f}")
    return summary, out
