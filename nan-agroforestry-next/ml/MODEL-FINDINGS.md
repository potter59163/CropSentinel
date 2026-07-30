# SDM audit — read before quoting an AUC number

**Status: the shipped model is unchanged.** `src/data/sdm_model.json` is still the v3
export (`validation: "spatial-block-2deg-group-kfold"`, 20 species, mean AUC **0.8415**).
`build_model.py` has since been modified toward a v4 feature set that has **not** been used
to regenerate it. Do not run `build_model.py` and ship the output without redoing the
validation below — the two are currently out of sync by design.

## Why this file exists

An audit re-measured the pipeline with the same spatial-block cross-validation but with two
methodological corrections. The headline number moved a lot, so anything quoted publicly
(competition abstract, RECOFTC reporting) should be based on this table rather than on 0.8415
alone.

| Config | Mean AUC | Min AUC | Brier |
|---|---|---|---|
| `R0_as_built` — reproduces the shipped config | 0.8156 | 0.6895 | 0.1591 |
| `R1_logit_only` — no model-selection peeking | 0.7973 | 0.6614 | 0.1658 |
| `R1_gbm_only` | 0.8136 | 0.6895 | 0.1597 |
| `R2_nested` — honest nested model selection | 0.8094 | 0.6757 | 0.1613 |
| `G1_regionmatched_negs` + nested | **0.7217** | 0.6209 | 0.1915 |
| `F1_drop_all_disaster` | 0.7126 | 0.6174 | 0.1931 |
| `F2_drop_disaster + soil_derived` | 0.7138 | 0.6238 | 0.1932 |
| `F3_climate_only` (soil ablation) | 0.7185 | 0.6374 | 0.1914 |
| `F4_keep_2_disaster + soil_raw` | 0.7148 | 0.6207 | 0.1928 |
| `S6_blocks_1deg` | 0.7252 | 0.6451 | 0.1407 |
| `S5_blocks_5deg` | 0.6947 | 0.5820 | 0.1454 |

Raw per-species output: `ml/cache/matrix_results.json`.

## What the numbers mean

**1. Two things inflate the shipped 0.84.**

*Model-selection peeking.* The export picks logit-vs-GBM per species using the same AUC it
then reports (`R0` 0.8156 vs nested `R2` 0.8094). Small, but it is a reported-metric leak.

*Background sampling.* This is the large one. Drawing negatives matched to the presences'
region drops the mean from ~0.81 to **0.7217**. That gap is the model learning *"is this
point in mainland Southeast Asia"* rather than *"is this species suited to this site"* —
easy discrimination that does not transfer to the real task, which is comparing 21 species
at one Nan plot where geography is held constant.

**Practical reading: the defensible figure for the current feature set is ~0.72–0.81
depending on protocol, not 0.84.** The honest description of what the model does well is
climate-envelope discrimination; ranking species *within* a single plot is a harder problem
than any of these AUCs measures.

**2. Adding soil features did not help — hypothesis refuted.**

Soil was originally excluded because the app was a client-side Vite bundle and SoilGrids is
CORS-blocked, so soil could not be supplied at inference. That constraint is gone (this is a
Next.js app and `planRunner` already fetches SoilGrids server-side), so soil was expected to
be the big win. It is not: climate-only `F3` (0.7185) is not beaten by soil-raw `F4`
(0.7148) or soil-derived `F2` (0.7138). Differences are within noise. Soil remains valuable
as the *agronomic guardrail* it already is in `engine.ts` (drainage/pH gating), just not as
an SDM predictor at this sample size.

**3. The GISTDA disaster features are near-constant in training — verified.**

Measured directly over the 4,245 cached training cells (`ml/cache/disaster_v3.json`):

| feature | nonzero cells | share |
|---|---|---|
| `flood7d_near` | 0 / 4245 | 0.00% |
| `fire7d_near` | 13 / 4245 | 0.31% |
| `burn_freq_near` | 22 / 4245 | 0.52% |
| `flood_freq_near` | 70 / 4245 | 1.65% |
| `drought_layers` | 681 / 4245 | 16.04% (binary 0/3) |

`flood7d_near` is a literal constant, and `drought_layers` is effectively "the GISTDA scan
reached this cell" — a geography indicator, not a drought measurement. Meanwhile at
inference these same columns carry real nonzero values for a live Nan plot. That is
train/serve skew: the model has weights for inputs it never meaningfully saw during
training. Dropping them costs nothing measurable (`G1` 0.7217 → `F1` 0.7126, within noise)
and removes the skew, so v4 drops them.

## Recommended next steps, in order

1. **Do not requote 0.84 without stating the protocol.** Safest public phrasing: report the
   nested, region-matched figure and say plainly that it is a spatially-blocked estimate.
2. Decide the v4 protocol deliberately (region-matched negatives + nested selection +
   no disaster features), regenerate, then re-run the whole app verification — every
   ranking and cashflow changes when suitability changes.
3. Species with few presences (galangal n=22, peanut n=31, chili n=45) should ship as
   explicit expert-judgement rather than as models with flattering AUCs.
4. ชาเมี่ยง (`tea`) still has `sdmId: 'tea'` with no entry in the export. Runtime now labels
   it honestly as `confidence: 'expert'` and caps it at the envelope ceiling
   (`suitability.ts`), so it can no longer outscore a real model — but it is still worth
   either training or removing the dangling `sdmId`.

## Also fixed in `build_model.py` (independent of the AUC question)

The SoilGrids fetch cached transport failures and genuine "no soil here" responses as the
same `None`, so one ISRIC timeout became a permanent hole in the training data. A retry of
40 such holes recovered 37 (~92% were transient). `soil_one` now returns an explicit
`ok` / `nodata` / `error` status and only caches the first two.

## Reproducing this

The audit scripts are kept so the table above is checkable rather than asserted:

| script | what it does |
|---|---|
| `matrix.py` | runs the config grid and writes `cache/matrix_results.json` (the table above) |
| `experiments.py` | the shared harness: feature assembly, spatial blocking, nested CV |
| `diagnose.py` | per-feature distribution checks — this is where the near-constant disaster columns were found |
| `verify_export.py` | asserts an export still parses under the shape `src/lib/suitability.ts` expects |
| `soil_topup.py`, `merge_soil.py` | refill SoilGrids cache holes left by transport failures |

`cache/` is gitignored, so a fresh clone must refetch (GBIF + NASA POWER + SoilGrids).
Remember `export SSL_CERT_FILE=$(python3 -c 'import certifi;print(certifi.where())')` first —
the Python 3.14 framework has no CA bundle and every HTTPS call fails without it.
