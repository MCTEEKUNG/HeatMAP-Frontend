# HeatMAP Frontend — Redesign to the Current Backend Architecture

**Date:** 2026-06-17
**Status:** Proposal (planning only — no code changed by this document)
**Scope:** Align the Expo / React Native frontend to the *current* `forecast_provinces.json` contract. The app was built against an OLDER backend (a daily, severity/sWBGT-predicting heat-stress model). The current backend is a **weekly probability-of-occurrence outlook with risk RELATIVE to climatology**. Several frontend features are now dead, stale, or actively misleading.

---

## 0. Authoritative current contract (what the backend actually ships)

Verified against the deployed artifact `public/forecast_provinces.json`:

```jsonc
{
  "schema_version": 1,
  "model": "logistic_balanced_cal",          // top-level; frontend never reads it
  "generated_at": "2026-06-16T12:02:13Z",
  "n_provinces": 77,
  "provinces": [{
    "id": 1, "code": "BKK", "name_th": "...", "name_en": "Bangkok",
    "region": "Central", "lat": 13.7563, "lon": 100.5018,
    "issue_date": "2026-05-31",
    "forecasts": [{
      "lead_weeks": 2,                         // weekly buckets, lead 2..6 (5 buckets)
      "probability": 0.2667,                   // calibrated P(heatwave occurs that week)
      "climatology_base_rate": 0.1169,         // long-run base rate for that province/week
      "ratio_vs_normal": 2.28,                 // probability / base_rate (RELATIVE risk)
      "risk_level_th": "สูง",                  // backend-authored label (Thai)
      "risk_level_en": "Elevated"              // backend-authored label (English)
    } /* lead 3..6 */]
  }]
}
```

Key facts the frontend must internalize:

- **Weekly, 5 buckets** (`lead_weeks` 2–6). Not daily, not 7 days.
- **Probability-of-occurrence ONLY.** No severity, no intensity, no temperature, no duration, **no sWBGT**.
- **Risk is RELATIVE to climatology.** `ratio_vs_normal = probability / climatology_base_rate`. A high probability in a high-base-rate province is "normal"; a modest probability in a low-base-rate province can be "Elevated/High".
- **Current model is `logistic_balanced_cal`.** NOT `lgbm-v1`.
- **English risk keys:** `Low / Normal / Elevated / High`. Standardized Thai labels: `Low=ต่ำ, Normal=ปกติ, Elevated=ค่อนข้างสูง, High=สูง`.
  - ⚠️ The deployed `public/forecast_provinces.json` still carries the *pre-standardization* Thai wording (`Elevated→"สูง"`, `High→"สูงมาก"`). This is exactly why the frontend must render `risk_level_th` **verbatim** rather than maintain its own EN→TH map — verbatim rendering auto-tracks the backend the moment it republishes (see §3a).

---

## 1. DEAD / stale features (built for the old architecture)

### 1.1 `swbgt_pred` is hardcoded to `0`
`services/deepseekContract.ts:49` sets `swbgt_pred: 0` on every `ProvinceForecastDay`. The field is declared in the type at `services/forecastService.ts:19`. The old architecture predicted a heat-stress index (sWBGT); the current model emits no such quantity. It is dead weight that implies a capability the backend does not have.
**→ Remove `swbgt_pred` from the type and the transform.**

### 1.2 Daily / "7-day" framing
The contract is **weekly (5 buckets, lead 2–6)**, but the code carries a daily vocabulary:
- Type name `ProvinceForecastDay` and the "one day of per-province forecast" doc comment (`services/forecastService.ts:8–21`).
- `getProvinceForecast(provinceId, _days = 7)` — the `days` param is already **vestigial/ignored** (note the `_days` underscore; the contract is consumed wholesale). `forecastService.ts:46`.
- `useProvinceForecast(provinceId, days = 7)` and call sites passing `7` (`alerts.tsx:129`, `ProvinceForecastPanel.tsx:31` default `days = 7`).
- Comments referencing `GET /api/forecast/province/:id?days=7` (`forecastService.ts:11`, `useProvinceForecast.ts` header). No such HTTP API exists anymore — `loadContract()` fetches a single static JSON (`deepseekContract.ts:55–64`).
- `t('sevenDayForecast')` subtitle in `ProvinceForecastPanel.tsx:50`.

