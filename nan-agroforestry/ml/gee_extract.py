#!/usr/bin/env python3
"""
Google Earth Engine extraction for Nan province — REAL satellite layers on a grid.
Outputs ../src/data/nan_satellite.json : per ~5.5km cell:
  tc      = Hansen tree-cover 2000 (%)
  lossyr  = Hansen forest-loss year (2000+yr, or 0 = none)
  lc      = ESA WorldCover 2021 class (10 forest,20 shrub,30 grass,40 crop,50 built,60 bare,80 water,...)
  ndvi    = Sentinel-2 dry-season median NDVI (current greenness)

Run: SSL_CERT_FILE=$(python3 -c 'import certifi;print(certifi.where())') python3 gee_extract.py
"""
import json, os, ee

PROJECT = 'april-th-482506'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'nan_satellite.json')
BBOX = [100.08, 17.40, 101.45, 19.85]  # lon0,lat0,lon1,lat1 — Nan province
STEP = 0.05

ee.Initialize(project=PROJECT)

# grid of points
feats = []
lat = BBOX[1]
while lat <= BBOX[3]:
    lng = BBOX[0]
    while lng <= BBOX[2]:
        feats.append(ee.Feature(ee.Geometry.Point([round(lng, 3), round(lat, 3)]), {'lat': round(lat, 3), 'lng': round(lng, 3)}))
        lng += STEP
    lat += STEP
grid = ee.FeatureCollection(feats)
print(f'grid points: {len(feats)}')

region = ee.Geometry.Rectangle(BBOX)
hansen = ee.Image('UMD/hansen/global_forest_change_2025_v1_13')
wc = ee.ImageCollection('ESA/WorldCover/v200').first()
s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(region).filterDate('2024-11-01', '2025-03-15')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)).median())
ndvi = s2.normalizedDifference(['B8', 'B4']).rename('ndvi')

comp = (hansen.select(['treecover2000', 'lossyear'])
        .addBands(wc.rename('lc')).addBands(ndvi))

print('reducing over grid (server-side)...')
res = comp.reduceRegions(collection=grid, reducer=ee.Reducer.first(), scale=100).getInfo()

cells = []
for f in res['features']:
    p = f['properties']
    cells.append({
        'lat': p['lat'], 'lng': p['lng'],
        'tc': round(p.get('treecover2000') or 0),
        'lossyr': int(p['lossyear']) + 2000 if p.get('lossyear') else 0,
        'lc': int(p['lc']) if p.get('lc') is not None else 0,
        'ndvi': round(p['ndvi'], 3) if p.get('ndvi') is not None else None,
    })
cells = [c for c in cells if c['lc']]  # drop empty
json.dump({'step': STEP, 'source': 'GEE: Hansen GFC v1.13 · ESA WorldCover v200 · Sentinel-2 SR', 'cells': cells},
          open(OUT, 'w'), ensure_ascii=False)
print(f'wrote {len(cells)} cells -> {OUT}')
# quick summary
from collections import Counter
print('land cover dist:', Counter(c['lc'] for c in cells))
print('cells with past forest loss:', sum(1 for c in cells if c['lossyr']))
