# Frontend Contract Alignment — Design Spec

**Date:** 2026-06-17  
**Status:** Approved  
**Scope:** Align HeatMAP_Frontend to the current `forecast_provinces.json` contract (weekly relative-risk model). Remove all dead code built for the old REST-API/absolute-probability/lgbm-v1 architecture.

---

## Problem

The frontend was built against an older backend (daily, absolute probability, `lgbm-v1`, `src/risk.py`). The current backend emits a **weekly 5-bucket relative-risk outlook** (`logistic_balanced_cal`). Several frontend features are dead or actively misleading:

- `RISK_EN_TO_APP` inflates every risk level by one notch (backend `Elevated` → app `'high'` → user sees "High risk"). Root cause of public over-escalation.
- `RISK_BANDS` / `getHeatwaveRiskLevel` re-derives levels from absolute probability — a second, drifting source of truth against a relative-risk model.
- `ALERT_THRESHOLDS` tuned for `lgbm-v1`; guard is triply broken (hardcoded `model_version`, contract field never read, wrong model name).
- `swbgt_pred` hardcoded to `0` — implies a capability the backend never ships.
- `days`/`_days = 7` params and `GET /api/forecast/province/:id?days=7` comments — no such API exists.

---

## Approach: Contract vocab throughout (Approach B)

Replace the internal `RiskLevel = 'low'|'moderate'|'high'|'extreme'` with the contract's own keys `'Low'|'Normal'|'Elevated'|'High'`. No translation layer. Single source of truth = the contract.

---

## Colour / Alert Mapping Table

One table drives colour, alert tier, and `predicted_label`:

| `risk_level_en` | Thai label | Colour | Alert tier | `predicted_label` |
|---|---|---|---|---|
| `'Low'` | ต่ำ | slate `#64748b` | `'none'` | `false` |
| `'Normal'` | ปกติ | green `#16a34a` | `'none'` | `false` |
| `'Elevated'` | ค่อนข้างสูง | amber `#b45309` | `'watch'` | `false` |
| `'High'` | สูง | red `#dc2626` | `'warning'` | `true` |

Low and Normal intentionally differ (slate vs green) so they are distinguishable on the map choropleth. Both carry no alert.

---

## Type Changes

### `RiskLevel` (forecastService.ts)
```ts
// Before
type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';
// After
type RiskLevel = 'Low' | 'Normal' | 'Elevated' | 'High';
```

### `ProvinceForecastDay` (forecastService.ts)
```ts
interface ProvinceForecastDay {
  target_date: string;
  probability: number;
  predicted_label: boolean;          // true only when risk_level_en === 'High'
  risk_level: RiskLevel;             // contract vocab, passed through verbatim
  risk_level_th: string;             // verbatim Thai label from contract
  ratio_vs_normal: number;           // precomputed ×N — display directly, do not recompute
  climatology_base_rate: number;
  generated_at: string;
  // swbgt_pred: number  ← DELETED
}
```

### `MapForecastPoint` (forecastService.ts)
Add `risk_level_th`, `ratio_vs_normal`, `climatology_base_rate`. Set `model_version` from contract's real `model` field (not hardcoded `'deepseek-prov-v1'`).

### `RawForecast` (deepseekContract.ts)
Add `climatology_base_rate: number`, `risk_level_th: string`.

### `Contract` (deepseekContract.ts)
Add `model: string`, `n_provinces: number`.

---

## Code Deletions

| Symbol | File | Reason |
|---|---|---|
| `RISK_EN_TO_APP` | deepseekContract.ts | Root cause of inflation |
| `toRisk()` | deepseekContract.ts | Used only by deleted RISK_EN_TO_APP |
| `SEVERITY_RANK` | deepseekContract.ts | Old internal vocab |
| `RISK_BANDS` | forecastService.ts | Absolute thresholds; src/risk.py doesn't exist |
| `getHeatwaveRiskLevel` | forecastService.ts | Re-derives what contract already provides |
| `ALERT_THRESHOLDS` | forecastService.ts | Tuned for lgbm-v1; incoherent under relative risk |
| `getAlertTier` | forecastService.ts | Probability-based; replaced by alertTierFromRiskLevel |
| `ALERT_TUNED_FOR_VERSION` | forecastService.ts | Wrong model name, guard never fires correctly |
| `assertAlertThresholdsCurrent` | forecastService.ts | Same |
| `swbgt_pred` field | forecastService.ts + deepseekContract.ts | Backend never emits this |
| `days` / `_days` param | forecastService.ts + useProvinceForecast.ts | Vestigial; contract consumed wholesale |
| REST API doc comments | forecastService.ts + useProvinceForecast.ts | No such API exists |

---

## Code Re-keying

Functions kept but re-keyed to new `RiskLevel` vocab:

