import { descriptorForLevel, type HeatLevel } from '@/constants/heatRisk';
import type { OutlookPoint } from '@/services/forecastService';

export function humanRiskText(point: OutlookPoint | null | undefined, th: boolean): string {
  if (!point || !point.available) return th ? 'ยังไม่มีข้อมูล' : 'No data yet';
  if (point.source === 'open-meteo') return point.valueText || (th ? 'ดูอุณหภูมิ' : 'Check heat');

  const band = descriptorForLevel(point.level as HeatLevel);
  return th ? band.labelTh : band.labelEn;
}

export function modelEvidenceText(point: OutlookPoint | null | undefined, th: boolean): string {
  if (!point || !point.available) return th ? 'ยังไม่มีข้อมูลสำหรับสัปดาห์นี้' : 'No data for this week yet';
  if (point.source === 'open-meteo') {
    return th
      ? `อุณหภูมิสัมผัสสูงสุด${point.valueText ? ` · ${point.valueText}` : ''}`
      : `Peak feels-like temperature${point.valueText ? ` · ${point.valueText}` : ''}`;
  }
  return th ? 'ประเมินจากโมเดลพยากรณ์ล่วงหน้า' : 'Estimated from the forward forecast model';
}
