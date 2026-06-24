/**
 * SummaryBar — Floating glass bar at the top of the map screen.
 *
 * Shows:
 *   - App/screen title ("แผนที่ความเสี่ยงคลื่นความร้อน")
 *   - Selected week's date range in Bangkok time
 *   - Province count chip (watch / warning tally) when data is ready
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GlassStyle, FontFamily, type RiskLevel } from '@/constants/theme';
import { colorForLevel, levelFromRiskLevel } from '@/constants/heatRisk';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { formatWeekRange } from '@/utils/bangkokTime';

interface Props {
  selectedWeek: 1 | 2 | 3 | 4;
  /** Number of provinces at watch level (Elevated) */
  watchCount: number;
  /** Number of provinces at warning level (High) */
  warnCount: number;
  dataReady: boolean;
}

export function SummaryBar({ selectedWeek, watchCount, warnCount, dataReady }: Props) {
  const { isDarkMode, language } = useSettings();
  const glass = GlassStyle[isDarkMode ? 'dark' : 'light'];
  const textColor  = isDarkMode ? 'rgba(255,255,255,0.9)'  : 'rgba(0,0,0,0.82)';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const primaryColor = isDarkMode ? '#7FA3C8' : '#16324F';

  const title = language === 'th'
    ? 'แผนที่ความเสี่ยงคลื่นความร้อน'
    : 'Heatwave Risk Map';

  const dateRange = formatWeekRange(selectedWeek, language as 'th' | 'en');

  // Build a human-readable national summary
  const hasDanger = warnCount > 0 || watchCount > 0;
  let summaryText = '';
  if (dataReady && hasDanger) {
    if (language === 'th') {
      const parts: string[] = [];
      if (warnCount > 0) parts.push(`เตือนภัย ${warnCount} จว.`);
      if (watchCount > 0) parts.push(`เฝ้าระวัง ${watchCount} จว.`);
      summaryText = parts.join(' · ');
    } else {
      const parts: string[] = [];
      if (warnCount > 0) parts.push(`Warning: ${warnCount} prov.`);
      if (watchCount > 0) parts.push(`Watch: ${watchCount} prov.`);
      summaryText = parts.join(' · ');
    }
  }

  // Chip color = worst tier present
  const chipLevel = warnCount > 0 ? levelFromRiskLevel('High') : levelFromRiskLevel('Elevated');
  const chipColor = hasDanger ? colorForLevel(chipLevel) : 'transparent';

  return (
    <View style={[styles.bar, glass]}>
      <View style={styles.left}>
        <ScaledText style={[styles.title, { color: primaryColor }]} numberOfLines={1}>
          {title}
        </ScaledText>
        <ScaledText style={[styles.dateRange, { color: mutedColor }]} numberOfLines={1}>
          {dateRange}
        </ScaledText>
      </View>

      {dataReady && hasDanger && (
        <View style={[styles.chip, { backgroundColor: chipColor + '22' }]}>
          <View style={[styles.dot, { backgroundColor: chipColor }]} />
          <ScaledText style={[styles.chipText, { color: chipColor }]} numberOfLines={1}>
            {summaryText}
          </ScaledText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 10,
  },
  left: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 13,
    fontFamily: FontFamily.display,
    fontWeight: '700',
  },
  dateRange: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
  },
});