**`getRiskColor(risk: RiskLevel)`**
```ts
switch (risk) {
  case 'High':     return '#dc2626';
  case 'Elevated': return '#b45309';
  case 'Normal':   return '#16a34a';
  default:         return '#64748b'; // Low
}
```

**`alertTierFromRiskLevel(risk)`**
```ts
if (risk === 'High')     return 'warning';
if (risk === 'Elevated') return 'watch';
return 'none';
```

**`riskLevelToSeverity`** — **delete**. Contract vocab is now identical to severity vocab, so the function is an identity. Update callers (`ProvinceForecastPanel:90`) to call `getRiskColor(d.risk_level)` directly.

---

## File-by-File Summary

### `services/deepseekContract.ts`
- Delete `RISK_EN_TO_APP`, `toRisk`, `SEVERITY_RANK`
- Extend `RawForecast`, `Contract` interfaces
- `mapPoints()`: carry `risk_level_en` as `risk_level` verbatim; set `model_version` from `c.model`; forward new fields
- `provinceDays()`: carry new fields; `predicted_label = f.risk_level_en === 'High'`; drop `swbgt_pred`

### `services/forecastService.ts`
- Change `RiskLevel` type
- Update `ProvinceForecastDay`, `MapForecastPoint`
- Re-key `getRiskColor`, `alertTierFromRiskLevel`
- Delete everything in the deletions table above
- Keep: `alertTierColor`, `alertTierLabel`, `riskPercent`, `isHistoricalRun`, `formatForecastDate`, `formatGeneratedAt`, `loadContract`, `assertContract`

### `hooks/useProvinceForecast.ts`
- Drop `days: number = 7` param
- Remove stale `/api/forecast/latest` coexistence note and `?days=N` doc

### `components/forecast/ProvinceForecastPanel.tsx`
- Drop `days = 7` prop; pass no `days` to hook
- `t('sevenDayForecast')` → `t('weeklyOutlook')`
- Add ratio row in each week cell: `{d.ratio_vs_normal.toFixed(1)}× ปกติ` at 9px, 75% opacity, same colour as probability

### `app/(tabs)/alerts.tsx`
- Remove `assertAlertThresholdsCurrent` call (~line 75)
- Alert tier derivation: switch call sites to `alertTierFromRiskLevel(d.risk_level)`
- `heatwaveDays`: count weeks where `risk_level ∈ {'Elevated','High'}`
- Remove stale `pipeline/run_forecast.py` comment
- Re-key `tierToRisk` (~line 37) to new vocab: `'warning'→'High'`, `'watch'→'Elevated'`, `'none'→'Normal'`

### `app/(tabs)/map.tsx`
- `provinceRisk` switch: re-keyed to `'High'|'Elevated'|'Normal'|'Low'`
- Hero label: render `risk_level_th` verbatim (replaces hardcoded i18n `riskHigh`, `riskVeryHigh`, `lowRisk`)

### `i18n/translations.ts`
- Add `weeklyOutlook: 'พยากรณ์ 5 สัปดาห์'` / `'5-Week Outlook'`
- Demote `riskHigh`, `riskVeryHigh`, `lowRisk` to fallback (keep strings, stop using as primary)

### `services/deepseekContract.test.ts`
- Rewrite inflation assertions to verbatim pass-through
- Assert new fields present (`ratio_vs_normal`, `risk_level_th`, `climatology_base_rate`)
- Assert `swbgt_pred` absent
- Assert `predicted_label` true only for `'High'`, false for `'Elevated'`
- Update sample data Thai labels to standardized wording

---

## What to Keep (no changes)

- `loadContract()` promise cache + error reset
- `assertContract` / schema_version gate
- Weekly target-date math (`issue_date + lead_weeks*7`)
- `HistoricalRunBanner` / `isHistoricalRun` (uses `generated_at − issue_date`, correct)
- `riskPercent`, `formatForecastDate`, `formatGeneratedAt`
- Load/error/empty/ready state handling in screens
- Per-province choropleth colouring in map

---

## Ratio Display

`ratio_vs_normal` appears in `ProvinceForecastPanel` only (not map pins). Rendered as `"2.3× ปกติ"` below the probability percentage in each week cell. Uses `ratio_vs_normal` from the contract directly — never recomputed.

---

## Implementation Order

1. **Contract layer first** (`deepseekContract.ts` + `forecastService.ts` types + tests) — everything else depends on `RiskLevel` changing
2. **Hook cleanup** (`useProvinceForecast.ts`) — no downstream UI impact
3. **UI consumers** (`alerts.tsx`, `map.tsx`, `ProvinceForecastPanel.tsx`, `i18n`)
4. **QA** — confirm `public/forecast_provinces.json` has standardized Thai labels before deploying

---

## Out of Scope

- Retraining the model
- Changing the backend contract
- CI/CD pipeline changes
- Open Meteo current-weather integration
- New screens or navigation changes
