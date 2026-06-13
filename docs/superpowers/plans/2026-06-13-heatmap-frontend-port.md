# HeatMAP-Frontend Port + DeepSeek Bridge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** นำ HeatMAP-Frontend (Expo/RN, ดีไซน์เดิมของผู้ใช้) มาไว้ใน repo decoupled `HeatMAP_Frontend` แล้ว repoint data layer จาก Render API → DeepSeek static `forecast_provinces.json`, ปรับ semantics รายวัน→รายสัปดาห์, strip ส่วน Heatwave_AI-specific, รันบน Expo web

**Architecture:** เก็บ type ปลายทางเดิม (`MapForecastPoint`/`ProvinceForecastDay`/`RiskLevel`) → แก้แค่ 2 ฟังก์ชันใน `forecastService` ให้ transform จาก contract + `provincesService` ใช้ bundled list → หน้าจอ map แทบไม่แตะ ; `alerts.tsx` แปลงปฏิทินรายวัน→outlook รายสัปดาห์ ; strip LIFF/cooling/push.

**Tech Stack:** Bun, Expo (~55) / React Native 0.83 / react-native-web, expo-router, leaflet/react-leaflet (web map), Vitest (เพิ่มสำหรับ unit test ตัว adapter ล้วนๆ)

**สเปก:** `docs/superpowers/specs/2026-06-13-heatmap-frontend-port-design.md` ; bridge contract = DeepSeek `forecast_provinces.json` (schema_version 1)

---

## Prerequisites
- repo `C:\Users\ASUS\HeatMAP_Frontend` มี git แล้ว (spec บน `main`, .gitignore พร้อม)
- source: `C:\Users\ASUS\Heatwave_AI\HeatMAP-Frontend` (อ่าน/คัดสำเนา — ห้ามแก้ต้นทาง)
- bridge data: `C:\Users\ASUS\DeepSeek_Heatwave\docs\forecast_provinces.json`
- bun, node 24 (มี)

## Reference — DeepSeek contract → app types (the mapping this plan implements)
- contract province `forecasts[]`: `{lead_weeks, probability, climatology_base_rate, ratio_vs_normal, risk_level_th, risk_level_en}`; province `{id, lat, lon, issue_date, ...}`
- **risk:** `risk_level_en` → app `RiskLevel`: `Low→low, Normal→moderate, Elevated→high, High→extreme`
- **MapForecastPoint** (per province, use **lead 2**): `{province_id:id, lat, lon, probability, risk_level, target_date: issue+14d, generated_at}`
- **ProvinceForecastDay[]** (per province, **lead 2–6**): `{target_date: issue+lead*7, probability, predicted_label: severity>=high, risk_level, swbgt_pred: 0, generated_at}` (swbgt unused; set 0 + hide in UI)

---

## Task 1: Copy frontend into decoupled repo + baseline web build

**Files:** copy of HeatMAP-Frontend into `HeatMAP_Frontend/`

- [ ] **Step 1: copy source (exclude heavy/private dirs)**
```bash
cd /c/Users/ASUS
cp -r Heatwave_AI/HeatMAP-Frontend/. HeatMAP_Frontend/ 2>/dev/null
cd HeatMAP_Frontend
rm -rf node_modules .expo web-build dist .env
# keep our own .git + docs/ + .gitignore (do NOT copy source .git)
rm -rf .git/MERGE_HEAD 2>/dev/null; true
```
Verify our git is intact: `git status` shows the copied files as untracked (our `main` with the spec commit still present: `git log --oneline` shows the spec commit).
If the copy clobbered our `.gitignore`, restore it to include: `node_modules/ dist/ .expo/ web-build/ *.log .env .env.local .DS_Store`.

- [ ] **Step 2: install**
```bash
bun install
```
Expected: installs (Expo 55 + RN deps). If a peer/version conflict blocks bun, fall back to `npm install --legacy-peer-deps` and note it.

