# Frontend Contract Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align HeatMAP_Frontend to the current weekly relative-risk contract — remove all stale dead code built for the old lgbm-v1/absolute-probability architecture and switch to contract vocab throughout.

**Architecture:** Replace the internal `'low'|'moderate'|'high'|'extreme'` RiskLevel with the contract's own keys `'Low'|'Normal'|'Elevated'|'High'`. Delete `RISK_EN_TO_APP` (the inflation bug), `RISK_BANDS`, `ALERT_THRESHOLDS`, `swbgt_pred`, and stale comments. Re-key colour/alert functions off one mapping table. Carry `risk_level_th` and `ratio_vs_normal` verbatim to the UI.

**Tech Stack:** Expo / React Native (web), TypeScript, Vitest (unit tests), i18n via custom hook

---

## File Map

| File | Change |
|---|---|
| `services/deepseekContract.test.ts` | Rewrite assertions for new contract shape |
| `services/deepseekContract.ts` | Complete rewrite — delete inflation, fix transforms |
| `services/forecastService.ts` | Change RiskLevel type, delete dead code, re-key functions |
| `hooks/useProvinceForecast.ts` | Drop `days` param, remove stale doc |
| `i18n/translations.ts` | Add `weeklyOutlook` key |
| `components/forecast/ProvinceForecastPanel.tsx` | Drop `days` prop, add ratio row, fix subtitle |
| `app/(tabs)/alerts.tsx` | Switch to `alertTierFromRiskLevel`, drop `getAlertTier`/`assertAlertThresholdsCurrent` |
| `app/(tabs)/map.tsx` | Drop `riskLevelToSeverity`, re-key provinceRisk, verbatim riskLabel |

---

## Task 1 — Rewrite test file (TDD: will fail until Task 2–3 done)

**Files:**
- Modify: `services/deepseekContract.test.ts`

- [ ] **Step 1: Replace the entire test file**

```ts
import { describe, it, expect } from 'vitest';
import { mapPoints, provinceDays, assertContract } from './deepseekContract';

const sample = {
  schema_version: 1, model: 'logistic_balanced_cal',
  generated_at: '2026-06-13T09:00:00+00:00', n_provinces: 1,
  provinces: [{
    id: 1, code: 'BKK', name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', region: 'Central',
    lat: 13.75, lon: 100.5, issue_date: '2023-12-31',
    forecasts: [
      { lead_weeks: 2, probability: 0.3858, climatology_base_rate: 0.11, ratio_vs_normal: 3.4, risk_level_th: 'สูง',          risk_level_en: 'High' },
      { lead_weeks: 3, probability: 0.20,   climatology_base_rate: 0.11, ratio_vs_normal: 1.8, risk_level_th: 'ค่อนข้างสูง', risk_level_en: 'Elevated' },
      { lead_weeks: 4, probability: 0.12,   climatology_base_rate: 0.11, ratio_vs_normal: 1.1, risk_level_th: 'ปกติ',         risk_level_en: 'Normal' },
      { lead_weeks: 5, probability: 0.05,   climatology_base_rate: 0.11, ratio_vs_normal: 0.4, risk_level_th: 'ต่ำ',          risk_level_en: 'Low' },
      { lead_weeks: 6, probability: 0.10,   climatology_base_rate: 0.11, ratio_vs_normal: 0.9, risk_level_th: 'ปกติ',         risk_level_en: 'Normal' },
    ],
  }],
} as const;

describe('deepseekContract transforms', () => {
  it('mapPoints: verbatim risk_level pass-through (no inflation)', () => {
    const pts = mapPoints(sample as any);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({
      province_id: 1, lat: 13.75, lon: 100.5,
      risk_level: 'High',
      risk_level_th: 'สูง',
      ratio_vs_normal: 3.4,
      climatology_base_rate: 0.11,
      model_version: 'logistic_balanced_cal',
    });
    expect(pts[0].target_date).toBe('2024-01-14');
    expect(pts[0].issue_date).toBe('2023-12-31');
  });

  it('provinceDays: new fields present, swbgt_pred absent', () => {
    const days = provinceDays(sample as any, 1);
    expect(days).toHaveLength(5);
    expect(days[0]).toMatchObject({
      target_date: '2024-01-14',
      risk_level: 'High',
      risk_level_th: 'สูง',
      ratio_vs_normal: 3.4,
      climatology_base_rate: 0.11,
    });
    expect((days[0] as any).swbgt_pred).toBeUndefined();
  });

  it('provinceDays: predicted_label true only for High', () => {
    const days = provinceDays(sample as any, 1);
    expect(days[0].predicted_label).toBe(true);   // High
    expect(days[1].predicted_label).toBe(false);  // Elevated
    expect(days[2].predicted_label).toBe(false);  // Normal
    expect(days[3].predicted_label).toBe(false);  // Low
  });

  it('provinceDays: lead 2-6 with weekly target dates', () => {
    const days = provinceDays(sample as any, 1);
    expect(days[0].target_date).toBe('2024-01-14');
    expect(days.at(-1)!.target_date).toBe('2024-02-11');
  });

  it('provinceDays: unknown id -> empty', () => {
    expect(provinceDays(sample as any, 999)).toEqual([]);
  });

  it('assertContract: passes schema_version 1', () => {
    expect(assertContract(sample as any).schema_version).toBe(1);
  });

  it('assertContract: throws on unsupported schema_version', () => {
    expect(() => assertContract({ ...sample, schema_version: 2 } as any)).toThrow(/schema_version/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (RISK_EN_TO_APP gone, inflation assertions removed)**

```
cd C:\Users\ASUS\HeatMAP_Frontend
npm run test:unit -- deepseekContract.test.ts
```

Expected: Several tests FAIL with "risk_level: 'extreme'" received but "'High'" expected (old code still inflates).

---

## Task 2 — Rewrite deepseekContract.ts (delete inflation, fix transforms)

**Files:**
- Modify: `services/deepseekContract.ts`

- [ ] **Step 1: Replace the entire file**

```ts
import type { MapForecastPoint, ProvinceForecastDay, RiskLevel } from './forecastService';

