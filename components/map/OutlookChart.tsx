/**
 * OutlookChart — the hero: a 4-week heat-risk trend for the user's province.
 *
 * Pure React Native (no SVG dependency): the container measures its own width
 * via onLayout, then dots are absolutely positioned by HeatRisk level (height)
 * and connected by thin rotated View segments so the trend reads at a glance.
 *
 * Height is driven by the canonical HeatRisk level (0-4) so live (°C) and S2S
 * (%) weeks share one consistent axis; the raw value is shown only as a label.
 * Tapping a week selects it (drives the detail card + map elsewhere).
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { colorForLevel } from '@/constants/heatRisk';
import { FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { formatWeekRange } from '@/utils/bangkokTime';
import type { OutlookPoint } from '@/services/forecastService';

interface Props {
  weeks: OutlookPoint[];
  selectedWeek: 1 | 2 | 3 | 4;
  onSelect: (week: 1 | 2 | 3 | 4) => void;
}

const PLOT_H = 108;      // plotting region height
const Y_TOP = 28;        // highest a dot sits (level 4) — leaves room for value label
const Y_BOTTOM = 88;     // lowest a dot sits (level 0)
const DOT = 20;

export function OutlookChart({ weeks, selectedWeek, onSelect }: Props) {
  const { isDarkMode, language } = useSettings();
  const lang = language as 'th' | 'en';
  const [w, setW] = useState(0);

  const textColor = isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  const muted = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const ring = isDarkMode ? '#7FA3C8' : '#16324F';
  const lineColor = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)';

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // x-centre of each of the 4 columns; y from level.
  const n = weeks.length || 4;
  const cx = (i: number) => (w / n) * i + w / n / 2;
  const cy = (level: number) => Y_BOTTOM - (level / 4) * (Y_BOTTOM - Y_TOP);

  // Line segments between consecutive AVAILABLE points.
  const segments: { left: number; top: number; len: number; ang: number }[] = [];
  if (w > 0) {
    for (let i = 0; i < weeks.length - 1; i++) {
      const a = weeks[i];
      const b = weeks[i + 1];
      if (!a.available || !b.available) continue;
      const x1 = cx(i), y1 = cy(a.level), x2 = cx(i + 1), y2 = cy(b.level);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      segments.push({ left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 1.5, len, ang });
    }
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {/* Plot region */}
      <View style={[styles.plot, { height: PLOT_H }]}>
        {w > 0 && segments.map((s, i) => (
          <View
            key={`seg-${i}`}
            style={[styles.segment, {
              width: s.len, left: s.left, top: s.top,
              backgroundColor: lineColor,
              transform: [{ rotate: `${s.ang}deg` }],
            }]}
          />
        ))}

        {w > 0 && weeks.map((pt, i) => {
          const x = cx(i);
          const y = cy(pt.level);
          const isActive = pt.week === selectedWeek;
          const color = pt.available ? colorForLevel(pt.level) : 'rgba(148,163,184,0.5)';
          return (
            <React.Fragment key={`node-${pt.week}`}>
              {/* value label above dot */}
              {pt.available && pt.valueText !== '' && (
                <ScaledText
                  style={[styles.value, { left: x - 30, top: y - 28, color: textColor }]}
                  numberOfLines={1}
                >
                  {pt.valueText}
                </ScaledText>
              )}
              {/* selected ring */}
              {isActive && (
                <View style={[styles.ring, { left: x - 15, top: y - 15, borderColor: ring }]} />
              )}
              {/* dot */}
              <View
                style={[styles.dot, {
                  left: x - DOT / 2, top: y - DOT / 2,
                  backgroundColor: color,
                  borderStyle: pt.available ? 'solid' : 'dashed',
                }]}
              />
            </React.Fragment>
          );
        })}
      </View>

      {/* Tappable week labels */}
      <View style={styles.labels}>
        {weeks.map((pt) => {
          const isActive = pt.week === selectedWeek;
          const srcLive = pt.source === 'open-meteo';
          const srcColor = !pt.available ? muted : srcLive ? '#4f9cf9' : '#E0922C';
          const srcText = !pt.available
            ? (lang === 'th' ? 'ยังไม่มี' : 'n/a')
            : srcLive ? (lang === 'th' ? 'สด' : 'live') : 'S2S';
          return (
            <TouchableOpacity
              key={`lab-${pt.week}`}
              style={styles.cell}
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
              <ScaledText style={[styles.wsrc, { color: srcColor }]} numberOfLines={1}>
                {srcText}
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
  plot: { position: 'relative', width: '100%' },
  segment: { position: 'absolute', height: 3, borderRadius: 2 },
  dot: {
    position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2,
    borderWidth: 2, borderColor: '#fff',
  },
  ring: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 2.5,
  },
  value: {
    position: 'absolute', width: 60, textAlign: 'center',
    fontSize: 13, fontFamily: FontFamily.displaySemi, fontWeight: '800',
  },
  labels: { flexDirection: 'row', marginTop: 4 },
  cell: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 4, borderRadius: 8 },
  wlab: { fontSize: 11, fontFamily: FontFamily.bodySemi },
  wdate: { fontSize: 9, fontFamily: FontFamily.body },
  wsrc: { fontSize: 8.5, fontFamily: FontFamily.bodySemi, fontWeight: '700', marginTop: 1 },
});
