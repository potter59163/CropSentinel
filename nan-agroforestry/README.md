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

No server runtime is required for production. The app is static and calls public no-key APIs from the browser.