- [ ] **Step 3: baseline web export builds (unmodified)**
```bash
bunx expo export -p web
```
Expected: a `dist/` web bundle is produced without a hard error. (Runtime data fetch will fail until Task 2 — that's fine; we only need it to BUILD.) If `expo export` needs an `.env`, create `.env` with `EXPO_PUBLIC_API_URL=http://localhost:3000` as a placeholder so the build resolves env reads.

- [ ] **Step 4: commit baseline**
```bash
git add -A
git commit -m "$(printf 'chore: import HeatMAP-Frontend into decoupled repo (baseline)\n\nCopied from Heatwave_AI/HeatMAP-Frontend (no source .git/node_modules).\nUnmodified baseline that web-exports; data repoint follows.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```
Report: did `expo export -p web` succeed? any dep-install fallback used?

---

## Task 2: Data bridge — repoint forecastService + provincesService to the contract (TDD)

**Files:** Create `services/deepseekContract.ts`, `services/deepseekContract.test.ts`, `vitest.config.ts` ; Modify `services/forecastService.ts`, `services/provincesService.ts` ; add `public/forecast_provinces.json` (synced)

- [ ] **Step 1: add Vitest for the pure adapter (the Expo app has no unit runner for pure TS)**
```bash
bun add -d vitest
```
Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['**/*.test.ts'] } });
```
Add script to package.json: `"test:unit": "vitest run"`.

- [ ] **Step 2: sync dev data**
```bash
mkdir -p public
cp /c/Users/ASUS/DeepSeek_Heatwave/docs/forecast_provinces.json public/forecast_provinces.json
node -e "const d=require('./public/forecast_provinces.json'); console.log('provinces', d.n_provinces, 'schema', d.schema_version)"
```
Expected: `provinces 77 schema 1`.

- [ ] **Step 3: failing test `services/deepseekContract.test.ts`:**
```ts
import { describe, it, expect } from 'vitest';
import { mapPoints, provinceDays, RISK_EN_TO_APP } from './deepseekContract';

const sample = {
  schema_version: 1, model: 'logistic_balanced_cal', generated_at: '2026-06-13T09:00:00+00:00', n_provinces: 1,
  provinces: [{
    id: 1, code: 'BKK', name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', region: 'Central',
    lat: 13.75, lon: 100.5, issue_date: '2023-12-31',
    forecasts: [
      { lead_weeks: 2, probability: 0.3858, climatology_base_rate: 0.11, ratio_vs_normal: 3.4, risk_level_th: 'สูงมาก', risk_level_en: 'High' },
      { lead_weeks: 3, probability: 0.20, climatology_base_rate: 0.11, ratio_vs_normal: 1.8, risk_level_th: 'สูง', risk_level_en: 'Elevated' },
      { lead_weeks: 4, probability: 0.12, climatology_base_rate: 0.11, ratio_vs_normal: 1.1, risk_level_th: 'ปกติ', risk_level_en: 'Normal' },
      { lead_weeks: 5, probability: 0.05, climatology_base_rate: 0.11, ratio_vs_normal: 0.4, risk_level_th: 'ต่ำ', risk_level_en: 'Low' },
      { lead_weeks: 6, probability: 0.10, climatology_base_rate: 0.11, ratio_vs_normal: 0.9, risk_level_th: 'ปกติ', risk_level_en: 'Normal' },
    ],
  }],
} as const;

describe('deepseekContract transforms', () => {
  it('risk_level_en -> app RiskLevel', () => {
    expect(RISK_EN_TO_APP.High).toBe('extreme');
    expect(RISK_EN_TO_APP.Elevated).toBe('high');
    expect(RISK_EN_TO_APP.Normal).toBe('moderate');
    expect(RISK_EN_TO_APP.Low).toBe('low');
  });
  it('mapPoints: one per province at lead 2', () => {
    const pts = mapPoints(sample as any);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ province_id: 1, lat: 13.75, lon: 100.5, risk_level: 'extreme' });
    expect(pts[0].target_date).toBe('2024-01-14'); // issue + 14
  });
  it('provinceDays: lead 2-6 with weekly target dates', () => {
    const days = provinceDays(sample as any, 1);
    expect(days).toHaveLength(5);
    expect(days[0].target_date).toBe('2024-01-14');
    expect(days[0].risk_level).toBe('extreme');
    expect(days.at(-1)!.target_date).toBe('2024-02-11'); // issue + 42
    expect(typeof days[0].swbgt_pred).toBe('number');
  });
  it('provinceDays: unknown id -> empty', () => {
    expect(provinceDays(sample as any, 999)).toEqual([]);
  });
});
```
Run: `bun run test:unit` → FAIL (module missing).

- [ ] **Step 4: implement `services/deepseekContract.ts`:**
```ts
import type { MapForecastPoint, ProvinceForecastDay, RiskLevel } from './forecastService';