This is **mostly a naming/label cleanup**, not a data-model change: the data is already 5 weekly buckets, and large parts of the UI already render `สัปดาห์ที่ N` / `Week N` (`alerts.tsx:316–376`, `ProvinceForecastPanel.tsx:92–93`).

### 1.3 `ALERT_THRESHOLDS` tuned for the wrong model
`forecastService.ts:119–122` defines absolute probability operating points `warning: 0.281`, `watch: 0.217`, and `ALERT_TUNED_FOR_VERSION = 'lgbm-v1'` (`:129`). `assertAlertThresholdsCurrent()` warns when the served `model_version` differs (`:134–144`).
Two problems:
1. **The guard is triply broken.** `mapPoints()` hardcodes `model_version: 'deepseek-prov-v1'` (`deepseekContract.ts:35`); the contract's real `model: 'logistic_balanced_cal'` is **never read** (the `Contract` interface at `deepseekContract.ts:9` omits `model`); and the threshold is tuned for `'lgbm-v1'`. So the guard forever compares `deepseek-prov-v1` ≠ `lgbm-v1` and the warning effectively always (mis)fires on a name that is itself fictional.
2. **Absolute thresholds are incoherent under RELATIVE risk.** With `base_rate ≈ 0.117`, a low-base-rate province at 3× normal can sit *below* 0.217 and never alert → systematic **under-alerting** exactly where the anomaly is largest.

### 1.4 `RISK_BANDS` claiming to mirror `src/risk.py`
`forecastService.ts:87–110` defines absolute bands (`moderate 0.10 / high 0.30 / extreme 0.45`) and `getHeatwaveRiskLevel(probability)`, with comments "mirror of DEFAULT_BANDS in src/risk.py" and "Change policy in src/risk.py FIRST, then sync here." **`src/risk.py` does not exist in the current backend.** Current risk is RELATIVE and the **band assignment is already done server-side** (`risk_level_en` / `risk_level_th`). The frontend re-deriving levels from absolute probability is a second, drifting source of truth.

### 1.5 `RISK_EN_TO_APP` inflates every level by one notch
`deepseekContract.ts:3–5`:
```ts
export const RISK_EN_TO_APP = { Low:'low', Normal:'moderate', Elevated:'high', High:'extreme' };
```
This maps the backend's 4 levels onto the app's internal `{low, moderate, high, extreme}` vocab **shifted up one step**: backend **Normal → app "moderate"**, **Elevated → app "high"**, **High → app "extreme"**. Every province is displayed one tier scarier than the backend states. Backend "Elevated" surfaces to the user as "High risk" / warning colour. This is an over-escalation / public-panic risk and the single most important thing to fix.

### 1.6 `predicted_label` is synthesized client-side from the inflated rank (and mis-documented)
`deepseekContract.ts:25,48` computes `predicted_label = SEVERITY_RANK[risk] >= SEVERITY_RANK.high`, where `risk` already came through the inflating `RISK_EN_TO_APP`. So `predicted_label` is true for backend **Elevated and above** — not a backend-provided flag at all. The comment in `alerts.tsx:157–158` ("predicted_label now carries the tuned operating point from the model bundle — see pipeline/run_forecast.py") is **false/stale**: the contract carries no such field. `heatwaveDays` (`alerts.tsx:159–162`) and the "{N} heatwave weeks predicted" headline (`alerts.tsx:303`) inherit the inflation.

### 1.7 Hardcoded Thai risk wording in i18n — a third source of truth
`i18n/translations.ts` hardcodes risk labels: `riskHigh: 'ความเสี่ยงสูง'`, `riskVeryHigh: 'ความเสี่ยงสูงมาก'`, `lowRisk: 'ความเสี่ยงต่ำ'` (`:265,334,335`), consumed in `map.tsx:208–214`. These compete with the contract's `risk_level_th`. Three vocabularies now disagree: contract (`Low/Normal/Elevated/High`), app internal (`low/moderate/high/extreme`), and i18n free-text — guaranteeing drift.

---

## 2. Unused contract data the frontend should start using

All three are already in the JSON (and `climatology_base_rate` + `ratio_vs_normal` are even declared in the `RawForecast` interface at `deepseekContract.ts:7`) but never surfaced:

| Field | Today | Should drive |
|---|---|---|
| `climatology_base_rate` | ignored | honest "vs normal" baseline (e.g. "normally 12% this week") |
| `ratio_vs_normal` | declared, never read | **precomputed** "×N vs normal" framing (Bangkok wk2 = **2.28× normal**) — display directly, do not recompute from base_rate |
| `risk_level_th` | not in `RawForecast` interface at all | the verbatim Thai label (single source of truth) |
| `model` (top-level) | not in `Contract` interface | the real model id for any version guard that survives |