interface RawForecast {
  lead_weeks: number;
  probability: number;
  ratio_vs_normal: number;
  risk_level_en: string;
  risk_level_th: string;
  climatology_base_rate: number;
}
interface RawProvince {
  id: number;
  lat: number;
  lon: number;
  issue_date: string;
  forecasts: RawForecast[];
}
export interface Contract {
  schema_version: number;
  generated_at: string;
  model: string;
  n_provinces: number;
  provinces: RawProvince[];
}

export const SUPPORTED_SCHEMA = 1;
export function assertContract(c: Contract): Contract {
  if (c.schema_version !== SUPPORTED_SCHEMA) {
    throw new Error(`schema_version ไม่รองรับ: ${c.schema_version} (รองรับ ${SUPPORTED_SCHEMA})`);
  }
  return c;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mapPoints(c: Contract): MapForecastPoint[] {
  return c.provinces.map((p) => {
    const f = p.forecasts.find((x) => x.lead_weeks === 2) ?? p.forecasts[0];
    return {
      province_id: p.id,
      lat: p.lat,
      lon: p.lon,
      probability: f.probability,
      risk_level: f.risk_level_en as RiskLevel,
      risk_level_th: f.risk_level_th,
      ratio_vs_normal: f.ratio_vs_normal,
      climatology_base_rate: f.climatology_base_rate,
      target_date: addDaysISO(p.issue_date, f.lead_weeks * 7),
      issue_date: p.issue_date,
      generated_at: c.generated_at,
      model_version: c.model,
    };
  });
}

export function provinceDays(c: Contract, provinceId: number): ProvinceForecastDay[] {
  const p = c.provinces.find((x) => x.id === provinceId);
  if (!p) return [];
  return [...p.forecasts].sort((a, b) => a.lead_weeks - b.lead_weeks).map((f) => ({
    target_date: addDaysISO(p.issue_date, f.lead_weeks * 7),
    probability: f.probability,
    predicted_label: f.risk_level_en === 'High',
    risk_level: f.risk_level_en as RiskLevel,
    risk_level_th: f.risk_level_th,
    ratio_vs_normal: f.ratio_vs_normal,
    climatology_base_rate: f.climatology_base_rate,
    generated_at: c.generated_at,
  }));
}

let _cache: Promise<Contract> | null = null;
const FORECAST_URL = process.env.EXPO_PUBLIC_FORECAST_URL || '/forecast_provinces.json';
export function loadContract(): Promise<Contract> {
  if (!_cache) {
    _cache = fetch(FORECAST_URL).then(async (r) => {
      if (!r.ok) throw new Error(`โหลด forecast ไม่สำเร็จ (${r.status})`);
      return assertContract((await r.json()) as Contract);
    }).catch((e) => { _cache = null; throw e; });
  }
  return _cache;
}
```

---

## Task 3 — Update forecastService.ts (RiskLevel, types, delete dead code, re-key)

**Files:**
- Modify: `services/forecastService.ts`

- [ ] **Step 1: Change RiskLevel type (line 6)**

Old:
```ts
export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';
```
New:
```ts
export type RiskLevel = 'Low' | 'Normal' | 'Elevated' | 'High';
```

- [ ] **Step 2: Replace ProvinceForecastDay interface (lines 14–21)**

Old:
```ts
export interface ProvinceForecastDay {
  target_date: string;
  probability: number;
  predicted_label: boolean | number;
  risk_level: RiskLevel;
  swbgt_pred: number;
  generated_at: string;
}
```
New:
```ts
export interface ProvinceForecastDay {
  target_date: string;
  probability: number;
  predicted_label: boolean;
  risk_level: RiskLevel;
  risk_level_th: string;
  ratio_vs_normal: number;
  climatology_base_rate: number;
  generated_at: string;
}
```

- [ ] **Step 3: Replace MapForecastPoint interface (lines 29–43)**

Old:
```ts
export interface MapForecastPoint {
  province_id: number;
  lat: number;
  lon: number;
  probability: number;
  risk_level: RiskLevel;
  target_date: string;
  generated_at: string;
  /** Date the model run was issued (latest date with complete features).
   *  Forecast target_dates are issue_date + lead_weeks*7. */
  issue_date: string;
  /** Model that produced this row (e.g. 'lgbm-v1'); used to detect stale
   *  client-side alert thresholds (see ALERT_TUNED_FOR_VERSION). */
  model_version?: string;
}
```
New:
```ts
export interface MapForecastPoint {
  province_id: number;
  lat: number;
  lon: number;
  probability: number;
  risk_level: RiskLevel;
  risk_level_th: string;
  ratio_vs_normal: number;
  climatology_base_rate: number;
  target_date: string;
  generated_at: string;
  issue_date: string;
  model_version?: string;
}
```

- [ ] **Step 4: Delete the stale comment block and RISK_BANDS + getHeatwaveRiskLevel (lines 87–110)**

Delete everything from `// ─── MAP colour bands` through the closing brace of `getHeatwaveRiskLevel`. That is, delete lines 87–110:

```ts
// ─── MAP colour bands (mirror of DEFAULT_BANDS in src/risk.py) ───────────────
//
// CONSERVATIVE public-facing thresholds so the map stays calm — DECOUPLED from
// the (more sensitive) authority alert thresholds below. The backend writes
// `risk_level` with these bands; the map colours by it.
//   • extreme (red)     p >= 0.45
//   • high    (orange)  p >= 0.30
//   • moderate(yellow)  p >= 0.10
//   • low     (green)   otherwise
// Change policy in src/risk.py FIRST, then sync here.

export const RISK_BANDS = { moderate: 0.10, high: 0.30, extreme: 0.45 } as const;

/**
 * Probability → 4-tier risk level using the SAME bands as the backend
 * (src/risk.py). Prefer the server-provided `risk_level` when available —
 * this exists only for payloads that carry a bare probability.
 */
export function getHeatwaveRiskLevel(probability: number): 'low' | 'moderate' | 'high' | 'extreme' {
  if (probability >= RISK_BANDS.extreme) return 'extreme';
  if (probability >= RISK_BANDS.high) return 'high';
  if (probability >= RISK_BANDS.moderate) return 'moderate';
  return 'low';
}
```

- [ ] **Step 5: Delete ALERT_THRESHOLDS block, ALERT_TUNED_FOR_VERSION, warnedStaleThresholds, assertAlertThresholdsCurrent, and getAlertTier (lines 119–164)**

Delete everything from `// Authority alert thresholds` through `}` of `getAlertTier`:

```ts
// Authority alert thresholds — the MEASURED F2-tuned operating points
// (mirror of ALERT_THRESHOLDS in src/risk.py). DECOUPLED from RISK_BANDS so
// alerts stay sensitive (fire from 0.217) while the map stays calm.
export const ALERT_THRESHOLDS = {
  warning: 0.281,
  watch: 0.217,
} as const;

/**
 * The thresholds above were measured for THIS model version's calibrated
 * probabilities. If the API reports a different `model_version`, the tiers may
 * be stale — `assertAlertThresholdsCurrent` surfaces that in dev.
 */
export const ALERT_TUNED_FOR_VERSION = 'lgbm-v1';

/** Warn (once per session) if served forecasts come from a model version the
 *  alert thresholds were not tuned for. Returns true when versions match. */
let warnedStaleThresholds = false;
export function assertAlertThresholdsCurrent(modelVersion: string | undefined): boolean {
  if (!modelVersion || modelVersion === ALERT_TUNED_FOR_VERSION) return true;
  if (!warnedStaleThresholds) {
    warnedStaleThresholds = true;
    console.warn(
      `[forecastService] ALERT_THRESHOLDS tuned for '${ALERT_TUNED_FOR_VERSION}' ` +
      `but API serves '${modelVersion}' — re-measure the operating points.`,
    );
  }
  return false;
}

...

/** Classify a calibrated heatwave probability into a two-tier alert level.
 *  Fallback for payloads without `risk_level`; equals alertTierFromRiskLevel
 *  by construction (shared bands). */
export function getAlertTier(probability: number): AlertTier {
  if (probability >= ALERT_THRESHOLDS.warning) return 'warning';
  if (probability >= ALERT_THRESHOLDS.watch) return 'watch';
  return 'none';
}
```

- [ ] **Step 6: Delete riskLevelToSeverity (lines 60–69)**

Delete this function entirely:
```ts
export function riskLevelToSeverity(
  risk: string | null | undefined,
): 'extreme' | 'high' | 'moderate' | 'low' {
  switch (risk) {
    case 'extreme': return 'extreme';
    case 'high':    return 'high';
    case 'moderate':return 'moderate';
    default:        return 'low';
  }
}
```

- [ ] **Step 7: Re-key alertTierFromRiskLevel (currently around line 151–155)**

Old:
```ts
export function alertTierFromRiskLevel(risk: RiskLevel | string | null | undefined): AlertTier {
  if (risk === 'extreme') return 'warning';
  if (risk === 'high') return 'watch';
  return 'none';
}
```
New:
```ts
export function alertTierFromRiskLevel(risk: RiskLevel | string | null | undefined): AlertTier {
  if (risk === 'High')     return 'warning';
  if (risk === 'Elevated') return 'watch';
  return 'none';
}
```

- [ ] **Step 8: Re-key getRiskColor (currently around line 186–193)**

Old:
```ts
export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'extreme': return '#dc2626';
    case 'high': return '#ea580c';
    case 'moderate': return '#ca8a04';
    default: return '#16a34a';
  }
}
```
New:
```ts
export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'High':     return '#dc2626';
    case 'Elevated': return '#b45309';
    case 'Normal':   return '#16a34a';
    default:         return '#64748b'; // Low
  }
}
```

- [ ] **Step 9: Update the doc comment on getProvinceForecast (line 45–47)**

Old:
```ts
/** Fetch the 7-day (default) forecast for a single province. */
export async function getProvinceForecast(provinceId: number, _days: number = 7): Promise<ProvinceForecastDay[]> {
```
New:
```ts
/** Fetch the 5-week outlook for a single province. */
export async function getProvinceForecast(provinceId: number): Promise<ProvinceForecastDay[]> {
```

---

## Task 4 — Run tests — should now pass

**Files:** (none changed)

- [ ] **Step 1: Run the unit tests**

```
cd C:\Users\ASUS\HeatMAP_Frontend
npm run test:unit -- deepseekContract.test.ts
```

Expected output:
```
✓ services/deepseekContract.test.ts (7)
  ✓ mapPoints: verbatim risk_level pass-through (no inflation)
  ✓ provinceDays: new fields present, swbgt_pred absent
  ✓ provinceDays: predicted_label true only for High
  ✓ provinceDays: lead 2-6 with weekly target dates
  ✓ provinceDays: unknown id -> empty
  ✓ assertContract: passes schema_version 1
  ✓ assertContract: throws on unsupported schema_version

Test Files  1 passed (1)
```

If any test fails, check the error message and fix the corresponding task 2 or 3 step before continuing.

---

## Task 5 — Commit contract layer

**Files:** (no new changes)

- [ ] **Step 1: Stage and commit**

```bash
cd C:\Users\ASUS\HeatMAP_Frontend
git add services/deepseekContract.ts services/forecastService.ts services/deepseekContract.test.ts
git commit -m "feat: align contract layer to weekly relative-risk vocab

- RiskLevel -> Low|Normal|Elevated|High (contract keys, no translation)
- Delete RISK_EN_TO_APP, RISK_BANDS, ALERT_THRESHOLDS, swbgt_pred
- getRiskColor/alertTierFromRiskLevel re-keyed; predicted_label=High only
- ProvinceForecastDay/MapForecastPoint += risk_level_th, ratio_vs_normal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6 — useProvinceForecast.ts cleanup

**Files:**
- Modify: `hooks/useProvinceForecast.ts`

- [ ] **Step 1: Replace the file header comment (lines 1–12) with a concise one**

Old (lines 1–12):
```ts
/**
 * useProvinceForecast Hook
 *
 * Fetches the per-province heatwave forecast from
 * `GET /api/forecast/province/:id?days=N` (spec §7 / Phase 5) and exposes it
 * with loading / error / empty states plus the `generated_at` ("as of")
 * timestamp of the latest model run.
 *
 * This is intentionally separate from the legacy `useForecast(cycle)` hook,
 * which targets the older `/api/forecast/latest` endpoint and a different
 * response shape — both coexist.
 */
```
New:
```ts
/**
 * useProvinceForecast — loads the 5-week per-province outlook from the static
 * contract and exposes loading / error / empty states + generated_at timestamp.
 */
```

- [ ] **Step 2: Remove `days` param from hook signature and internal use**

Old (lines 29–34):
```ts
export function useProvinceForecast(
  provinceId: number | null,
  days: number = 7,
): UseProvinceForecastReturn {
  const [forecast, setForecast] = useState<ProvinceForecastDay[]>([]);
```
New:
```ts
export function useProvinceForecast(
  provinceId: number | null,
): UseProvinceForecastReturn {
  const [forecast, setForecast] = useState<ProvinceForecastDay[]>([]);
```

- [ ] **Step 3: Update getProvinceForecast call (line 54) — drop `days`**

Old:
```ts
      const data = await getProvinceForecast(provinceId, days);
```
New:
```ts
      const data = await getProvinceForecast(provinceId);
```

- [ ] **Step 4: Update useCallback dependency array (line 74) — remove `days`**

Old:
```ts
  }, [provinceId, days]);
```
New:
```ts
  }, [provinceId]);