export const RISK_EN_TO_APP: Record<string, RiskLevel> = {
  Low: 'low', Normal: 'moderate', Elevated: 'high', High: 'extreme',
};

interface RawForecast { lead_weeks: number; probability: number; ratio_vs_normal: number; risk_level_en: string; }
interface RawProvince { id: number; lat: number; lon: number; issue_date: string; forecasts: RawForecast[]; }
export interface Contract { schema_version: number; generated_at: string; provinces: RawProvince[]; }

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function toRisk(en: string): RiskLevel { return RISK_EN_TO_APP[en] ?? 'low'; }
const SEVERITY_RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, extreme: 3 };

/** One map point per province, using lead 2 as the "current" headline value. */
export function mapPoints(c: Contract): MapForecastPoint[] {
  return c.provinces.map((p) => {
    const f = p.forecasts.find((x) => x.lead_weeks === 2) ?? p.forecasts[0];
    return {
      province_id: p.id, lat: p.lat, lon: p.lon,
      probability: f.probability, risk_level: toRisk(f.risk_level_en),
      target_date: addDaysISO(p.issue_date, f.lead_weeks * 7),
      generated_at: c.generated_at, model_version: 'deepseek-prov-v1',
    };
  });
}

/** Per-province "days" = the 2–6 week leads as a weekly outlook series. */
export function provinceDays(c: Contract, provinceId: number): ProvinceForecastDay[] {
  const p = c.provinces.find((x) => x.id === provinceId);
  if (!p) return [];
  return [...p.forecasts].sort((a, b) => a.lead_weeks - b.lead_weeks).map((f) => {
    const risk = toRisk(f.risk_level_en);
    return {
      target_date: addDaysISO(p.issue_date, f.lead_weeks * 7),
      probability: f.probability,
      predicted_label: SEVERITY_RANK[risk] >= SEVERITY_RANK.high,
      risk_level: risk, swbgt_pred: 0, generated_at: c.generated_at,
    };
  });
}

let _cache: Promise<Contract> | null = null;
const FORECAST_URL = process.env.EXPO_PUBLIC_FORECAST_URL || '/forecast_provinces.json';
export function loadContract(): Promise<Contract> {
  if (!_cache) {
    _cache = fetch(FORECAST_URL).then((r) => {
      if (!r.ok) throw new Error(`โหลด forecast ไม่สำเร็จ (${r.status})`);
      return r.json() as Promise<Contract>;
    }).catch((e) => { _cache = null; throw e; });
  }
  return _cache;
}
```

- [ ] **Step 5: rewire `services/forecastService.ts`** — replace ONLY the two fetch functions (`getProvinceForecast`, `getForecastMap`) to use the contract; remove the `import { api } from './apiService'` line if `api` is no longer referenced in the file (it isn't after this change). Replace:
```ts
export function getProvinceForecast(provinceId: number, days: number = 7): Promise<ProvinceForecastDay[]> {
  return api.get<ProvinceForecastDay[]>(`/api/forecast/province/${provinceId}?days=${days}`, { timeoutMs: 45_000 });
}
export function getForecastMap(): Promise<MapForecastPoint[]> {
  return api.get<MapForecastPoint[]>('/api/forecast/map', { timeoutMs: 45_000 });
}
```
with:
```ts
import { loadContract, mapPoints, provinceDays } from './deepseekContract';

