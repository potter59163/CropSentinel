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

**3. The GISTDA disaster features are near-constant in training — this WAS a live production
defect. Fixed at the inference layer; kept here because it explains the fix.**

> **Status: fixed.** `suitability.ts` now passes the training median for these five columns
> instead of live values, so inference matches training. Measured after the fix: toggling live
> GISTDA risk changes suitability by mean **0.0000** and max **0.0000** across all 21 crops
> (was mean 0.347 / max 0.777). The risk data is *not* discarded — `engine.ts` still reads it
> for the rule-based `waterFit`/`riskFit`, which still move the ranking (riskFit 0.864 → 0.916
> on the test plot). The v4 candidate drops the columns entirely, which is the cleaner fix if
> it is ever shipped.

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

## The most important thing in this file: ~90% of the skill is 200 km geography

Shuffle each crop's occurrence labels **inside** every 2-degree block — destroying all
within-block information while leaving the between-block pattern intact — and mean AUC falls
only from **0.719 to 0.697**. So of the 0.219 of above-chance skill, roughly **0.022 (about
10%) is within-block discrimination and about 90% is coarse ~200 km between-block
geography**. Measured over all 21 crops, and independently reproduced.

**Nan province is roughly one 2-degree block.** So the metric that says 0.72 is mostly
certifying something the app does not need: telling northern Thailand from the central plains.
The thing the app actually does — ranking crops for one plot, and ranking neighbouring plots
against each other inside Nan — is the part the 0.72 barely measures.

Honest one-line characterisation, and this should travel with any number quoted externally:

> The index ranks agro-climatic zones well. It is much weaker at ranking neighbouring plots
> inside Nan.

This also explains why the two levers below failed. Finer climate cannot help if the labels
only locate a crop to a 27 km cell; and per-crop feature tuning cannot help if the signal
being fitted is regional rather than local.

## Three attempts to raise AUC, and what each measured

All three ran under the unchanged v4 protocol (region-matched background, 2-degree spatial
blocks, GroupKFold, nested inner-fold selection). **None was shipped.** Scratch work is under
`ml/exp_*/`, which is gitignored.

### Lever 1 — Thai cultivation statistics instead of GBIF: the data exists, and the headline metric is the wrong question

**The data is real and was obtained.** DOAE (กรมส่งเสริมการเกษตร) publishes ภาวะการผลิตพืช at
**tambon** level, nationally, machine-readable, via data.go.th / catalog.doae.go.th — 752,054
rows carrying province/amphoe/tambon, crop, households, planted and standing area in rai.
All 21 crops appear by name, including the obscure ones (มะแขว่น 13 rows, มะคาเดเมีย 40, ชา 57).
OAE by contrast publishes only province-level PDFs, and **Nan's own provincial open-data portal
publishes nothing about crop area at all** (183 packages enumerated).

On the mandated metric this lever **loses**: 0.678 versus a matched-species baseline of 0.709,
i.e. −0.031. But the two numbers answer different questions, and the experimenter said so
rather than papering over it:

- The baseline asks *"can you tell a GBIF cell from SE-Asian background?"*
- The lever asks *"can you tell a Thai district that grows this crop from one that doesn't?"*

The second is harder and is much closer to what the product needs. So a shared-test-set
comparison was run — rank districts in a held-out 2-degree block by whether DOAE reports
≥20 rai, identical labels and folds for both competitors, selection nested inside each one's
own training data:

| trained on | mean AUC at predicting real Thai cultivation |
|---|---|
| GBIF (the shipped recipe) | **0.605** |
| DOAE cultivation statistics | **0.680** |

DOAE wins **14 of 19** crops, and the design was deliberately biased *against* it (the GBIF
model was allowed to train on points inside the held-out block). **The shipped model is below
chance at predicting where Thai farmers actually grow banana (0.472), chili (0.437) and
galangal (0.456).**

That is a product finding the 0.72 headline cannot surface, and it deserves a decision.

**Two tempting results were rejected as the same artifact v3 shipped.** Using DOAE presences
against the cached background scores 0.741, and GBIF+DOAE combined scores 0.753 — a clean
looking +0.034. Both are fake: a model given **zero crop information** separates district
centroids from the cached background at **AUC 0.917**, because district centroids sit on
populated valley floors and the background does not. Information-free random district cells
reproduce **52%** of the combined arm's entire gain. Recorded as rejected, not pending.

