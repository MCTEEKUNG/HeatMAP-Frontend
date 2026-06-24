/**
 * WeekSegmentedControl — 4-pill animated segmented control (Apple HIG style).
 *
 * Each pill shows:
 *   - Week label ("สัปดาห์ 1" / "Week 1")
 *   - Calendar date range in Bangkok time
 *   - Coloured risk dot from weekSummaries (mini-forecast in the selector)
 *   - Numeric badge on the dot for colorblind accessibility
 *
 * The active highlight animates between pills using react-native-reanimated.
 */

import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GlassStyle, FontFamily } from '@/constants/theme';
import { colorForLevel } from '@/constants/heatRisk';
import type { HeatLevel } from '@/constants/heatRisk';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { formatWeekRange } from '@/utils/bangkokTime';

interface Props {
  selectedWeek: 1 | 2 | 3 | 4;
  onSelect: (week: 1 | 2 | 3 | 4) => void;
  /** National-worst heat level per week (for the risk dot). Falls back to 0 if loading. */
  weekSummaries?: Partial<Record<1 | 2 | 3 | 4, HeatLevel>>;
}

const WEEKS = [1, 2, 3, 4] as const;

export function WeekSegmentedControl({ selectedWeek, onSelect, weekSummaries = {} }: Props) {
  const { isDarkMode, language } = useSettings();
  const lang = language as 'th' | 'en';

  // Animate the active pill indicator position (0-3 for weeks 1-4)
  const activeIndex = useSharedValue(selectedWeek - 1);
  useEffect(() => {
    activeIndex.value = withTiming(selectedWeek - 1, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
  }, [selectedWeek, activeIndex]);

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
        const level     = (weekSummaries[week] ?? 0) as HeatLevel;
        const dotColor  = colorForLevel(level);
        const dateRange = formatWeekRange(week, lang);
        const weekLabel = lang === 'th' ? `สัปดาห์ ${week}` : `Week ${week}`;

        return (
          <TouchableOpacity
            key={week}
            style={[styles.pill, isActive && [styles.pillActive, { backgroundColor: activeColor }]]}
            onPress={() => onSelect(week)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${weekLabel} ${dateRange}`}
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

            {/* Risk dot + badge */}
            <View style={styles.dotRow}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <ScaledText style={[styles.dotBadge, { color: dotColor }]}>
                {level}
              </ScaledText>
            </View>
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
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 2,
  },
  pillActive: {
    // backgroundColor set inline via activeColor
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
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotBadge: {
    fontSize: 8,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },
});
