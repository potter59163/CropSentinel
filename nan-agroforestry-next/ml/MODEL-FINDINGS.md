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

A full v4 export was produced and measured: **21 species (ชาเมี่ยง now trained),
climate-only features, mean AUC ≈ 0.72** — the candidate file reports 0.7185 for itself and
an independent from-scratch reimplementation got 0.7148, a gap inside the ~0.004 seed noise.
Quote it as **≈0.72**, not to four decimal places. It is deliberately **not shipped** — it
sits at `ml/candidates/sdm_model_v4_candidate.json`. See "Deciding whether to ship v4" below.

### The single strongest piece of evidence

Train a classifier whose **only** input is a boolean "is this point inside the SE-Asia
box" — no climate, no soil, no elevation — and score it on v3's own test setup.

**It reaches mean AUC ≈ 0.74** (range 0.665–0.804 across the 21 crops).

Against a claimed 0.8415, that means most of the apparent skill is geographic: the test set
was built so a model could score well by recognising which continent a point is on, because
the background cells were drawn from inside the SE-Asia box while many species' occurrence
records lie outside it. Under v4's region-matched background the same control scores exactly
**0.500 for all 21 species** — the shortcut is closed, which is why v4's honest figure is
lower.

> **Correction (2026-07-30).** An earlier revision of this file printed a per-species table
> claiming geography alone scored 0.92–0.99 and beat the full model for 9 of 21 species.
> That table was wrong twice over and has been removed. The geography control was measured
> against a background-only negative set rather than the mixed pool v3 actually drew from
> (which gives 0.665–0.804, not 0.92–0.99), and its "v3 reported AUC" column had been read
> off the v4 candidate file while it was being written, so the numbers were not v3's at all.
> For the record, v3's real values for the crops named there are ginger 0.743,
> lemongrass 0.713, pumpkin 0.699, pineapple 0.679, avocado 0.773, turmeric 0.741,
> coffee 0.785, macadamia 0.933, มะแขว่น 0.899. Do not quote the withdrawn table.

The conclusion the withdrawn table was reaching for does survive, in weaker and correct
form: **~0.09 of v3's headline is attributable to geography rather than agronomy**, and the
0.8415 figure additionally is not a valid estimate at all — see below.

### Why 0.8415 specifically is not an accuracy estimate

It is the mean over 20 species of `max(aucLogitSpatial, aucGBM)` read straight out of the
shipped JSON: for each crop it reports whichever of two candidate models scored higher **on
the same folds used to score them**. That is selection bias by construction, and it was
confirmed to hold for all 20 species. An independent from-scratch reimplementation of the
v3 recipe on the current cache gives **0.818**, and the honest decomposition is:

| step | mean AUC |
|---|---|
| v3 recipe, current cache | 0.818 |
| + nested model selection (no peeking) | 0.812 |
| + region-matched background | **0.719** ← the big drop |
| + drop disaster & soil columns | 0.715 |

Block-size sensitivity: 1° 0.728, 2° 0.715, 4° 0.696 — the shipped protocol uses the middle
value, not the flattering one. Seed sampling SD ≈ 0.004.

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

**2. Soil was not added — it was removed. The "add soil" hypothesis is refuted.**

The premise this audit started from was wrong. The story in the code comments was that soil
had been *excluded* because the app was a client-side Vite bundle and SoilGrids is
CORS-blocked, so soil could not be supplied at inference — and that since this is now a
Next.js app whose `planRunner` fetches SoilGrids server-side, adding it back would be the
big accuracy win.

**Soil was never excluded.** The shipped v3 `base` array contains `soil_ph, soil_clay,
soil_sand, soil_oc, soil_cec` — verify with
`node -e "console.log(require('./src/data/sdm_model.json').base)"`. So the direction of the
change is the opposite of what was assumed: v4 *drops* soil, on measurement.

Under the region-matched nested protocol, adding the five raw soil columns moves mean blocked
AUC by roughly **-0.003 to -0.005** — it is very slightly worse, and well inside the ~0.004
seed noise either way. Adding the three derived indices is no better. An earlier +0.02 that
had been credited to soil in the v3 history actually came from a GBIF occurrence top-up
bundled into the same commit.

Soil *is* genuinely available at inference (`SoilContext` in `src/lib/soil.ts` returns ph,
clayPct, sandPct, organicCarbonPct and cec in the same physical units), so the removal rests
on measurement rather than on a serving gap. And soil still does real work in the product —
just as the agronomic guardrail in `engine.ts` (drainage and pH gating), not as an SDM
predictor at a 27 km grain.

The stale CORS comment in `src/lib/climate.ts` has been corrected.

**3. The GISTDA disaster features are near-constant in training — and this is a LIVE
production defect, not a caveat.**

This is the most important item in this file and it applies to the model that is deployed
**right now**, independently of any AUC argument.

`engine.ts` passes the live GISTDA risk context into `plantSuitability`, and then scales
revenue by `(0.4 + 0.6 × suitability)`. Toggling the live GISTDA values on versus off at a
single 1,200 m Nan plot moves suitability by a **mean of 0.347, max 0.777**, and changes the
top-five recommendation completely:

