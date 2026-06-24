/**
 * openMeteoService.ts — Week 1 forecast data from Open-Meteo.
 *
 * The S2S heatwave model only has lead_weeks 2–6 (no short-range Week 1).
 * For Week 1 (today..+6 days) we call the free Open-Meteo API which returns
 * NWP-based daily apparent_temperature_max — more skilful than S2S at 1-7 days.
 *
 * API: https://open-meteo.com/en/docs
 * - Batch request: all 77 province centroids in a single HTTP call (comma-separated).
 * - Results arrive as a JSON **array** in the same order as the request parameters.
 * - No API key required. Free tier: ~10 000 req/day (one batched call per visitor/day).
 *
 * Caching strategy:
 *   - Module-level promise cached for the Bangkok calendar day (refreshes midnight BKK).
 *   - Also persisted to sessionStorage on web so a page reload within the same
 *     browser session skips the network call entirely.
 *   - On fetch error: cache is cleared and the error re-thrown so map.tsx shows retry.
 *   - Per-province failure: that province gets level 0 (None) — partial data beats
 *     a whole-map error.
 */

import type { Province } from '@/services/provincesService';
import type { MapForecastPoint } from '@/services/forecastService';
import { levelFromApparentTempC } from '@/constants/heatRisk';
import { todayBangkokISO } from '@/utils/bangkokTime';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const SESSION_KEY = 'openMeteo_week1';

// ─── Cache ────────────────────────────────────────────────────────────────────

let _cacheDate: string | null = null;
let _cachePromise: Promise<MapForecastPoint[]> | null = null;

function clearCache() {
  _cacheDate = null;
  _cachePromise = null;
  try { typeof window !== 'undefined' && sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function trySessionCache(): MapForecastPoint[] | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { date, data } = JSON.parse(raw);
    if (date !== todayBangkokISO()) return null;
    return data as MapForecastPoint[];
  } catch {
    return null;
  }
}

function saveSessionCache(date: string, data: MapForecastPoint[]) {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ date, data }));
  } catch { /* ignore — sessionStorage may be full or unavailable */ }
}

// ─── Open-Meteo response types ────────────────────────────────────────────────

interface OpenMeteoLocation {
  latitude: number;
  longitude: number;
  daily?: {
    time: string[];
    apparent_temperature_max: (number | null)[];
  };
  error?: boolean;
  reason?: string;
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function fetchWeek1(provinces: Province[]): Promise<MapForecastPoint[]> {
  // Check sessionStorage first (warm reload within same browser session)
  const cached = trySessionCache();
  if (cached) return cached;

  const lats = provinces.map((p) => p.lat.toFixed(4)).join(',');
  const lons = provinces.map((p) => p.lon.toFixed(4)).join(',');

  const url =
    `${BASE_URL}?latitude=${lats}&longitude=${lons}` +
    `&daily=apparent_temperature_max&timezone=Asia%2FBangkok&forecast_days=7`;

  let raw: OpenMeteoLocation | OpenMeteoLocation[];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    clearCache();
    throw err;
  }

  // Open-Meteo returns a single object for 1 location, array for multiple.
  const locations: OpenMeteoLocation[] = Array.isArray(raw) ? raw : [raw];

  const today = todayBangkokISO();
  const now   = new Date().toISOString();

  const points: MapForecastPoint[] = provinces.map((prov, i) => {
    const loc = locations[i];
    const dailyMax: number[] = (loc?.daily?.apparent_temperature_max ?? []).filter(
      (v): v is number => v !== null,
    );
    // Take the peak apparent temp over the 7-day Week 1 window.
    const peakTempC = dailyMax.length > 0 ? Math.max(...dailyMax) : NaN;
    const heatLevel = isNaN(peakTempC) ? 0 : levelFromApparentTempC(peakTempC);

    // Map heat level back to the legacy RiskLevel string so existing consumers
    // (map.tsx severity switch, choropleth level derivation) still work.
    const riskLevelMap = ['Low', 'Normal', 'Elevated', 'High', 'High'] as const;
    const risk_level = riskLevelMap[heatLevel] as MapForecastPoint['risk_level'];

    return {
      province_id:           prov.id,
      lat:                   prov.lat,
      lon:                   prov.lon,
      probability:           undefined as unknown as number, // Week 1 has no probability
      risk_level,
      risk_level_th:         '',   // filled by caller if needed
      ratio_vs_normal:       NaN,  // not applicable for NWP data
      climatology_base_rate: NaN,
      target_date:           today,
      issue_date:            today,
      generated_at:          now,
      // Week-1–specific extensions
      apparent_temp_c:       isNaN(peakTempC) ? undefined : Math.round(peakTempC * 10) / 10,
      heat_level:            heatLevel,
    };
  });

  saveSessionCache(today, points);
  return points;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches Week 1 (today..+6 day) apparent heat forecast for all 77 provinces
 * from Open-Meteo in a single batched HTTP request.
 *
 * Results are cached per Bangkok calendar day (module-level + sessionStorage).
 * On error the cache is cleared so the next call retries the network.
 */
export function getWeek1Map(provinces: Province[]): Promise<MapForecastPoint[]> {
  const today = todayBangkokISO();

  // Invalidate if day rolled over in Bangkok
  if (_cacheDate !== today) {
    _cacheDate = null;
    _cachePromise = null;
  }

  if (!_cachePromise) {
    _cacheDate    = today;
    _cachePromise = fetchWeek1(provinces).catch((err) => {
      clearCache();
      throw err;
    });
  }

  return _cachePromise;
}
