import { loadContract, mapPoints, provinceDays } from './deepseekContract';
import type { Province } from './provincesService';
import { getWeek1Map } from './openMeteoService';
import type { HeatLevel } from '@/constants/heatRisk';
import { levelFromRiskLevel } from '@/constants/heatRisk';
import { formatTimestampBangkok } from '@/utils/bangkokTime';

// ─── Per-province forecast (spec §7 / Phase 5) ────────────────────────────────

/** 4-tier risk level emitted by the backend (calibrated probability → bucket). */
export type RiskLevel = 'Low' | 'Normal' | 'Elevated' | 'High';

/**
 * One day of per-province forecast.
 * Shape per spec §7:
 *   GET /api/forecast/province/:id?days=7
 *   -> [{ target_date, probability, predicted_label, risk_level, swbgt_pred, generated_at }]
 */
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

/**
 * Latest forecast value for one province on the map.
 * Shape per spec §7 (Weeks 2-4, S2S model) or Open-Meteo (Week 1).
 *
 * Week 1 notes:
 *   - `probability` is undefined (Open-Meteo has no probability output)
 *   - `apparent_temp_c` carries the peak 7-day apparent temperature (°C)
 *   - `heat_level` is the pre-computed canonical HeatLevel (0-4)
 *   - `ratio_vs_normal` / `climatology_base_rate` are NaN for Week 1
 */
export interface MapForecastPoint {
  province_id: number;
  lat: number;
  lon: number;
  /** Calibrated probability 0-1 (Weeks 2-4 only; undefined for Week 1) */
  probability?: number;
  risk_level: RiskLevel;
  risk_level_th: string;
  ratio_vs_normal: number;
  climatology_base_rate: number;
  target_date: string;
  generated_at: string;
  issue_date: string;
  model_version?: string;
  /** Week 1 only: peak apparent temperature over the 7-day window (°C, from Open-Meteo) */
  apparent_temp_c?: number;
  /** Pre-computed canonical heat level (0-4). Populated for Week 1; derived on-the-fly for Weeks 2-4. */
  heat_level?: HeatLevel;
}

/** Fetch the 5-week outlook for a single province. */
export async function getProvinceForecast(provinceId: number): Promise<ProvinceForecastDay[]> {
  return provinceDays(await loadContract(), provinceId);
}

/** Fetch the latest forecast value for every province (for the map). */
export async function getForecastMap(leadWeeks: number = 2): Promise<MapForecastPoint[]> {
  return mapPoints(await loadContract(), leadWeeks);
}

/**
 * Unified entry point for all 4 forecast weeks.
 *   week === 1  → Open-Meteo 7-day apparent temperature forecast
 *   week 2-4   → S2S model (existing getForecastMap)
 *
 * This is the single branch point; map.tsx should call only this function.
 */
export async function getWeekData(
  week: 1 | 2 | 3 | 4,
  provinces: Province[],
): Promise<MapForecastPoint[]> {
  if (week === 1) return getWeek1Map(provinces);
  return getForecastMap(week);
}

/**
 * Returns the national-worst HeatLevel for each of the 4 forecast weeks.
 * Used to colour the risk dots on each week-selector pill.
 *
 * Weeks 2-4 are derived from a single loadContract() call (cached).
 * Week 1 is derived from Open-Meteo (cached per Bangkok day).
 * On error any week defaults to 0 (None) so the UI still renders.
 */
export async function getAllWeekSummaries(
  provinces: Province[],
): Promise<Record<1 | 2 | 3 | 4, HeatLevel>> {
  const result: Record<1 | 2 | 3 | 4, HeatLevel> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  // Weeks 2-4: one contract load, three passes
  try {
    const contract = await loadContract();
    for (const week of [2, 3, 4] as const) {
      const pts = mapPoints(contract, week);
      result[week] = pts.reduce<HeatLevel>((best, pt) => {
        const lv = levelFromRiskLevel(pt.risk_level);
        return lv > best ? lv : best;
      }, 0);
    }
  } catch { /* keep defaults */ }

  // Week 1: Open-Meteo
  try {
    const pts = await getWeek1Map(provinces);
    result[1] = pts.reduce<HeatLevel>((best, pt) => {
      const lv = (pt.heat_level ?? 0) as HeatLevel;
      return lv > best ? lv : best;
    }, 0);
  } catch { /* keep default */ }

  return result;
}


/**
 * Format an ISO `generated_at` timestamp into a localized "as of" string.
 * Pinned to Asia/Bangkok timezone and locale-aware (th/en).
 * Returns an empty string for missing/invalid input.
 */
export function formatGeneratedAt(
  iso: string | null | undefined,
  lang: 'th' | 'en' = 'th',
): string {
  return formatTimestampBangkok(iso, lang);
}


// ─── Two-tier alert (watch / warning) ────────────────────────────────────────

export type AlertTier = 'warning' | 'watch' | 'none';


/** Server `risk_level` → two-tier alert: High→warning, Elevated→watch. */
export function alertTierFromRiskLevel(risk: RiskLevel | string | null | undefined): AlertTier {
  if (risk === 'High')     return 'warning';
  if (risk === 'Elevated') return 'watch';
  return 'none';
}


/** Localized label for an alert tier (th / en). */
export function alertTierLabel(tier: AlertTier, lang: 'th' | 'en' = 'th'): string {
  const map = {
    warning: { th: 'เตือนภัย', en: 'Warning' },
    watch: { th: 'เฝ้าระวัง', en: 'Watch' },
    none: { th: 'ปกติ', en: 'Normal' },
  } as const;
  return map[tier][lang];
}

/** Display color for an alert tier (red / amber / green), dark-mode aware so it
 *  tracks the app theme rather than a single hardcoded palette. */
export function alertTierColor(tier: AlertTier, isDark: boolean = false): string {
  switch (tier) {
    case 'warning': return isDark ? '#ff6b5e' : '#dc2626';
    case 'watch':   return isDark ? '#ffc14d' : '#b45309';
    default:        return isDark ? '#5fa180' : '#3c6e57';
  }
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'High':     return '#dc2626';
    case 'Elevated': return '#b45309';
    case 'Normal':   return '#16a34a';
    default:         return '#64748b'; // Low
  }
}

/** Calibrated probability (0–1) → integer percent, for public "risk N%" display. */
export function riskPercent(probability: number | null | undefined): number {
  return Math.round(((probability ?? 0) as number) * 100);
}

/** true ถ้า issue_date เก่ากว่า staleDays เทียบ generatedAt (ใช้ตัดสินว่าโชว์ banner historical ไหม) */
export function isHistoricalRun(
  issueDate?: string,
  generatedAt?: string,
  staleDays = 14,
): boolean {
  if (!issueDate) return false;
  const ref = generatedAt ? new Date(generatedAt) : new Date();
  const issued = new Date(issueDate + 'T00:00:00Z');
  const ageDays = (ref.getTime() - issued.getTime()) / 86_400_000;
  return ageDays > staleDays;
}

export function formatForecastDate(dateStr: string): string {
  // Parse as UTC to avoid the date shifting by one day in negative-offset timezones.
  // Dates from the server are plain YYYY-MM-DD strings (no time component), so we
  // append T00:00:00Z to force UTC interpretation before formatting.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00Z` : dateStr;
  const date = new Date(normalized);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
