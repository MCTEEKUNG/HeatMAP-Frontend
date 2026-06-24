/**
 * HeatLegend — Persistent floating legend for the HeatRisk 5-level colour scale.
 *
 * Displays all 5 risk levels with:
 *   - Colour swatch
 *   - Numeric badge (0-4) for colorblind safety
 *   - Thai/English label
 *   - Footnote disclosing the metric difference between Week 1 and Weeks 2-4
 *
 * Placed at the bottom of the map screen (inside the userCard area) so it never
 * overlaps the coloured province choropleth.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HEAT_LEVELS } from '@/constants/heatRisk';
import { GlassStyle, FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';

interface Props {
  /** Which week is currently selected — used to show the appropriate metric footnote */
  selectedWeek: 1 | 2 | 3 | 4;
}

export function HeatLegend({ selectedWeek }: Props) {
  const { isDarkMode, language } = useSettings();
  const glass = GlassStyle.panel[isDarkMode ? 'dark' : 'light'];
  const textMuted = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const textColor = isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)';

  const footnote = selectedWeek === 1
    ? (language === 'th'
        ? 'Week 1: อุณหภูมิสัมผัสสูงสุด (Open-Meteo)'
        : 'Week 1: peak apparent temperature (Open-Meteo)')
    : (language === 'th'
        ? `Week ${selectedWeek}: ความน่าจะเป็นความเสี่ยง (โมเดล S2S)`
        : `Week ${selectedWeek}: heatwave risk probability (S2S model)`);

  return (
    <View style={[styles.container, glass]}>
      {/* Legend rows */}
      <View style={styles.rows}>
        {HEAT_LEVELS.map((d) => (
          <View key={d.level} style={styles.row}>
            {/* Colour swatch */}
            <View style={[styles.swatch, { backgroundColor: d.color }]} />
            {/* Numeric badge */}
            <View style={[styles.badge, { backgroundColor: d.color + '33' }]}>
              <ScaledText style={[styles.badgeText, { color: d.level >= 2 ? '#fff' : textColor }]}>
                {d.level}
              </ScaledText>
            </View>
            {/* Label */}
            <ScaledText style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {language === 'th' ? d.labelTh : d.labelEn}
            </ScaledText>
          </View>
        ))}
      </View>

      {/* Metric footnote */}
      <ScaledText style={[styles.footnote, { color: textMuted }]} numberOfLines={2}>
        {footnote}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  rows: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    flex: 1,
  },
  footnote: {
    fontSize: 9,
    fontFamily: FontFamily.body,
    marginTop: 2,
    lineHeight: 13,
  },
});
