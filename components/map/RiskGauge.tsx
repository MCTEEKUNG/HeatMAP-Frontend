/**
 * RiskGauge — current-status gauge for the user's area.
 *
 * Shows, in one clean block:
 *   - the current metric value (peak apparent °C for Week 1, risk % for 2-4)
 *   - the band it falls in (coloured chip + label)
 *   - a 5-level HeatRisk scale with a ▼ marker pointing at the current band
 *     (the scale doubles as the legend, so no separate legend is needed)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HEAT_LEVELS, type HeatLevel } from '@/constants/heatRisk';
import { HeatRiskColors, FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';

interface Props {
  /** Current band (0-4). */
  level: HeatLevel;
  /** Headline value, already formatted, e.g. "37.7°C" or "65%". */
  valueText: string;
  /** Small source/metric disclosure under the scale. */
  footnote?: string;
}

export function RiskGauge({ level, valueText, footnote }: Props) {
  const { isDarkMode, language } = useSettings();
  const lang = language as 'th' | 'en';

  const band = HEAT_LEVELS[level];
  const bandColor = HeatRiskColors[level];
  const bandLabel = lang === 'th' ? band.labelTh : band.labelEn;

  const textColor = isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  const textMuted = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  // Marker sits at the centre of the current band's segment (segments are equal
  // width, so centre-of-band is the honest position).
  const markerPct = ((level + 0.5) / HEAT_LEVELS.length) * 100;

  return (
    <View style={styles.container}>
      {/* Value + band chip */}
      <View style={styles.head}>
        <ScaledText style={[styles.value, { color: textColor }]} numberOfLines={1}>
          {valueText}
        </ScaledText>
        <View style={[styles.bandChip, { backgroundColor: bandColor + '26' }]}>
          <View style={[styles.bandDot, { backgroundColor: bandColor }]} />
          <ScaledText style={[styles.bandLabel, { color: bandColor }]} numberOfLines={1}>
            {bandLabel}
          </ScaledText>
        </View>
      </View>

      {/* Marker track */}
      <View style={styles.markerTrack}>
        <View style={[styles.marker, { left: `${markerPct}%` }]}>
          <ScaledText style={[styles.markerCaret, { color: textColor }]}>▼</ScaledText>
        </View>
      </View>

      {/* 5-level scale (also serves as the legend) */}
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
            <ScaledText style={[styles.cellNum, { color: d.level >= 2 ? '#fff' : 'rgba(0,0,0,0.7)' }]}>
              {d.level}
            </ScaledText>
            <ScaledText
              style={[styles.cellLabel, { color: d.level >= 2 ? '#fff' : 'rgba(0,0,0,0.7)' }]}
              numberOfLines={1}
            >
              {lang === 'th' ? d.labelTh : d.labelEn}
            </ScaledText>
          </View>
        ))}
      </View>

      {footnote ? (
        <ScaledText style={[styles.footnote, { color: textMuted }]} numberOfLines={1}>
          {footnote}
        </ScaledText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  value: {
    fontSize: 26,
    fontFamily: FontFamily.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  bandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bandLabel: {
    fontSize: 13,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },
  markerTrack: {
    height: 12,
    position: 'relative',
    marginTop: 2,
  },
  marker: {
    position: 'absolute',
    transform: [{ translateX: -6 }],
  },
  markerCaret: {
    fontSize: 11,
    lineHeight: 12,
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
    marginTop: 1,
  },
});