export async function getProvinceForecast(provinceId: number, _days: number = 7): Promise<ProvinceForecastDay[]> {
  return provinceDays(await loadContract(), provinceId);
}
export async function getForecastMap(): Promise<MapForecastPoint[]> {
  return mapPoints(await loadContract());
}
```
Delete the now-unused `import { api } from './apiService';` at the top. Keep ALL other exports unchanged.

- [ ] **Step 6: simplify `services/provincesService.ts`** — make `getProvinces` return the bundled list (drop the API call). Find the `getProvinces` function and replace its body so it resolves `FALLBACK_PROVINCES` directly:
```ts
export async function getProvinces(): Promise<Province[]> {
  return FALLBACK_PROVINCES;
}
```
Remove the now-unused `import { api } from './apiService';` if nothing else in the file uses `api`.

- [ ] **Step 7: run tests + build**
Run: `bun run test:unit` → 4 passed. `bunx tsc -b 2>/dev/null || bunx tsc --noEmit` → no NEW type errors in the edited files. `bunx expo export -p web` → still builds.

- [ ] **Step 8: commit**
```bash
git add services/deepseekContract.ts services/deepseekContract.test.ts services/forecastService.ts services/provincesService.ts vitest.config.ts package.json public/forecast_provinces.json
git commit -m "$(printf 'feat: repoint data layer to DeepSeek contract (map+province adapter)\n\nforecastService.getForecastMap/getProvinceForecast now transform\nforecast_provinces.json (lead 2 for map, lead 2-6 for province);\nprovincesService uses bundled list. Types unchanged so screens hold.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Strip Heatwave_AI-specific (LIFF / push / cooling / extra routes)

**Files:** Delete `app/liff.tsx`, `app/checklist.tsx`, `app/prd.tsx`, `services/nearbyPlaces.ts`, `services/NotificationService.ts`, `services/weatherService.ts`, `hooks/useWeather.ts` ; Modify `app/_layout.tsx`, and any screen importing the deleted modules.

- [ ] **Step 1: find all references first**
```bash
cd /c/Users/ASUS/HeatMAP_Frontend
grep -rilE "liff|checklist|/prd|nearbyPlaces|NotificationService|registerForPushNotifications|useWeather|weatherService" app/ components/ hooks/ services/ 2>/dev/null | grep -v node_modules
```
Record the list; every referencing import must be removed when its target is deleted.

- [ ] **Step 2: edit `app/_layout.tsx`** — remove the push-notification wiring + the stripped routes:
- Delete `import { registerForPushNotificationsAsync } from '@/services/NotificationService';`
- Delete the `useEffect(() => { registerForPushNotificationsAsync()... }, [])` block entirely.
- In the `<Stack>`, delete the `<Stack.Screen name="checklist" .../>`, `<Stack.Screen name="prd" .../>`, and `<Stack.Screen name="liff" .../>` lines. (Keep `(tabs)` and `modal`.)

- [ ] **Step 3: delete the files**
```bash
rm -f app/liff.tsx app/checklist.tsx app/prd.tsx services/nearbyPlaces.ts services/NotificationService.ts services/weatherService.ts hooks/useWeather.ts
```

- [ ] **Step 4: remove dangling imports** — for each file in the Step-1 list that still imports a deleted module (e.g. `app/(tabs)/settings.tsx` may import apiService/checklist link; `app/(tabs)/alerts.tsx` imports `useWeather`; `ProvinceForecastPanel` may use nearbyPlaces), open it and remove the import + the feature block that used it (e.g. a "cooling centres nearby" section, a "checklist" link button, the `useWeather()` call + its UI). Keep the screen otherwise intact. Re-run the grep until it returns nothing for deleted modules.
Note: `app/(tabs)/alerts.tsx` imports `useWeather` — its weather usage will be removed here; alerts is fully reworked in Task 4 regardless.

- [ ] **Step 5: build passes**
Run: `bunx expo export -p web` → builds with no missing-module/import errors. `bun run test:unit` → still 4 passed.