```

---

## Task 7 — Add weeklyOutlook to i18n/translations.ts

**Files:**
- Modify: `i18n/translations.ts`

- [ ] **Step 1: Add `weeklyOutlook` to the Translations interface (after `sevenDayForecast` on line 93)**

Old:
```ts
  sevenDayForecast: string;
```
New:
```ts
  sevenDayForecast: string;
  weeklyOutlook: string;
```

- [ ] **Step 2: Add English value (after `sevenDayForecast: '2–6 week outlook'` around line 206)**

Old:
```ts
  sevenDayForecast: '2–6 week outlook',
```
New:
```ts
  sevenDayForecast: '2–6 week outlook',
  weeklyOutlook: '5-Week Outlook',
```

- [ ] **Step 3: Add Thai value (after `sevenDayForecast: 'แนวโน้ม 2–6 สัปดาห์'` around line 316)**

Old:
```ts
  sevenDayForecast: 'แนวโน้ม 2–6 สัปดาห์',
```
New:
```ts
  sevenDayForecast: 'แนวโน้ม 2–6 สัปดาห์',
  weeklyOutlook: 'พยากรณ์ 5 สัปดาห์',
```

---

## Task 8 — ProvinceForecastPanel.tsx

**Files:**
- Modify: `components/forecast/ProvinceForecastPanel.tsx`

- [ ] **Step 1: Remove `riskLevelToSeverity` from import (line 20)**

Old:
```ts
import {
  getRiskColor,
  riskLevelToSeverity,
  formatGeneratedAt,
  formatForecastDate,
} from '@/services/forecastService';
```
New:
```ts
import {
  getRiskColor,
  formatGeneratedAt,
  formatForecastDate,
} from '@/services/forecastService';
```

- [ ] **Step 2: Remove `days` from the Props interface and component signature (lines 26–38)**

Old:
```ts
interface Props {
  province: Province | null;
  days?: number;
}