| crop | risk context off | risk context on |
|---|---|---|
| เผือก taro | 0.223 | **1.000** |
| ข่า galangal | 0.250 | **1.000** |
| ขมิ้น turmeric | 0.350 | **1.000** |
| อะโวคาโด avocado | 0.645 | 0.220 |

Three crops saturate at a perfect score. Because suitability multiplies straight into the
ten-year projection, that is up to an **~87% swing in a crop's projected revenue** — driven
by columns the model never meaningfully trained on. `drought_layers` carries the largest
disaster weight in the shipped logistic model (mean |w| 0.880, max 1.837) while being, in
the training pool, essentially a flag for whether the GISTDA scan reached that cell.

**Treat this as a correctness bug to fix before farmers use the tool.** It is fixed in the
un-deployed v4 candidate (which drops these columns). Anyone shipping v4 for this reason
must still recalibrate `AUC_MIN`/`ENVELOPE_CEILING` per the section below.

**3b. The training-pool evidence.**

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

## Deciding whether to ship v4

v4 is the more defensible science, but swapping it is a **product** change, not a metadata
change, so it was left for a human to decide rather than slipped in.

What changes if you ship `ml/candidates/sdm_model_v4_candidate.json`:

- The headline figure becomes **0.7185** across 21 species, honestly measured, instead of
  0.8415 across 20.
- ชาเมี่ยง gains a real model instead of falling through to the envelope.
- The five GISTDA disaster columns and the five soil columns are gone, so the train/serve
  skew disappears.
- **Five species fall below `AUC_MIN = 0.65` in `suitability.ts`** — ginger 0.637,
  taro 0.641, bamboo 0.642, pumpkin 0.646, lemongrass 0.647 — and would switch to the
  elevation-envelope path. Because that path returns a flat `ENVELOPE_CEILING` of 0.72,
  **those five would then outrank almost every properly modelled crop**: at 300 m they take
  the entire top five, and at 1,200 m slots two through five. Only มะแขว่น (0.907),
  macadamia (0.838) and ชาเมี่ยง (0.822) reach 'high'.
  So shipping v4 as-is would make the recommendations *worse*, not better —
  `AUC_MIN` and `ENVELOPE_CEILING` have to be recalibrated together with it.
  (peanut is 0.685 in the candidate, above the gate — an earlier revision of this file
  listed it at 0.602, which was wrong.)

So shipping it requires re-running the full app verification, and it contradicts the 0.84
already quoted in the competition abstract. Two coherent options:

1. **Keep v3 live, fix the claim.** Cheapest and safest before a stakeholder meeting.
   Describe the metric honestly (say it is a spatially-blocked estimate, and that background
   sampling means the per-species figures for the 9 species above are optimistic).
2. **Ship v4 and requote 0.71.** Better science, and the number survives scrutiny — but do
   it deliberately, with the app re-verified and the abstract updated in the same pass.

Do not do the third thing: ship v4 and keep quoting 0.84.

## Recommended next steps, in order

1. **Do not requote 0.84 without stating the protocol.** Safest public phrasing: report the
   nested, region-matched figure and say plainly that it is a spatially-blocked estimate.
2. Decide the v4 protocol deliberately (region-matched negatives + nested selection +
   no disaster features), regenerate, then re-run the whole app verification — every
   ranking and cashflow changes when suitability changes.
3. The flattering small-n AUCs are in the **shipped** model, not the candidate: v3 ships
   galangal n=22 auc 0.923, peanut n=31 auc 0.804, chili n=45 auc 0.936. Under the honest
   protocol with a topped-up cache those fall to roughly 0.68–0.69 — collapses of 0.12–0.24,
   exactly what small samples predict. The v4 candidate has no species under n=50 (min 88),
   so this is an argument for the rebuild rather than against it.
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

## Limits of 0.72 that no protocol change removes

Worth carrying into any external description, because these are properties of the data, not
of the fitting:

- **Grid resolution.** Training cells are 0.25° (~27 km). That cannot separate a 400 m valley
  from a 1,400 m ridge — which is exactly the siting question a farmer asks. Most of the
  genuinely local reasoning in the product comes from the elevation envelope and the
  agronomic guardrail in `engine.ts`, not from the statistical model.
- **It is not a Nan model.** Across all 21 crops there are only about a dozen occurrence
  records inside Nan province, and 12 crops have none at all. It is a regional
  climate-envelope model applied to Nan.
- **Not calibrated.** Mean Brier ≈ 0.19. The score is a relative suitability index, not a
  probability of a successful harvest, and must not be presented as one.
- **Noise floor.** Per-species fold SD is 0.017–0.099 (mean ≈ 0.049), so any single-species
  gap under ~0.05 is not a real difference.
- **Residual selection optimism.** About 20 configurations were compared and the best was
  kept, so a little optimism survives even the nested protocol.
- 7 species are cap-truncated at exactly 450 occurrence records in arbitrary order.

## Suggested wording for external use

> A relative habitat-suitability index, mean AUC ≈ 0.72 across 21 crops under spatial-block
> cross-validation. Three crops (มะแขว่น, macadamia, ชาเมี่ยง) discriminate well; five sit at
> or below 0.65 and are presented as expert judgement rather than model output. The index is
> not calibrated to yield and is not a probability of a successful harvest.

Do **not** say the model was improved. It was audited; the honest number is lower than the
one previously advertised, and nothing in production changed as a result of this audit.
