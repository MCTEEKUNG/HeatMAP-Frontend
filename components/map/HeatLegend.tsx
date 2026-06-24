/**
 * HeatLegend — Compact horizontal legend for the HeatRisk 5-level colour scale.
 *
 * A single continuous strip of 5 colour cells (each with its 0-4 number and a
 * short label) reads as a "scale" at a glance and reclaims the ~300px the old
 * 5-row stack consumed. Rendered inside the userCard glass panel, so it carries
 * no glass of its own (avoids a double-blur).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HEAT_LEVELS } from '@/constants/heatRisk';
import { FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';

interface Props {
  /** Which week is currently selected — used to show the appropriate metric footnote */
  selectedWeek: 1 | 2 | 3 | 4;
}

export function HeatLegend({ selectedWeek }: Props) {
  const { isDarkMode, language } = useSettings();
  const textMuted = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const textColor = isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.72)';

  const footnote = selectedWeek === 1
    ? (language === 'th'
        ? 'Week 1: อุณหภูมิสัมผัสสูงสุด (Open-Meteo)'
        : 'Week 1: peak apparent temp (Open-Meteo)')
    : (language === 'th'
        ? `Week ${selectedWeek}: ความน่าจะเป็น (โมเดล S2S)`
        : `Week ${selectedWeek}: risk probability (S2S model)`);

  return (
    <View style={styles.container}>
      {/* Continuous 5-cell colour strip */}
      <View style={styles.strip}>
        {HEAT_LEVELS.map((d, i) => (
          <View
            key={d.level}
            style={[
              styles.cell,
              { backgroundColor: d.color },
              i === 0 && styles.cellFirst,
              i === HEAT_LEVELS.length - 1 && styles.cellLast,
            ]}
          >
            <ScaledText
              style={[styles.cellNum, { color: d.level >= 2 ? '#fff' : 'rgba(0,0,0,0.7)' }]}
            >
              {d.level}
            </ScaledText>
            <ScaledText
              style={[styles.cellLabel, { color: d.level >= 2 ? '#fff' : 'rgba(0,0,0,0.7)' }]}
              numberOfLines={1}
            >
              {language === 'th' ? d.labelTh : d.labelEn}
            </ScaledText>
          </View>
        ))}
      </View>

      {/* Metric footnote */}
      <ScaledText style={[styles.footnote, { color: textMuted }]} numberOfLines={1}>
        {footnote}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 5,
  },
  strip: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    gap: 1,
  },
  cellFirst: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  cellLast: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  cellNum: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
    lineHeight: 13,
  },
  cellLabel: {
    fontSize: 8,
    fontFamily: FontFamily.bodyMedium,
    lineHeight: 10,
  },
  footnote: {
    fontSize: 9,
    fontFamily: FontFamily.body,
    lineHeight: 12,
  },
});
