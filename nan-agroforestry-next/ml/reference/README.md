# Reference data — licence-clean, committed on purpose

Small, redistributable reference datasets used to build the model. Everything here has a
licence that permits redistribution; anything that does not stays in `ml/gazetteer/`, which is
gitignored.

## `tambon_centroids_th.json` — Thailand sub-district gazetteer

**7,425 tambon (ตำบล) coordinates covering all 77 provinces and 928 amphoe.**

### Why it exists

Thailand's DOAE publishes national crop-production statistics (ภาวะการผลิตพืช) at **tambon**
level — 752,054 rows carrying province / amphoe / tambon, crop, planted and standing area in
rai. That is a direct measurement of where each crop is actually cultivated, which is far
closer to what this project needs than GBIF occurrence records (GBIF catalogues where plants
are *observed*, largely wild and herbarium; 10 of the 21 crops have **zero** GBIF records
inside Nan province).

An earlier attempt to use the DOAE data had to collapse it to 928 amphoe centroids, because
OpenStreetMap publishes only a few hundred usable tambon relations for Thailand. That cost real
accuracy: presence and background cells landed on populated valley floors, and for widely grown
crops the contrast saturated — banana ended up with 451 positive cells against only 118
available background cells. This gazetteer removes that blocker and grows the usable presence
universe roughly 8x.

### Source and licence

| | |
|---|---|
| Dataset | HDX **`cod-ab-tha`** — Thailand Subnational Administrative Boundaries (COD-AB) |
| Publisher | **OCHA FISS** (data.humdata.org) |
| Upstream authority | **Royal Thai Survey Department** (กรมแผนที่ทหาร), via ICRC |
| Licence | **CC BY-IGO 3.0** — <http://creativecommons.org/licenses/by/3.0/igo/legalcode> |
| Redistribution | **Permitted with attribution** |

**Required attribution if this data is shown or shipped:**

> Sub-district boundaries: OCHA / Royal Thai Survey Department, CC BY-IGO 3.0.

HDX does not restate the upstream terms under which ICRC acquired the RTSD data, so settle the
exact attribution wording with a human before a public release.

### Fields

`tambon_th`, `amphoe_th`, `province_th` (Thai names) · `tambon_en`, `amphoe_en`, `province_en` ·
`tambon_code` (6-digit TIS-1099), `amphoe_code`, `province_code` · `adm3_pcode`, `adm2_pcode`,
`adm1_pcode` (HDX pcodes) · `lat`, `lon` · `area_sqkm` · `centroid_kind`

`centroid_kind` is `polygon_interior_point` — a point guaranteed to lie **inside** the tambon
polygon, which is what a crop model needs. It is not an area-weighted centroid; for ~1% of
tambons that are concave enough, the two differ.

### Verified before committing

- Nan province contains exactly **99** tambons, matching the official count.
- Spot-checks land correctly: ในเวียง 18.7853/100.7809, ปัว 19.1700/100.8992,
  บ่อเกลือใต้ 19.0817/101.1944 — all inside Nan's bounds.
- 7,425 rows, 7,425 distinct `tambon_code`, 0 duplicates, 0 coordinates outside Thailand,
  0 NaN.
- Coverage is 7,425 of ~7,436 (99.85%). The shortfall is Bangkok khwaeng (169 of 180 carried).
  Bangkok has essentially no crop production and **no DOAE row references those rows**, so the
  deficit costs the model nothing.
- Independently cross-checked against two other sources: a GISTDA tambon layer
  (`Hosted/L05_Tambon_2559`, 7,424 features — median disagreement **0.116 km**, 94.6% within
  1 km) and a DOPA point layer (7,768 rows — median 0.55 km).

### Joining to DOAE crop statistics

Join **code-first, then fall back to normalised names.** Measured that way against the DOAE
files: **99.96% of (province, amphoe, tambon) triples and 99.99% of the 752,054 rows resolve.**
The handful that do not are DOAE-side data defects, not gaps here — including a literal
`xxxxxxxx` tambon name in ตรัง/ปะเหลียน (45 rows) and spelling variants such as
โพรงจระเข้ / โพรงจรเข้.

Name normalisation that was needed: NFC; strip zero-width and BOM; remove parenthetical
suffixes (DOAE writes `บางมด(จอมทอง)`) and trailing `*`; repeatedly strip leading
`จังหวัด|จ.|อำเภอ|อ.|กิ่งอำเภอ|เขต|ตำบล|ต.|แขวง|เทศบาล…|อบต.`; drop whitespace and punctuation.
Harder tiers additionally strip Thai vowel/tone marks and fold interchangeable consonants
(ศ/ษ/ซ→ส, ฬ→ล, ญ→ย, ณ→น, ธ/ถ/ฐ/ฑ/ฒ→ท, ฎ/ฏ→ด, ผ/ภ→พ, ใ→ไ).

### Two traps, both found the hard way

**1. Do not code-join blindly.** DOAE's own codes disagree with the gazetteers on a few keys,
and the disagreements are not symmetric:

- **เชียงใหม่ / กัลยาณิวัฒนา** — DOAE's three tambon codes really are cyclically rotated relative
  to both gazetteers (12–16 km of error if trusted). These must be pinned **by name**.
- **พระนครศรีอยุธยา / วังน้อย (141108 / 141109)** — here DOAE, HDX and DOPA all agree that
  141108 is วังจุฬา, and only a GISTDA label disagrees. A name-first resolution built from the
  GISTDA label moves วังจุฬา **5.45 km** onto ข้าวงาม's polygon and vice versa. Trust the
  majority, not the outlier.
- **บึงกาฬ (province 38)** — one GISTDA vintage still numbers its amphoe using the legacy
  within-Nong-Khai sequence, so `380301` code-joins *cleanly and silently* onto a tambon ~44 km
  away. This collides rather than failing, so it produces no error signal.

**2. GISTDA's tambon layer has better geometry but no licence.**
`Hosted/L05_Tambon_2559` publishes area-weighted centroids that verified perfectly, but its
`description` and `copyrightText` are both empty strings — there is no grant of any kind. A
sibling DOPA layer on the same portal does state a DGA Open Government License, which is
suggestive, but inference is not a licence. **Do not redistribute GISTDA coordinates in a
public app until GISTDA confirms terms.** If they do, the best combination is HDX names and
codes joined to GISTDA coordinates on the 6-digit code.

Also considered and rejected: **GADM 4.1 level 3** — academic/non-commercial only,
redistribution prohibited, and only 5,926 ADM3 features with `NL_NAME_3` literally `"NA"`, so no
Thai names to join on. **OSM** — 827 usable tambons found via Overpass; the earlier conclusion
that OSM is insufficient was correct, and its ODbL share-alike would attach to any derived
database.

### What this unblocks, and what it does not

It unblocks re-running the DOAE-vs-GBIF training-data comparison at tambon resolution. Recall
what that comparison already showed at the coarser amphoe resolution, on a shared spatially
blocked test set: predicting where Thai farmers actually grow a crop, GBIF-trained scored
**0.605** and DOAE-trained **0.680**, with DOAE winning 14 of 19 crops — and the shipped model
scoring *below chance* for banana, chili and galangal. See `../MODEL-FINDINGS.md`.

It does **not** on its own raise the headline AUC, and it should not be expected to: roughly 90%
of that metric's above-chance skill is ~200 km between-block geography, and Nan province is
about one 2-degree block.