**The blocker is geocoding, not data.** The DOAE files are tambon-level (7,436 units) but OSM
publishes only 434 tambon boundaries, so everything collapsed to 928 amphoe centroids. A real
tambon gazetteer (HDX Thailand ADM3, LDD, or DOPA TIS-1099) grows the presence universe ~8x
and fixes both of this arm's weaknesses at once — the saturated contrast for common crops
(banana: 451 positives against only 118 available background cells) and the small-n crops.
**That is the highest-value next step in the whole model workstream.**

### Lever 1 follow-up — the tambon gazetteer arrived, so the amphoe compromise was redone

`ml/reference/tambon_centroids_th.json` (7,425 sub-districts, CC BY-IGO) removed the
geocoding blocker. Two things came out of redoing the work at tambon resolution, and the
second one matters much more than the first.

**The "8x more presence cells" premise was wrong.** Rebuilding presence at tambon resolution
grew the 0.25° cell universe only **569 → 767 (1.35x)**, and saturation barely moved —
banana went from 79% to 78% of the universe. A tambon averages ~8 km across while the SDM
grid cell is ~27 km, so roughly ten tambons collapse into one cell. Refining administrative
resolution *below the grid size* cannot create new distinct cells. Some crops even lost cells
(lemongrass 156 → 121, galangal 97 → 77) because the 20-rai threshold bites harder on smaller
units.

**So the untested combination was tested: fine labels against a fine grid.** Lever 2 failed
with 1 km climate because the labels were amphoe-coarse; the tambon rebuild failed because
the grid was coarse. Holding the point set and labels identical (7,425 tambon points, no
snapping) and varying *only* whether each point gets its own 1 km CHELSA reading or the mean
of its 0.25° cell:

| seed | coarse 27 km | fine 1 km | delta |
|---|---|---|---|
| 9 | 0.7283 | 0.7372 | +0.0089 |
| 17 | 0.7384 | 0.7293 | −0.0091 |
| 42 | 0.7368 | 0.7323 | −0.0046 |
| **mean** | | | **−0.0016** (positive in 1 of 3) |

Control: 100% of points lie inside the SE-Asia box, so the geography shortcut is impossible
by construction and the comparison is valid. And there genuinely *was* something for the fine
grid to see — within a single 0.25° cell the 1 km temperature spread is median 0.50 °C, p90
2.60 °C, max **6.00 °C**.

**Resolution is settled: it is not the constraint, at either end.** Real sub-cell climate
variation exists and does not predict where these crops are grown. What decides cultivation
below ~27 km is land tenure, roads, markets, irrigation and local practice — things climate
cannot express.

#### What the gazetteer DID buy: the head-to-head widened decisively

Redone at tambon resolution — rank every tambon in a held-out 2° block by whether DOAE
reports ≥20 rai, identical labels and folds both sides, CHELSA features sampled at each
side's own points so neither is advantaged by feature provenance:

| | amphoe resolution | **tambon resolution** |
|---|---|---|
| GBIF-trained (shipped recipe) | 0.605 | **0.614** |
| DOAE-trained | 0.680 | **0.748** |
| DOAE wins | 14 of 19 | **20 of 20** |

The finer target lifted the DOAE model by +0.068 while leaving the GBIF model flat, widening
the gap from 0.075 to **0.134**. The design remains conservative *against* DOAE: the GBIF
model is allowed to train on occurrence points inside the held-out block, a spatial-leakage
advantage the DOAE model is denied.

**The shipped training data is below chance at predicting real Thai cultivation for five of
twenty crops** — bamboo 0.496, cashew 0.469, chili 0.406, galangal 0.428, sweetpotato 0.449.
That is an absolute statement about the deployed model, not an artifact of the comparison.

Per-crop, the gap is largest exactly where it matters commercially: longan +0.247,
pineapple +0.223, bamboo +0.213, chili +0.209, cashew +0.197, teak +0.186.

#### Two caveats that must travel with those numbers

**1. Part of the gap is distribution match, not data quality.** The DOAE model is trained on
the same kind of label it is tested against (DOAE ≥20 rai), so some of its advantage is that
its training and test distributions agree. Read the result as *"if the goal is predicting
actual cultivation, training on cultivation records beats training on occurrence records"* —
not as a general 0.13 superiority. The genuinely unarguable part is the below-chance finding
above.