- [ ] **Step 6: commit**
```bash
git add -A
git commit -m "$(printf 'chore: strip LIFF/push/cooling-centres + extra routes\n\nRemove Heatwave_AI-specific features not backed by the DeepSeek\ncontract; clean up _layout routes and dangling imports.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: alerts.tsx — daily calendar → weekly 2–6 week outlook

**Files:** Modify `app/(tabs)/alerts.tsx`

Context: `alerts.tsx` calls `useProvinceForecast(provinceId, 7)` → after Task 2 this returns the **5 weekly** `ProvinceForecastDay` (lead 2–6), NOT 7 daily. The file builds a month calendar via `buildMonthGrid`/`CalendarDay` and renders day cells — that no longer fits. Convert it to a weekly outlook list. Keep the screen's header, the selected-province summary, the tier helpers (`getAlertTier`/`alertTierColor`/`alertTierLabel`), and overall styling/theme.

- [ ] **Step 1: read the whole file** `app/(tabs)/alerts.tsx` to understand its current structure (header, province summary, `calendar`/`buildMonthGrid` block, the day-grid JSX around lines ~450–510, the metrics/daily sections).

- [ ] **Step 2: remove the daily-calendar machinery**
- Delete `interface CalendarDay`, `function buildMonthGrid`, the `calendar`/`buildMonthGrid` `useMemo`/destructure, and the calendar-grid JSX (weekday header row, blank-cell padding, day-number cells). Remove now-unused imports.

- [ ] **Step 3: render a weekly outlook from the 5 ProvinceForecastDay**
Replace the calendar block with an outlook list. The hook gives `provinceDays: ProvinceForecastDay[]` (5 entries, lead 2→6 in order). For each, show: the **week label** ("สัปดาห์ที่ N" / "Week N" where N = index+2), the target date via the existing `formatForecastDate(day.target_date)`, the probability via `riskPercent(day.probability)`%, and a tier chip via `getAlertTier(day.probability)` + `alertTierColor(tier, isDark)` + `alertTierLabel(tier, lang)`. Use the screen's existing `ScaledText`/styles. Example block (adapt to the file's existing style tokens/components):
```tsx
{provinceDays.map((day, i) => {
  const tier = getAlertTier(day.probability);
  return (
    <View key={day.target_date} style={styles.weekRow}>
      <View>
        <ScaledText style={styles.weekTitle}>
          {lang === 'th' ? `สัปดาห์ที่ ${i + 2}` : `Week ${i + 2}`}
        </ScaledText>
        <ScaledText style={styles.weekDate}>{formatForecastDate(day.target_date)}</ScaledText>
      </View>
      <View style={styles.weekRight}>
        <ScaledText style={[styles.weekPct, { color: alertTierColor(tier, isDark) }]}>
          {riskPercent(day.probability)}%
        </ScaledText>
        <ScaledText style={[styles.weekTier, { color: alertTierColor(tier, isDark) }]}>
          {alertTierLabel(tier, lang)}
        </ScaledText>
      </View>
    </View>
  );
})}
```
Add the small `styles.weekRow/weekTitle/weekDate/weekRight/weekPct/weekTier` entries to the file's StyleSheet (row layout: `flexDirection:'row'`, `justifyContent:'space-between'`, padding, divider borderBottom). Import `riskPercent`, `formatForecastDate`, `getAlertTier`, `alertTierColor`, `alertTierLabel` from `forecastService` if not already imported.

- [ ] **Step 4: fix the header/copy** — change any "7-day"/"+2H"/"this month"/daily wording in this screen to weekly/outlook wording ("แนวโน้ม 2–6 สัปดาห์" / "2–6 week outlook"). Remove leftover daily-only UI (e.g. a "+2H forecast" hero or `METRICS`/`daily` sections that depended on hourly/daily data the contract lacks — if present and unbacked, remove them).

- [ ] **Step 5: build + sanity**
Run: `bunx expo export -p web` → builds. `bun run test:unit` → 4 passed. Manually reason that `alerts.tsx` no longer references `CalendarDay`/`buildMonthGrid`/`useWeather`/daily-only fields (`grep -nE "CalendarDay|buildMonthGrid|useWeather|swbgt" "app/(tabs)/alerts.tsx"` → empty).

- [ ] **Step 6: commit**
```bash
git add "app/(tabs)/alerts.tsx"
git commit -m "$(printf 'feat: alerts screen -> weekly 2-6 week outlook (was daily calendar)\n\nDeepSeek is sub-seasonal weekly; replace the month-grid calendar with\na lead 2-6 outlook list reusing the existing tier helpers + styling.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: end-to-end run + env + README

