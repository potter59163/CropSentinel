#!/usr/bin/env python3
"""
Re-fetch the SoilGrids cells that ml/build_model.py's fetch_soil() cached as a
permanent None.

Why this exists: fetch_soil() did `data[k] = vals or {name: None ...}`, which stores
a *transport failure* with the same sentinel as a genuine "SoilGrids has no data
here" (ocean). Because the key is then present in the cache, `todo` never picks it
back up, so a one-off ISRIC timeout became a permanent hole. A spot check retried
40 in-region land cells and 37 came back with real data, i.e. the holes were
overwhelmingly failures, not ocean.

Writes ml/cache/soil_topup.json (merged into soil_v3.json by merge_soil.py) so it
can run concurrently with an experiment process that already loaded soil_v3.json.

Land cells are prioritised (Open-Meteo elevation > 0) and in-region first.
"""
import concurrent.futures, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_model import soil_one
from experiments import in_region

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
OUT = os.path.join(CACHE, 'soil_topup.json')
WORKERS = int(os.getenv('TOPUP_WORKERS', '12'))
BUDGET = float(os.getenv('TOPUP_BUDGET', '3300'))

feat = json.load(open(os.path.join(CACHE, 'features_v3.json')))
soil = json.load(open(os.path.join(CACHE, 'soil_v3.json')))
done = json.load(open(OUT)) if os.path.exists(OUT) else {}

holes = [k for k, v in soil.items() if (not v or v.get('soil_ph') is None) and k not in done]
land = [k for k in holes if (feat.get(k, {}).get('elev') or 0) > 0]
land.sort(key=lambda k: 0 if in_region(tuple(float(x) for x in k.split(','))) else 1)
print(f'holes={len(holes)} likely-land={len(land)} workers={WORKERS} budget={BUDGET:.0f}s', flush=True)


def go(k):
    la, lo = (float(x) for x in k.split(','))
    return soil_one((la, lo))


t0 = time.time()
hit = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
    futs = {ex.submit(go, k): k for k in land}
    pending = set(futs)
    n = 0
    while pending:
        left = BUDGET - (time.time() - t0)
        if left <= 0:
            print('budget hit; cancelling remainder', flush=True)
            for f in pending:
                f.cancel()
            break
        got, pending = concurrent.futures.wait(pending, timeout=left,
                                               return_when=concurrent.futures.FIRST_COMPLETED)
        for f in got:
            try:
                k, v = f.result()
            except Exception:
                continue
            n += 1
            if v:
                done[k] = v
                hit += 1
            # a real miss is NOT recorded, so a later run can retry it again
            if n % 50 == 0:
                json.dump(done, open(OUT, 'w'))
                print(f'  {n}/{len(land)} hits={hit} ({time.time()-t0:.0f}s)', flush=True)
json.dump(done, open(OUT, 'w'))
print(f'DONE processed={n} hits={hit} total_cached={len(done)} in {time.time()-t0:.0f}s', flush=True)
