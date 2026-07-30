# Nan Agroforestry Next

Production-grade Next.js version of the Nan Agroforestry Planner for RECOFTC field pilots.

## What changed from the Vite prototype

- Next.js App Router full-stack app.
- `/api/plan` runs climate, GISTDA, satellite lookup, SDM inference, cashflow, price sensitivity, soil proxy and ranking on the server.
- `sdm_model.json` stays server-side and is not shipped in browser chunks.
- Farm design calculator supports target income and crop-level price/yield/survival overrides.
- Neon Postgres + PostGIS schema is included for field pilot data.
- RECOFTC data templates are included for 30-plot batch tests and expert feedback.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Production build

```bash
npm run typecheck
npm run build
npm start
```

## Environment variables

- `GISTDA_DISASTER_API_KEY`: GISTDA Disaster Open API key, without a leading dash.
- `DATABASE_URL`: Neon Postgres connection string. Optional until field feedback/database persistence is enabled.
- `NEXT_PUBLIC_APP_URL`: public app URL for sitemap/robots/share metadata.

## Database

Run `db/schema.sql` in Neon SQL editor or psql:

```sql
\i db/schema.sql
```

The schema starts with point geometries for `farm_plots` and can be extended to polygon boundaries later.

## Field data templates

- `data-templates/recoftc-farm-plots-30-sample.csv`: 30 Nan sample plots for batch testing low/mid/highland cases.
- `data-templates/recoftc-crop-assumptions-template.csv`: crop economics and expert validation template.
- `data-templates/field-feedback-template.csv`: farmer/RECOFTC/officer feedback capture.

## Vercel

Recommended Vercel settings:

- Framework Preset: `Next.js`
- Root Directory: `nan-agroforestry-next`
- Install Command: `npm install`
- Build Command: `npm run build`

The Vite prototype this replaced no longer exists in the repo; this directory is the
only Nan app. The sibling `cropsentinel/` is a separate project (Pathum Thani rice)
and shares no code with it.
