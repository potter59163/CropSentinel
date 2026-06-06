# Nan Agroforestry

Vite + React planner for Nan province agroforestry scenarios.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Model and data

- `src/data/sdm_model.json` is the trained SDM model consumed directly by the frontend.
- `src/data/nan_satellite.json` is the precomputed Nan satellite/GEE lookup used by the frontend.
- `ml/build_model.py` and `ml/gee_extract.py` are offline scripts for regenerating those JSON files.
- `ml/cache/` is intentionally ignored and does not need to be deployed.

## Vercel

When importing this monorepo into Vercel, set:

- Framework Preset: `Vite`
- Root Directory: `nan-agroforestry`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

The app also includes a Vercel Function at `api/gistda-disaster.js` so the
GISTDA Disaster Open API key never ships to the browser bundle.

Set this Environment Variable in Vercel:

- `GISTDA_DISASTER_API_KEY`: the GISTDA key without a leading dash (`-`)

After setting the variable, redeploy the project. The planner will call:

- `/features/viirs/7days` for recent wildfire hotspots
- `/features/flood/7days` for recent flood areas
- `/features/burn-scar` and `/features/burn-freq` for burn risk context
- `/features/flood-freq` for repeated flood risk context
- `/maps/dri/7days/wms`, `/maps/ndwi/7days/wms`, and `/maps/smap/7days/wms`
  to confirm official drought layers are available through GISTDA

For local Vercel testing:

```bash
cp .env.example .env.local
# put the real key in .env.local, then run with the Vercel CLI
vercel dev
```

Do not commit `.env.local` or the real API key.