---

## 3. Recommended alignment (priority order)

### 3a. (Highest) Render `risk_level_en` / `risk_level_th` VERBATIM; delete the inflation and the frontend's own bands
- Add `climatology_base_rate`, `ratio_vs_normal`, `risk_level_th`, `risk_level_en` to the contract types and carry them through unchanged.
- **Delete** `RISK_EN_TO_APP` (§1.5), `RISK_BANDS` + `getHeatwaveRiskLevel` (§1.4).
- Display the contract's Thai/English label **as-is**. Demote the i18n risk strings (§1.7) to a fallback only for a missing label.
- **Rationale:** single source of truth = the contract. Verbatim rendering also makes the label-standardization drift in the deployed JSON self-correct once the backend republishes — building a frontend EN→TH map would just recreate the drift.

**Vocabulary ripple (the spine of the change).** Deleting `RISK_EN_TO_APP` re-keys every consumer from app-internal `{low,moderate,high,extreme}` to contract `{Low,Normal,Elevated,High}`. Distinguish two concerns: (1) **label text** → render verbatim; (2) **level → colour / alert tier** → still a lookup, but keyed on the *contract level*, not on probability bands. Proposed single mapping table:

| Contract `risk_level_en` | Thai (standardized) | Map colour / severity | Alert tier |
|---|---|---|---|
| `Low` | ต่ำ | green / safe | none |
| `Normal` | ปกติ | green / safe | none |
| `Elevated` | ค่อนข้างสูง | amber / watch | watch |
| `High` | สูง | red / warning | warning |

Consumers to re-key off this table (no probability-band derivation):
`riskLevelToSeverity` (`forecastService.ts:60`), `getRiskColor` (`:186`), `alertTierFromRiskLevel` (`:151`), `SEVERITY_RANK` / `predicted_label` (`deepseekContract.ts:25,48`), `map.tsx` `provinceRisk` switch (`:151–155`) and hero label/colour (`:200–214`), `ProvinceForecastPanel` (`:90–91`), `alerts.tsx` `tierToRisk` (`:37–39`).

### 3b. Reframe daily → weekly (5-week outlook)
Rename `ProvinceForecastDay` → e.g. `ProvinceForecastWeek` (or `…Lead`); drop the `days`/`_days` params and `?days=7` comments; change `t('sevenDayForecast')` to the existing 2–6 week wording. Low-risk: the data is already weekly and most UI already says "Week N". This is rename + label cleanup.

### 3c. Remove `swbgt_pred`
Delete from `ProvinceForecastDay` (`forecastService.ts:19`) and from the transform (`deepseekContract.ts:49`).

### 3d. Drive alerts from `risk_level_en`, not absolute probability
Make `alertTierFromRiskLevel` (re-keyed: **High → warning**, **Elevated → watch**) the **primary** path. Switch the call sites in `alerts.tsx` (`:96`, `:154`, `:344`) off `getAlertTier(probability)`. The existing function already has the "can never drift from what the backend wrote" property — this is mostly switching call sites. Delete `ALERT_THRESHOLDS` / `getAlertTier` / `ALERT_TUNED_FOR_VERSION` / `assertAlertThresholdsCurrent` (§1.3). "Re-measure operating points for `logistic_balanced_cal`" is a *fallback only* if product wants probability-driven tiers — but those are incoherent under relative risk, so prefer the label-driven path.

### 3e. Use `ratio_vs_normal` (and `climatology_base_rate`) for honest "vs normal" framing
Surface the precomputed `ratio_vs_normal` ("2.3× ปกติ") and optionally the base rate. This is what makes a relative-risk model legible to the public and is the honest replacement for the deleted absolute "risk N%" framing where appropriate. (Keep `riskPercent(probability)` for the raw chance, but pair it with the ratio.)

---

## 4. Concrete change list (a PLAN — implement in stages)

