/**
 * WeekSegmentedControl — clean 4-pill week selector (Apple HIG style).
 *
 * Each pill shows just the week label and its Bangkok-time date range; the
 * active pill is highlighted. Per-week risk is conveyed by the map itself and
 * the status gauge, not by the selector (kept deliberately uncluttered).
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FontFamily } from '@/constants/theme';
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
        const dateRange = formatWeekRange(week, lang);
        const weekLabel = lang === 'th' ? `สัปดาห์ ${week}` : `Week ${week}`;

        return (
          <TouchableOpacity
            key={week}
            style={[styles.pill, isActive && { backgroundColor: activeColor }]}
            onPress={() => onSelect(week)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${weekLabel} ${dateRange}`}
            accessibilityState={{ selected: isActive }}
          >
            <ScaledText
              style={[styles.weekLabel, { color: isActive ? textActive : textIdle }]}
              numberOfLines={1}
            >
              {weekLabel}
            </ScaledText>
            <ScaledText
              style={[styles.dateRange, { color: isActive ? 'rgba(255,255,255,0.75)' : textIdle }]}
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
    borderRadius: 16,
    borderWidth: 1,
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