**2. Cultivation records encode economics, not suitability — and that is a real conceptual
problem for this product.** DOAE tells you where crops *are* grown, which reflects tradition,
market access, contract farming, subsidies and road networks as much as agro-climatic fit. A
model trained on it would tend to recommend "grow what your neighbours already grow". For an
app whose entire purpose is to help farmers move *away* from monoculture maize, that is a
substantive risk, not a technicality. Switching training data is therefore a **product
decision about what the tool should mean**, not a modelling tweak — and it should not be made
on an AUC comparison alone.

### Lever 2 — 1 km CHELSA climate instead of 27 km: refuted

−0.0006 (p=0.97), and every like-for-like variant within ±0.002 — inside a background-seed
noise floor of 0.005–0.010. The 27 km-**aggregated** version of the same CHELSA data matches
or beats the 1 km version in all four paired comparisons. The predicted pattern did not appear
either: macadamia +0.014 and coffee +0.003, but ชาเมี่ยง −0.004 and มะแขว่น −0.004, while the
largest single move was sweetpotato +0.065, a lowland crop.

Worth keeping for the record: the 27 km cell really does hide 1–2.5 °C and ~160 mm of rainfall
in Nan, and the 1 km raster resolves that gradient almost perfectly (within-cell r = −0.99
against elevation, −0.62 °C/100 m). So the coarse grid is a genuine limitation of the *inputs* —
it just is not the binding constraint on this metric. **The binding constraint is that the
presence labels only locate a crop to a 27 km cell**, which no climate raster can fix.
Anyone who proposes "just use CHELSA" should be shown `ml/exp_chelsa/results_summary.json`.

### Lever 3 — per-species features and ensembling: thesis refuted, one small generic gain

**Per-species feature selection — the lever's actual thesis — is refuted**, negative in 6 of 6
background draws, and forward selection was the single worst of 14 procedures tried.

What survived is generic model averaging: averaging the logit and GBM predictions instead of
selecting between them with the exported `preferred` flag gives **+0.011 ± 0.002, positive in
6 of 6 independent draws**. Honest framing, per adversarial verification:

- Quote **0.713 → 0.724** averaged over draws, not the single-draw 0.7185 → 0.7331. **The
  headline stays ~0.72.**
- The gain (+0.011) is **smaller than the metric's own sensitivity to the background sample
  (0.0131 across draws)** — a refinement, not a change in capability.
- **0 of 21 crops** clear their own fold SD, so there are no per-crop claims to make.
- A single balanced random forest alone scores +0.0095, about two-thirds of the 14-model
  ensemble's gain, so "averaging is what helps" is *not* established — "the current
  logit/GBM pair is slightly weak" fits equally well.
- Under a label-shuffle null the averaging rule still scores +0.004, so roughly a third of the
  observed effect is mechanical. It is distinguishable from noise by **consistency** (6/6
  draws, 16–20 of 21 crops up), not by magnitude.

It is cheap to adopt (both models are already exported; it is one expression in
`suitability.ts` and retiring `preferred`) and it *removes* a selection step. But it shifts
every score slightly and `engine.ts` feeds suitability straight into the 10-year cashflow, so
it is left as a human decision rather than slipped in.

### A gating instability worth fixing regardless of any lever

`AUC_MIN = 0.65` in `suitability.ts` decides whether a crop is ranked by the model or falls
back to the elevation envelope. The number of crops below that gate swings **2 / 5 / 6 / 3 /
5 / 5** across background seeds, and at one seed the weakest crop scores **0.476 — below
chance**. A production behaviour switch is therefore partly determined by a training random
seed. The fix is to average blocked AUC over several background draws before it gates
anything; it costs only compute and changes no part of the protocol.

## Correction to an earlier claim in this file

An earlier revision said mean Brier 0.19 means "the score is uncalibrated and is not a
probability of a successful harvest". The second half stands; **the first half was wrong.**
Measured: at most 0.005 of that 0.19 is miscalibration, Platt scaling recovers 0.0001, and
isotonic regression actively hurts. The scores are already close to calibrated *for what they
estimate* — which is presence-vs-background contrast, not yield. Calibration is not an
available lever.

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
- **Not a yield probability.** Mean Brier ≈ 0.19. The score is a relative suitability index
  and must not be presented as a probability of a successful harvest. Note this is NOT a
  calibration failure — see the correction section above; at most 0.005 of that Brier is
  miscalibration. It is simply estimating a different quantity than yield.
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
