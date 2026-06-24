/**
 * heatRisk.ts — Canonical single source of truth for the 5-level HeatRisk scale.
 *
 * Replaces the three divergent colour palettes that existed before:
 *   1. RiskColors / RiskBg  (theme.ts)         — muted "Calm Authority" palette
 *   2. getSeverityColor     (MapGrid.tsx)       — bright RGBA for grid polygons
 *   3. getRiskColor         (forecastService.ts) — #dc2626-style hex values
 *
 * Scale maps the Thai Meteorological Department (TMD) heat-index bands to the
 * NWS HeatRisk 5-level ordinal colour scheme (international standard for heat).
 *
 * Week 1 data source : Open-Meteo apparent_temperature_max → levelFromApparentTempC
 * Weeks 2-4 source   : S2S model risk_level (Low/Normal/Elevated/High) → levelFromRiskLevel
 *
 * NOTE: S2S model never reaches level 4 (Extreme / magenta).
 *       Level 4 is only reachable via Week 1 temperatures (≥ 52 °C feels-like — very rare).
 */

import type { RiskLevel } from '@/services/forecastService';

// ─── Types ────────────────────────────────────────────────────────────────────

/** 0 = None (safest) … 4 = Extreme (most dangerous) */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** Severity string used internally by MapGrid (kept for bridge compatibility). */
export type Severity = 'extreme' | 'high' | 'moderate' | 'low' | 'neutral';

// ─── Level descriptors ────────────────────────────────────────────────────────

export interface HeatLevelDescriptor {
  level: HeatLevel;
  /** Choropleth / overlay fill colour */
  color: string;
  /** Soft chip / badge background */
  bg: string;
  /** Short English label */
  labelEn: string;
  /** Short Thai label */
  labelTh: string;
  /** Minimum apparent temperature (°C) that triggers this level (Week 1 adapter) */
  minTempC: number;
}

export const HEAT_LEVELS: HeatLevelDescriptor[] = [
  { level: 0, color: '#DCEBD8', bg: '#EAF3EE', labelEn: 'None',     labelTh: 'ปกติ',          minTempC: -Infinity },
  { level: 1, color: '#FCE33A', bg: '#FEFAE1', labelEn: 'Minor',    labelTh: 'เฝ้าระวัง',     minTempC: 27 },
  { level: 2, color: '#F39C2C', bg: '#FDF0DC', labelEn: 'Moderate', labelTh: 'อันตราย',       minTempC: 33 },
  { level: 3, color: '#E5352B', bg: '#FAE3E1', labelEn: 'Major',    labelTh: 'อันตรายมาก',   minTempC: 42 },
  { level: 4, color: '#9B1B9B', bg: '#F3E0F3', labelEn: 'Extreme',  labelTh: 'อันตรายสูงสุด', minTempC: 52 },
];

// ─── Core colour accessor (the ONE colour function used everywhere) ────────────

/**
 * Returns the choropleth fill colour for the given HeatLevel.
 * `isDark` is reserved for future dark-mode variant colours; currently the
 * HeatRisk palette is identical in both modes (it encodes data, not chrome).
 */
export function colorForLevel(level: HeatLevel, _isDark?: boolean): string {
  return HEAT_LEVELS[level]?.color ?? HEAT_LEVELS[0].color;
}

/** Soft chip/badge background for the given level. */
export function bgForLevel(level: HeatLevel): string {
  return HEAT_LEVELS[level]?.bg ?? HEAT_LEVELS[0].bg;
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

/**
 * Week 1 adapter: apparent_temperature_max (°C, from Open-Meteo) → HeatLevel.
 * Thresholds align with Thai Meteorological Department (TMD) heat-index categories.
 *
 *  < 27 °C  → 0 None
 * 27–32.9   → 1 Minor    (TMD: Caution)
 * 33–41.9   → 2 Moderate (TMD: Warning)
 * 42–51.9   → 3 Major    (TMD: Danger)
 *  ≥ 52     → 4 Extreme  (TMD: Extreme Danger)
 */
export function levelFromApparentTempC(tempC: number): HeatLevel {
  if (tempC >= 52) return 4;
  if (tempC >= 42) return 3;
  if (tempC >= 33) return 2;
  if (tempC >= 27) return 1;
  return 0;
}

/**
 * Weeks 2-4 adapter: S2S model risk_level string → HeatLevel.
 * Maps the 4-tier S2S output onto the 5-level scale.
 * Note: S2S never produces level 4 (Extreme / ≥52 °C feels-like).
 */
export function levelFromRiskLevel(rl: RiskLevel | string | null | undefined): HeatLevel {
  switch (rl) {
    case 'High':     return 3;
    case 'Elevated': return 2;
    case 'Normal':   return 1;
    default:         return 0; // 'Low' or unknown
  }
}

/**
 * Bridge for legacy MapGrid Severity strings.
 * 'neutral' (no-data / loading) returns 0 so it renders as the None colour;
 * callers should separately pass `neutral={true}` to MapGrid to show grey instead.
 */
export function levelFromSeverity(sev: Severity): HeatLevel {
  switch (sev) {
    case 'extreme':  return 3; // S2S top tier = Major (3), not Extreme (4)
    case 'high':     return 2;
    case 'moderate': return 1;
    case 'low':      return 0;
    case 'neutral':  return 0;
  }
}

/** Convenience: return the full descriptor for a level. */
export function descriptorForLevel(level: HeatLevel): HeatLevelDescriptor {
  return HEAT_LEVELS[level] ?? HEAT_LEVELS[0];
}
