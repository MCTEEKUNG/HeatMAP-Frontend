/**
 * WeekSegmentedControl — clean 4-pill week selector (Apple HIG style).
 *
 * Each pill shows just the week label and its Bangkok-time date range; the
 * active pill is highlighted. Per-week risk is conveyed by the map itself and
 * the status gauge, not by the selector (kept deliberately uncluttered).
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontFamily, GlassStyle } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { formatWeekRange } from '@/utils/bangkokTime';

interface Props {
  selectedWeek: 1 | 2 | 3 | 4;
  onSelect: (week: 1 | 2 | 3 | 4) => void;
}

const WEEKS = [1, 2, 3, 4] as const;

export function WeekSegmentedControl({ selectedWeek, onSelect }: Props) {
  const { isDarkMode, language } = useSettings();
  const themeName = isDarkMode ? 'dark' : 'light';
  const theme = Colors[themeName];

  return (
    <View style={[GlassStyle[themeName], styles.track]}>
      {WEEKS.map((week) => {
        const isActive  = week === selectedWeek;
        const dateRange = formatWeekRange(week, language);
        const weekLabel = language === 'th' ? `สัปดาห์ ${week}` : `Week ${week}`;

        return (
          <TouchableOpacity
            key={week}
            style={[styles.pill, isActive && { backgroundColor: theme.primary }]}
            onPress={() => onSelect(week)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${weekLabel} ${dateRange}`}
            accessibilityState={{ selected: isActive }}
            aria-pressed={isActive}
          >
            <ScaledText
              style={[styles.weekLabel, { color: isActive ? theme.background : theme.text }]}
              numberOfLines={1}
            >
              {weekLabel}
            </ScaledText>
            <ScaledText
              style={[styles.dateRange, { color: isActive ? theme.background : theme.textSecondary }]}
              numberOfLines={1}
            >
              {dateRange}
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
    padding: 4,
    gap: 3,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 5,
    borderRadius: 12,
    gap: 2,
  },
  weekLabel: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },
  dateRange: {
    fontSize: 9.5,
    fontFamily: FontFamily.body,
  },
});
