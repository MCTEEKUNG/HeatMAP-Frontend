/**
 * WeekSegmentedControl — 4-pill segmented control (Apple HIG style).
 *
 * Each pill shows:
 *   - Week label ("สัปดาห์ 1" / "Week 1")
 *   - Calendar date range in Bangkok time
 *   - A tiny stacked bar of the national risk distribution for that week
 *     (provinces per HeatLevel) — this varies week-to-week, unlike a single
 *     worst-level dot which saturated at the same value every week.
 *   - The count of high-risk provinces (Major+Extreme), coloured by worst level.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FontFamily, HeatRiskColors } from '@/constants/theme';
import { colorForLevel } from '@/constants/heatRisk';
import type { WeekRiskSummary } from '@/services/forecastService';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { formatWeekRange } from '@/utils/bangkokTime';

interface Props {
  selectedWeek: 1 | 2 | 3 | 4;
  onSelect: (week: 1 | 2 | 3 | 4) => void;
  /** National risk distribution per week (for the stacked bar + count). */
  weekSummaries?: Partial<Record<1 | 2 | 3 | 4, WeekRiskSummary>>;
}

const WEEKS = [1, 2, 3, 4] as const;
const EMPTY: WeekRiskSummary = { counts: [0, 0, 0, 0, 0], worst: 0, highRiskCount: 0, total: 0 };

/** Tiny horizontal stacked bar: one segment per HeatLevel, width ∝ province count. */
function RiskBar({ counts, total, dim }: { counts: number[]; total: number; dim: boolean }) {
  if (total === 0) {
    return <View style={[styles.bar, styles.barEmpty, dim && styles.barEmptyDim]} />;
  }
  return (
    <View style={styles.bar}>
      {counts.map((c, level) =>
        c > 0 ? (
          <View
            key={level}
            style={{
              flex: c,
              backgroundColor: HeatRiskColors[level],
              opacity: dim ? 0.85 : 1,
            }}
          />
        ) : null,
      )}
    </View>
  );
}

export function WeekSegmentedControl({ selectedWeek, onSelect, weekSummaries = {} }: Props) {
  const { isDarkMode, language } = useSettings();
  const lang = language as 'th' | 'en';

  const bgColor     = isDarkMode ? 'rgba(16, 36, 58, 0.78)' : 'rgba(255,255,255,0.85)';
  const activeColor = isDarkMode ? '#7FA3C8' : '#16324F';
  const textActive  = '#FFFFFF';
  const textIdle    = isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: bgColor,
          borderColor,
          ...(typeof window !== 'undefined'
            ? ({ backdropFilter: 'blur(14px) saturate(160%)' } as object)
            : {}),
        },
      ]}
    >
      {WEEKS.map((week) => {
        const isActive  = week === selectedWeek;
        const summary   = weekSummaries[week] ?? EMPTY;
        const dateRange = formatWeekRange(week, lang);
        const weekLabel = lang === 'th' ? `สัปดาห์ ${week}` : `Week ${week}`;
        // High-risk count is the headline signal; colour it by the worst level.
        const countColor = summary.highRiskCount > 0
          ? colorForLevel(summary.worst)
          : (isActive ? 'rgba(255,255,255,0.6)' : textIdle);
        const countText = summary.total === 0
          ? '—'
          : summary.highRiskCount > 0
            ? (lang === 'th' ? `${summary.highRiskCount} เสี่ยงสูง` : `${summary.highRiskCount} high`)
            : (lang === 'th' ? 'ปกติ' : 'normal');

        return (
          <TouchableOpacity
            key={week}
            style={[styles.pill, isActive && { backgroundColor: activeColor }]}
            onPress={() => onSelect(week)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={
              lang === 'th'
                ? `${weekLabel} ${dateRange} ${summary.highRiskCount} จังหวัดเสี่ยงสูง`
                : `${weekLabel} ${dateRange}, ${summary.highRiskCount} high-risk provinces`
            }
            accessibilityState={{ selected: isActive }}
          >
            {/* Week label */}
            <ScaledText
              style={[styles.weekLabel, { color: isActive ? textActive : textIdle }]}
              numberOfLines={1}
            >
              {weekLabel}
            </ScaledText>

            {/* Date range */}
            <ScaledText
              style={[styles.dateRange, { color: isActive ? 'rgba(255,255,255,0.75)' : textIdle }]}
              numberOfLines={1}
            >
              {dateRange}
            </ScaledText>

            {/* Stacked risk distribution bar */}
            <RiskBar counts={summary.counts} total={summary.total} dim={isActive} />

            {/* High-risk province count */}
            <ScaledText style={[styles.count, { color: countColor }]} numberOfLines={1}>
              {countText}
            </ScaledText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 3,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderRadius: 12,
    gap: 3,
  },
  weekLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },
  dateRange: {
    fontSize: 9,
    fontFamily: FontFamily.body,
  },
  bar: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 1,
  },
  barEmpty: {
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  barEmptyDim: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  count: {
    fontSize: 8.5,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },
});