### Stage 1 — Contract layer (foundation; everything else depends on it)
- `services/deepseekContract.ts`
  - Extend `RawForecast` with `climatology_base_rate`, `risk_level_th` (already has `ratio_vs_normal`, `risk_level_en`).
  - Extend `Contract` with `model: string` and `n_provinces`.
  - **Delete** `RISK_EN_TO_APP`, `toRisk`, `SEVERITY_RANK`.
  - `mapPoints` / `provinceDays`: carry `risk_level_en`, `risk_level_th`, `ratio_vs_normal`, `climatology_base_rate` through verbatim; stop deriving `risk_level` via inflation; **drop `swbgt_pred`**; drop synthesized `predicted_label` (or replace with a contract-driven flag = `risk_level_en ∈ {Elevated, High}`); set `model_version` from `c.model` instead of the hardcoded `'deepseek-prov-v1'`.
- `services/forecastService.ts`
  - `RiskLevel` type → contract vocab `'Low'|'Normal'|'Elevated'|'High'` (or add a typed mapping). Add `climatology_base_rate`, `ratio_vs_normal`, `risk_level_th`, `risk_level_en` to `ProvinceForecastDay`/`MapForecastPoint`; remove `swbgt_pred`.
  - **Delete** `RISK_BANDS`, `getHeatwaveRiskLevel`, `ALERT_THRESHOLDS`, `getAlertTier`, `ALERT_TUNED_FOR_VERSION`, `assertAlertThresholdsCurrent`, and the `src/risk.py` comments.
  - Re-key `riskLevelToSeverity`, `getRiskColor`, `alertTierFromRiskLevel` onto the §3a table.
- `services/deepseekContract.test.ts` — **must be updated alongside**: it asserts the inflation (`RISK_EN_TO_APP.High → 'extreme'`, `Normal → 'moderate'`, lines 20–25,29,37), asserts `typeof swbgt_pred === 'number'` (`:39`), and its sample uses inconsistent Thai labels. Rewrite to assert verbatim pass-through + the §3a mapping.

### Stage 2 — Hooks / wrapper rename
- `hooks/useProvinceForecast.ts` — drop `days` param and `?days=:N` doc; rename type usages; remove legacy `/api/forecast/latest` coexistence note.
- `services/forecastService.ts` `getProvinceForecast(_days)` — drop the param.

### Stage 3 — UI consumers
- `app/(tabs)/alerts.tsx` — switch tier derivation to `risk_level_en` (`:96,154,344`); fix the false `predicted_label`/`pipeline/run_forecast.py` comment and `heatwaveDays` (`:157–162`); reword "{N} heatwave weeks predicted" headline to match relative framing (`:303`); remove `assertAlertThresholdsCurrent` call (`:75`).
- `app/(tabs)/map.tsx` — re-key `provinceRisk` switch (`:151–155`) and hero label/colour (`:200–214`) onto contract levels; replace hardcoded i18n risk wording with `risk_level_th`; optionally show `ratio_vs_normal`.
- `components/forecast/ProvinceForecastPanel.tsx` — re-key colour via §3a (`:90–91`); change `days = 7` default and `t('sevenDayForecast')` (`:31,50`); optionally render the ratio.
- `i18n/translations.ts` — demote hardcoded risk wording (`:224,225,265,334,335`) to fallback; rename `sevenDayForecast` value/usages.

### Stage 4 — Data/QA
- Confirm the published `public/forecast_provinces.json` is regenerated with the **standardized** Thai labels (ค่อนข้างสูง/สูง) before/with the verbatim-rendering change, so users see the agreed wording.

---

## 5. Already aligned — KEEP

- **`isHistoricalRun(issueDate, generatedAt, staleDays=14)`** (`forecastService.ts:200–211`) uses `generated_at − issue_date`, matching the backend's freshness logic; the `HistoricalRunBanner` in `alerts.tsx:201` is correct. Keep.
- **`loadContract()`** (`deepseekContract.ts:54–64`) already fetches the single static JSON with a promise cache and re-throw-on-error reset. Keep (just enrich the parsed shape).
- **`assertContract` / `schema_version` gate** (`deepseekContract.ts:11–17`). Keep.
- **Weekly target-date math** `issue_date + lead_weeks*7` (`deepseekContract.ts:33,46`) is already correct for a weekly outlook. Keep.
- **Load-state UX** (loading / error / empty / ready kept distinct from "low risk") in `map.tsx` and `alerts.tsx`. Keep.
- **`riskPercent`, `formatForecastDate`, `formatGeneratedAt`** (`forecastService.ts:195,213,75`). Keep (pair `riskPercent` with `ratio_vs_normal`).
- **Per-province choropleth / nearest-point colouring** in `map.tsx` — honest rendering of a per-province model. Keep; only the level→colour key changes.