**Files:** `.env.example`, `README.md`

- [ ] **Step 1: env** — create `.env.example`:
```
# Where the app reads the DeepSeek forecast bridge contract.
# Dev: the bundled public/forecast_provinces.json (synced from DeepSeek).
# Prod: the published URL (e.g. DeepSeek GitHub Pages).
EXPO_PUBLIC_FORECAST_URL=/forecast_provinces.json
```
Ensure `public/forecast_provinces.json` is served on web (Expo serves `public/` at root on web; if not picked up, also copy to the web output/`assets/` per Expo's static asset convention and note it).

- [ ] **Step 2: run web + verify the 3 screens end-to-end**
```bash
bunx expo start --web
```
Verify in the browser:
- MAP: 77 provinces render colored from the contract (lead 2); tap a province → its detail/panel opens.
- ALERTS: shows the weekly 2–6 week outlook for the selected province (no calendar, no errors).
- SETTINGS: province selector + theme/lang work.
Record what you saw. (If `expo start --web` is heavy/blocked, `bunx expo export -p web && bunx serve dist` is an alternative.)

- [ ] **Step 3: README.md** — document: decoupled Expo web app using the user's HeatMAP design; reads DeepSeek `forecast_provinces.json` via `EXPO_PUBLIC_FORECAST_URL` (sync from `DeepSeek_Heatwave/docs/`); `bun install`, `bun run web`, `bunx expo export -p web`, `bun run test:unit`; note it's decoupled (no Heatwave_AI backend, no DeepSeek toolchain).

- [ ] **Step 4: commit**
```bash
git add .env.example README.md
git commit -m "$(printf 'docs: env (forecast bridge URL) + README for HeatMAP port\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Acceptance criteria
1. `HeatMAP_Frontend` รัน `bun install` + `bunx expo export -p web` ได้ไม่ error
2. data layer อ่านจาก `forecast_provinces.json` (adapter unit tests 4 ผ่าน) — ไม่มีการเรียก Render API เหลือ
3. MAP โชว์ 77 จังหวัดจาก contract (lead 2), tap → detail ; province detail = outlook lead 2–6
4. ALERTS = weekly outlook (ไม่มีปฏิทินรายวัน/`buildMonthGrid`/`useWeather` เหลือ)
5. LIFF/checklist/prd/cooling/push ถูก strip ; build ไม่มี import ค้าง
6. ไม่แตะ Heatwave_AI และ DeepSeek_Heatwave ; อ่านผ่าน `EXPO_PUBLIC_FORECAST_URL`

## Self-Review (ผู้เขียนตรวจแล้ว)
- **Spec coverage:** §3 copy→T1 ; §4 data bridge→T2 ; §5 semantics(alerts)→T4 ; §6 strip→T3 ; §7 run/deploy/env→T5
- **Placeholder scan:** code เต็มสำหรับ data layer (T2) + strip edits (T3) + env/README (T5) ; alerts (T4) เป็น modification ของไฟล์ใหญ่ที่มีอยู่ → สั่งให้ "อ่านไฟล์ก่อนแก้" + ให้ block แทน + เกณฑ์ grep ชัด (แนวทางที่ถูกสำหรับแก้ไฟล์ใหญ่ที่มีอยู่)
- **Type consistency:** adapter ใช้ `MapForecastPoint/ProvinceForecastDay/RiskLevel` จาก forecastService (import type) — ตรงกับที่ map/alerts/hook ใช้ ; `mapPoints/provinceDays/RISK_EN_TO_APP/loadContract` ตั้งใน T2 ใช้ใน forecastService rewire ; risk mapping ตรง spec §10
- **ความเสี่ยง:** (ก) `expo export -p web` กับ react-native-maps อาจ error บน web — ถ้าใช่ ตรวจว่า map ใช้ web path (leaflet) ; (ข) T4 alerts ต้องอ่านไฟล์จริงก่อนแก้ (โครงเฉพาะ) ; (ค) public/ asset serving บน Expo web — เผื่อ fallback ไป assets/