export function ProvinceForecastPanel({ province, days = 7 }: Props) {
  const { isDarkMode, language, t } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  const { days: forecast, generatedAt, loading, error, refresh } = useProvinceForecast(
    province?.id ?? null,
    days,
  );
```
New:
```ts
interface Props {
  province: Province | null;
}

export function ProvinceForecastPanel({ province }: Props) {
  const { isDarkMode, language, t } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  const { days: forecast, generatedAt, loading, error, refresh } = useProvinceForecast(
    province?.id ?? null,
  );
```

- [ ] **Step 3: Change subtitle from `t('sevenDayForecast')` to `t('weeklyOutlook')` (line 50)**

Old:
```ts
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t('sevenDayForecast')}</Text>
```
New:
```ts
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t('weeklyOutlook')}</Text>
```

- [ ] **Step 4: Replace `riskLevelToSeverity` usage with direct `getRiskColor` (lines 90–91)**

Old:
```ts
            const sev = riskLevelToSeverity(d.risk_level);
            const color = getRiskColor(sev);
```
New:
```ts
            const color = getRiskColor(d.risk_level);
```

- [ ] **Step 5: Add ratio row after the probability text (after line 105)**

Old:
```tsx
                <Text style={[styles.dayProb, { color }]}>
                  {Math.round((d.probability ?? 0) * 100)}%
                </Text>
              </View>
