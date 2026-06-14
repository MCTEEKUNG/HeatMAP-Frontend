import { describe, it, expect } from 'vitest';
import { mapPoints, provinceDays, RISK_EN_TO_APP, assertContract } from './deepseekContract';

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
    expect(pts[0].target_date).toBe('2024-01-14');
    expect(pts[0].issue_date).toBe('2023-12-31');
  });
  it('provinceDays: lead 2-6 with weekly target dates', () => {
    const days = provinceDays(sample as any, 1);
    expect(days).toHaveLength(5);
    expect(days[0].target_date).toBe('2024-01-14');
    expect(days[0].risk_level).toBe('extreme');
    expect(days.at(-1)!.target_date).toBe('2024-02-11');
    expect(typeof days[0].swbgt_pred).toBe('number');
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
