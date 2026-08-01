/**
 * OutlookChart — the hero: a 4-week heat-risk trend for the user's province.
 *
 * Pure React Native (no SVG dependency): the top chart shows whether the
 * user's-area forecast signal rises or falls across the next weeks, then the
 * buttons below let the user select a week for guidance.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { colorForLevel } from '@/constants/heatRisk';
import { FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { formatWeekRange } from '@/utils/bangkokTime';
import type { OutlookPoint } from '@/services/forecastService';
import { humanRiskText } from './outlookCopy';

interface Props {
  weeks: OutlookPoint[];
  selectedWeek: 1 | 2 | 3 | 4;
  onSelect: (week: 1 | 2 | 3 | 4) => void;
}

const CHART_H = 148;
const Y_TOP = 42;
const Y_BOTTOM = 92;
const DOT = 18;
const X_PAD = 36;

const trendMetric = (point: OutlookPoint): number | null => {
  if (!point.available) return null;
  if (point.source === 's2s' && point.ratioVsNormal !== undefined) return point.ratioVsNormal;
  return point.value;
};

const formatRatio = (value: number): string => {
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1).replace(/\.0$/, '');
};

const formatTrendValue = (point: OutlookPoint, th: boolean): string => {
  const value = trendMetric(point);
  if (value === null) return th ? 'รอข้อมูล' : 'n/a';
  if (point.source === 'open-meteo') return `${Math.round(value)}°C`;
  if (point.ratioVsNormal !== undefined) return th ? `${formatRatio(value)} เท่า` : `${formatRatio(value)}x`;
  return th ? `เสี่ยง ${Math.round(value)}%` : `${Math.round(value)}% risk`;
};

export function OutlookChart({ weeks, selectedWeek, onSelect }: Props) {
  const { isDarkMode, language } = useSettings();
  const lang = language as 'th' | 'en';
  const th = lang === 'th';
  const [w, setW] = useState(0);

  const textColor = isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  const muted = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const ring = isDarkMode ? '#7FA3C8' : '#16324F';
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const availableValues = weeks
    .map((pt) => trendMetric(pt))
    .filter((value): value is number => value !== null);
  const peak = weeks.reduce<{ week: OutlookPoint['week']; value: number } | null>((best, pt) => {
    const value = trendMetric(pt);
    if (value === null) return best;
    if (!best || value > best.value) return { week: pt.week, value };
    return best;
  }, null);
  const minValue = availableValues.length ? Math.min(...availableValues) : 0;
  const maxValue = availableValues.length ? Math.max(...availableValues) : 1;
  const range = Math.max(1, maxValue - minValue);
  const xFor = (index: number) => {
    const count = Math.max(1, weeks.length);
    const usableW = Math.max(1, w - X_PAD * 2);
    return count === 1 ? w / 2 : X_PAD + (usableW / (count - 1)) * index;
  };
  const yFor = (value: number | null) => {
    if (value === null) return (Y_TOP + Y_BOTTOM) / 2;
    return Y_BOTTOM - ((value - minValue) / range) * (Y_BOTTOM - Y_TOP);
  };
  const segments: { left: number; top: number; len: number; ang: number; color: string }[] = [];
  if (w > 0) {
    for (let i = 0; i < weeks.length - 1; i++) {
      const a = weeks[i];
      const b = weeks[i + 1];
      const aValue = trendMetric(a);
      const bValue = trendMetric(b);
      if (!a.available || !b.available || aValue === null || bValue === null) continue;
      const x1 = xFor(i), y1 = yFor(aValue), x2 = xFor(i + 1), y2 = yFor(bValue);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      segments.push({
        left: (x1 + x2) / 2 - len / 2,
        top: (y1 + y2) / 2 - 1.5,
        len,
        ang,
        // Keep the line mapped to the same risk scale as the labels below.
        // When a segment crosses bands, retain the higher-risk color.
        color: colorForLevel(Math.max(a.level, b.level) as Parameters<typeof colorForLevel>[0]),
      });
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chartHead}>
        <ScaledText style={[styles.chartTitle, { color: textColor }]} numberOfLines={1}>
          {th ? 'เทียบกับค่าปกติ' : 'Compared with normal'}
        </ScaledText>
        <ScaledText style={[styles.chartHint, { color: muted }]} numberOfLines={1}>
          {th ? 'ยิ่งสูง = เสี่ยงกว่าปกติ' : 'Higher = above normal risk'}
        </ScaledText>
      </View>

      <View style={[styles.trendChart, { height: CHART_H }]} onLayout={onLayout}>
        {w > 0 && segments.map((seg, i) => (
          <View
            key={`trend-${i}`}
            style={[
              styles.trendSegment,
              {
                width: seg.len,
                left: seg.left,
                top: seg.top,
                backgroundColor: seg.color,
                transform: [{ rotate: `${seg.ang}deg` }],
              },
            ]}
          />
        ))}

        {w > 0 && weeks.map((pt, i) => {
          const isActive = pt.week === selectedWeek;
          const x = xFor(i);
          const y = yFor(trendMetric(pt));
          const color = pt.available ? colorForLevel(pt.level) : 'rgba(148,163,184,0.5)';
          const isPeak = peak?.week === pt.week;
          return (
            <TouchableOpacity
              key={`trend-point-${pt.week}`}
              style={[
                styles.trendPointHit,
                { left: x - 36, top: y - 34 },
              ]}
              onPress={() => onSelect(pt.week)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${lang === 'th' ? 'แนวโน้มสัปดาห์' : 'Trend week'} ${pt.week} ${formatTrendValue(pt, th)}`}
            >
              <ScaledText
                style={[
                  styles.pointValue,
                  {
                    color: isPeak ? '#fff' : textColor,
                    backgroundColor: isPeak ? color : 'transparent',
                    borderColor: isPeak ? color : 'transparent',
                  },
                ]}
                numberOfLines={1}
              >
                {formatTrendValue(pt, th)}
              </ScaledText>
              <View style={[styles.pointRing, (isActive || isPeak) && { borderColor: isPeak ? color : ring, borderWidth: isPeak ? 3 : 2.5 }]}>
                <View style={[styles.pointDot, { backgroundColor: color }]} />
              </View>
              <ScaledText style={[styles.pointWeek, { color: muted }]} numberOfLines={1}>
                {lang === 'th' ? `สัปดาห์ ${pt.week}` : `W${pt.week}`}
              </ScaledText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tappable week labels */}
      <View style={styles.labels}>
        {weeks.map((pt) => {
          const isActive = pt.week === selectedWeek;
          const humanText = humanRiskText(pt, lang === 'th');
          return (
            <TouchableOpacity
              key={`lab-${pt.week}`}
              style={[
                styles.cell,
                {
                  backgroundColor: isActive
                    ? (isDarkMode ? 'rgba(127,163,200,0.18)' : 'rgba(22,50,79,0.08)')
                    : 'transparent',
                  borderColor: isActive ? ring : 'transparent',
                },
              ]}
              onPress={() => onSelect(pt.week)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${lang === 'th' ? 'สัปดาห์' : 'Week'} ${pt.week} ${formatWeekRange(pt.week, lang)}`}
            >
              <ScaledText
                style={[styles.wlab, { color: isActive ? textColor : muted, fontWeight: isActive ? '800' : '600' }]}
                numberOfLines={1}
              >
                {lang === 'th' ? `สัปดาห์ ${pt.week}` : `Week ${pt.week}`}
              </ScaledText>
              <ScaledText style={[styles.wdate, { color: muted }]} numberOfLines={1}>
                {formatWeekRange(pt.week, lang)}
              </ScaledText>
              <ScaledText style={[styles.wvalue, { color: pt.available ? colorForLevel(pt.level) : muted }]} numberOfLines={2}>
                {humanText}
              </ScaledText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 2 },
  chartTitle: { fontSize: 12.5, lineHeight: 17, fontFamily: FontFamily.bodySemi, fontWeight: '800' },
  chartHint: { flex: 1, textAlign: 'right', fontSize: 9.5, lineHeight: 13, fontFamily: FontFamily.bodyMedium },
  trendChart: { position: 'relative', width: '100%', paddingHorizontal: 36 },
  trendSegment: { position: 'absolute', height: 3, borderRadius: 2 },
  trendPointHit: { position: 'absolute', width: 72, alignItems: 'center' },
  pointValue: {
    minWidth: 52,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FontFamily.displaySemi,
    fontWeight: '900',
  },
  pointRing: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2, borderColor: 'transparent', borderWidth: 2.5 },
  pointDot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2, borderColor: '#fff' },
  pointWeek: { fontSize: 9, lineHeight: 12, fontFamily: FontFamily.bodySemi, fontWeight: '700', marginTop: 7 },
  labels: { flexDirection: 'row', marginTop: 6, gap: 6 },
  cell: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 3, borderRadius: 10, borderWidth: 1 },
  wlab: { fontSize: 13, fontFamily: FontFamily.bodySemi },
  wdate: { fontSize: 9.5, fontFamily: FontFamily.body },
  wvalue: { fontSize: 15, lineHeight: 19, fontFamily: FontFamily.displaySemi, fontWeight: '900', marginTop: 3, textAlign: 'center' },
});