```
New:
```tsx
                <Text style={[styles.dayProb, { color }]}>
                  {Math.round((d.probability ?? 0) * 100)}%
                </Text>
                <Text style={[styles.dayRatio, { color, opacity: 0.75 }]}>
                  {d.ratio_vs_normal.toFixed(1)}× ปกติ
                </Text>
              </View>
```

- [ ] **Step 6: Add `dayRatio` to StyleSheet (after `dayProb` in styles)**

Old:
```ts
  dayProb: { fontSize: 12, fontWeight: '700' },
```
New:
```ts
  dayProb: { fontSize: 12, fontWeight: '700' },
  dayRatio: { fontSize: 9, fontWeight: '600' },
```

---

## Task 9 — alerts.tsx

**Files:**
- Modify: `app/(tabs)/alerts.tsx`

- [ ] **Step 1: Update imports — remove `getAlertTier` + `assertAlertThresholdsCurrent`, add `alertTierFromRiskLevel` (lines 13–23)**

Old:
```ts
import {
  getForecastMap,
  getAlertTier,
  alertTierColor,
  alertTierLabel,
  assertAlertThresholdsCurrent,
  formatForecastDate,
  formatGeneratedAt,
  riskPercent,
  type AlertTier,
  type MapForecastPoint,
} from '@/services/forecastService';
```
New:
```ts
import {
  getForecastMap,
  alertTierFromRiskLevel,
  alertTierColor,
  alertTierLabel,
  formatForecastDate,
  formatGeneratedAt,
  riskPercent,
  type AlertTier,
  type MapForecastPoint,
} from '@/services/forecastService';
```

- [ ] **Step 2: Remove `assertAlertThresholdsCurrent` call (line 75)**

Old:
```ts
        setMapLoading(false);
        // Dev-visible guard: client alert thresholds are tuned per model version.
        assertAlertThresholdsCurrent(pts[0]?.model_version);
