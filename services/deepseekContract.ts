import type { MapForecastPoint, ProvinceForecastDay, RiskLevel } from './forecastService';

export const RISK_EN_TO_APP: Record<string, RiskLevel> = {
  Low: 'low', Normal: 'moderate', Elevated: 'high', High: 'extreme',
};

interface RawForecast { lead_weeks: number; probability: number; ratio_vs_normal: number; risk_level_en: string; }
interface RawProvince { id: number; lat: number; lon: number; issue_date: string; forecasts: RawForecast[]; }
export interface Contract { schema_version: number; generated_at: string; provinces: RawProvince[]; }

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
function toRisk(en: string): RiskLevel { return RISK_EN_TO_APP[en] ?? 'low'; }
const SEVERITY_RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, extreme: 3 };

export function mapPoints(c: Contract): MapForecastPoint[] {
  return c.provinces.map((p) => {
    const f = p.forecasts.find((x) => x.lead_weeks === 2) ?? p.forecasts[0];
    return {
      province_id: p.id, lat: p.lat, lon: p.lon,
      probability: f.probability, risk_level: toRisk(f.risk_level_en),
      target_date: addDaysISO(p.issue_date, f.lead_weeks * 7),
      issue_date: p.issue_date,
      generated_at: c.generated_at, model_version: 'deepseek-prov-v1',
    };
  });
}

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
    _cache = fetch(FORECAST_URL).then(async (r) => {
      if (!r.ok) throw new Error(`โหลด forecast ไม่สำเร็จ (${r.status})`);
      return assertContract((await r.json()) as Contract);
    }).catch((e) => { _cache = null; throw e; });
  }
  return _cache;
}