```
New:
```ts
        setMapLoading(false);
```

- [ ] **Step 3: Switch warningCount/watchCount loop from probability to risk_level (line 96)**

Old:
```ts
      // Alert tier from PROBABILITY (sensitive 0.217/0.281), decoupled from the
      // calmer map colours (risk_level). See src/risk.py.
      const tier = getAlertTier(p.probability);
```
New:
```ts
      const tier = alertTierFromRiskLevel(p.risk_level);
```

- [ ] **Step 4: Drop `7` from useProvinceForecast call (line 129)**

Old:
```ts
  } = useProvinceForecast(provinceId, 7);
```
New:
```ts
  } = useProvinceForecast(provinceId);
```

- [ ] **Step 5: Fix todayRisk derivation (line 153–155)**

Old:
```ts
  const todayRisk: RiskLevel = todayForecast
    ? tierToRisk(getAlertTier(todayForecast.probability))
    : 'safe';
```
New:
```ts
  const todayRisk: RiskLevel = todayForecast
    ? tierToRisk(alertTierFromRiskLevel(todayForecast.risk_level))
    : 'safe';
```

- [ ] **Step 6: Remove stale `pipeline/run_forecast.py` comment (lines 157–158)**

Old:
```ts
  // Summary across the 7-day horizon (predicted_label now carries the tuned
  // operating point from the model bundle — see pipeline/run_forecast.py)
  const heatwaveDays = useMemo(
```
New:
```ts
  const heatwaveDays = useMemo(
```

- [ ] **Step 7: Switch weekly-outlook tier derivation (line 344)**

Old:
```ts
                  const tier = getAlertTier(day.probability);
```
New:
```ts
                  const tier = alertTierFromRiskLevel(day.risk_level);
```

---

## Task 10 — map.tsx

**Files:**
- Modify: `app/(tabs)/map.tsx`

- [ ] **Step 1: Remove `riskLevelToSeverity` from import (line 10)**

Old:
```ts
import { getForecastMap, riskLevelToSeverity, formatGeneratedAt, type MapForecastPoint } from '@/services/forecastService';
```
New:
```ts
import { getForecastMap, formatGeneratedAt, type MapForecastPoint } from '@/services/forecastService';
```

- [ ] **Step 2: Replace `riskLevelToSeverity` in grid cell mapping (line 125)**

Old:
```ts
        const severity: Severity = riskLevelToSeverity(np.risk_level);
```
New:
```ts
        const severity: Severity =
          np.risk_level === 'High'     ? 'extreme'
          : np.risk_level === 'Elevated' ? 'high'
          : 'low';
```

- [ ] **Step 3: Replace `riskLevelToSeverity` in provinceRisk switch (lines 150–155)**

Old:
```ts
      const sev = riskLevelToSeverity(pt.risk_level);
      const level =
        sev === 'extreme' ? 'extreme'
        : sev === 'high' ? 'warning'
        : sev === 'moderate' ? 'watch'
        : 'safe';
```
New:
```ts
      const level =
        pt.risk_level === 'High'     ? 'warning'
        : pt.risk_level === 'Elevated' ? 'watch'
        : 'safe';
```

- [ ] **Step 4: Add `myProvincePoint` after the `myProvince` useMemo block (after line 233)**

After the closing of `myProvince` useMemo, add:
```ts
  const myProvincePoint = useMemo(
    () => myProvince ? mapPoints.find((p) => p.province_id === myProvince.id) ?? null : null,
    [myProvince, mapPoints],
  );
```

- [ ] **Step 5: Replace `riskLabel` derivation to use verbatim `risk_level_th` (lines 207–214)**

Old:
```ts
  const riskLabel =
    !dataReady
      ? (status === 'loading' ? t('loading') : t('dataUnavailable'))
    : heroSeverity === 'extreme' ? t('riskVeryHigh')
    : heroSeverity === 'high' ? t('riskHigh')
    : heroSeverity === 'moderate' ? t('moderate')
    : t('lowRisk');
```
New:
```ts
  const riskLabel =
    !dataReady
      ? (status === 'loading' ? t('loading') : t('dataUnavailable'))
      : myProvincePoint?.risk_level_th ?? t('lowRisk');
```

---

## Task 11 — TypeScript check + commit UI layer

**Files:** (no new changes)

- [ ] **Step 1: Run TypeScript compiler to find any remaining type errors**

```
cd C:\Users\ASUS\HeatMAP_Frontend
npx tsc --noEmit 2>&1 | head -40
```

Expected: No errors. If errors appear, they will point to a specific file/line — fix the type mismatch (usually a remaining reference to old `'extreme'|'high'|'moderate'|'low'` vocab).

- [ ] **Step 2: Run full test suite**

```
npm run test:unit
```

Expected:
```
Test Files  1 passed (1)
Tests  7 passed (7)
```

- [ ] **Step 3: Commit UI layer**

```bash
git add hooks/useProvinceForecast.ts i18n/translations.ts \
  components/forecast/ProvinceForecastPanel.tsx \
  app/(tabs)/alerts.tsx app/(tabs)/map.tsx
git commit -m "feat: align UI consumers to contract vocab + add ratio display

- alerts/map: switch to alertTierFromRiskLevel (drop getAlertTier)
- map: verbatim risk_level_th in hero label; re-key provinceRisk switch
- ProvinceForecastPanel: add ratio_vs_normal row, drop days prop
- i18n: add weeklyOutlook key; useProvinceForecast: drop days param

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
