/**
 * OutlookSummary — the forecast-first hero.
 *
 * Foregrounds the S2S model's contribution (weeks 2-4) and tells the story:
 *   - a narrative headline + trend arrow ("3 weeks ahead ↗ — risk rising")
 *   - a peak chip ("highest: week 4 · 31%")
 *   - the weeks 2-4 trend chart (OutlookChart)
 *   - the current week (Open-Meteo) demoted to a small tappable chip
 *
 * Current conditions aren't the star — the sub-seasonal forecast is.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { colorForLevel, HEAT_LEVELS } from '@/constants/heatRisk';
import { FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { formatWeekRange } from '@/utils/bangkokTime';
import { OutlookChart } from './OutlookChart';
import type { OutlookPoint } from '@/services/forecastService';

interface Props {
  weeks: OutlookPoint[];
  selectedWeek: 1 | 2 | 3 | 4;
  onSelect: (week: 1 | 2 | 3 | 4) => void;
  /** The user's detected province — shown prominently so the outlook reads as "yours". */
  provinceName?: string;
}

export function OutlookSummary({ weeks, selectedWeek, onSelect, provinceName }: Props) {
  const { isDarkMode, language } = useSettings();
  const th = language === 'th';

  const textColor = isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  const muted = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const accent = isDarkMode ? '#7FA3C8' : '#16324F';

  const ProvinceRow = provinceName ? (
    <View style={styles.provRow}>
      <ScaledText style={styles.pin}>📍</ScaledText>
      <ScaledText style={[styles.prov, { color: accent }]} numberOfLines={1}>{provinceName}</ScaledText>
      <ScaledText style={[styles.provHint, { color: muted }]} numberOfLines={1}>
        {th ? 'พื้นที่ของคุณ' : 'your area'}
      </ScaledText>
    </View>
  ) : null;

  // Weeks 2-4 (the model forecast). Keep unavailable ones so the chart shows them muted.
  const forecastAll = weeks.filter((w) => w.week !== 1);
  const forecast = forecastAll.filter((w) => w.available);
  const current = weeks.find((w) => w.week === 1);

  // Trend across the available forecast weeks. Prefer the raw value (probability)
  // for a finer read; fall back to level. (Forecast weeks are all the same unit.)
  let dir: 'up' | 'down' | 'flat' = 'flat';
  if (forecast.length >= 2) {
    const a = forecast[0];
    const b = forecast[forecast.length - 1];
    if (a.value !== null && b.value !== null) {
      const d = b.value - a.value;
      dir = d > 3 ? 'up' : d < -3 ? 'down' : 'flat';
    } else {
      const d = b.level - a.level;
      dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    }
  }
  // Peak = highest risk: by level, then by raw value on a tie (so "peak" never
  // points to a lower-% week just because it comes later).
  const peak = forecast.reduce<OutlookPoint | null>((m, w) => {
    if (!m) return w;
    if (w.level !== m.level) return w.level > m.level ? w : m;
    return (w.value ?? -Infinity) > (m.value ?? -Infinity) ? w : m;
  }, null);

  const arrow = dir === 'up' ? '↗' : dir === 'down' ? '↘' : '→';
  const arrowColor = dir === 'up' ? '#E5352B' : dir === 'down' ? '#4ade80' : muted;
  const dirText = dir === 'up'
    ? (th ? 'ความเสี่ยงมีแนวโน้มสูงขึ้น' : 'risk trending up')
    : dir === 'down'
      ? (th ? 'ความเสี่ยงมีแนวโน้มลดลง' : 'risk trending down')
      : (th ? 'ความเสี่ยงทรงตัว' : 'risk steady');

  const headline = th ? `${forecast.length} สัปดาห์ข้างหน้า` : `Next ${forecast.length} weeks`;

  // Current-week chip text.
  const curSrc = current?.source === 'open-meteo'
    ? (th ? 'พยากรณ์จริง' : 'live')
    : 'S2S';

  if (forecast.length === 0) {
    return (
      <View>
        {ProvinceRow}
        <ScaledText style={[styles.emptyText, { color: muted }]}>
          {th ? 'ยังไม่มีพยากรณ์ล่วงหน้าในขณะนี้' : 'No forward outlook available yet'}
        </ScaledText>
        {current?.available && (
          <CurrentChip th={th} value={current.valueText} src={curSrc}
            active={selectedWeek === 1} onPress={() => onSelect(1)} isDarkMode={isDarkMode} />
        )}
      </View>
    );
  }

  const peakColor = peak ? colorForLevel(peak.level) : muted;
  const peakBand = peak ? (th ? HEAT_LEVELS[peak.level].labelTh : HEAT_LEVELS[peak.level].labelEn) : '';

  return (
    <View>
      {ProvinceRow}
      {/* Narrative headline */}
      <View style={styles.headRow}>
        <ScaledText style={[styles.headline, { color: textColor }]} numberOfLines={1}>{headline}</ScaledText>
        <ScaledText style={[styles.arrow, { color: arrowColor }]}>{arrow}</ScaledText>
      </View>
      <ScaledText style={[styles.dir, { color: muted }]}>{dirText}</ScaledText>

      {/* Peak chip — only when there's a meaningful peak */}
      {peak && peak.level >= 1 && (
        <View style={[styles.peak, { backgroundColor: peakColor + '22' }]}>
          <View style={[styles.peakDot, { backgroundColor: peakColor }]} />
          <View style={{ flex: 1 }}>
            <ScaledText style={[styles.peakTop, { color: peakColor }]} numberOfLines={1}>
              {th ? `เสี่ยงสูงสุด สัปดาห์ที่ ${peak.week} · ${peak.valueText}` : `Peak: week ${peak.week} · ${peak.valueText}`}
            </ScaledText>
            <ScaledText style={[styles.peakSub, { color: muted }]} numberOfLines={1}>
              {peakBand} · {formatWeekRange(peak.week, th ? 'th' : 'en')}
            </ScaledText>
          </View>
        </View>
      )}

      {/* Weeks 2-4 trend chart */}
      <View style={styles.chartWrap}>
        <OutlookChart weeks={forecastAll} selectedWeek={selectedWeek} onSelect={onSelect} />
      </View>

      {/* Current week — demoted to a small tappable chip */}
      {current?.available && (
        <CurrentChip th={th} value={current.valueText} src={curSrc}
          active={selectedWeek === 1} onPress={() => onSelect(1)} isDarkMode={isDarkMode} />
      )}
    </View>
  );
}

function CurrentChip({ th, value, src, active, onPress, isDarkMode }: {
  th: boolean; value: string; src: string; active: boolean; onPress: () => void; isDarkMode: boolean;
}) {
  const base = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const activeBg = isDarkMode ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.14)';
  const color = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  return (
    <TouchableOpacity
      style={[styles.curChip, { backgroundColor: active ? activeBg : base }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={th ? 'ดูสภาพอากาศสัปดาห์นี้' : 'View this week'}
    >
      <ScaledText style={[styles.curText, { color }]} numberOfLines={1}>
        {`📍 ${th ? 'สัปดาห์นี้' : 'This week'}: ${value} · ${src}`}
      </ScaledText>
      <ScaledText style={[styles.curText, { color }]}>›</ScaledText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  provRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 6 },
  pin: { fontSize: 13 },
  prov: { fontSize: 17, fontFamily: FontFamily.display, fontWeight: '800', letterSpacing: -0.3 },
  provHint: { fontSize: 10.5, fontFamily: FontFamily.body },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headline: { fontSize: 21, fontFamily: FontFamily.display, fontWeight: '800', letterSpacing: -0.4 },
  arrow: { fontSize: 22, fontWeight: '800' },
  dir: { fontSize: 12, fontFamily: FontFamily.bodyMedium, marginTop: 1 },
  peak: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, padding: 9, marginTop: 10 },
  peakDot: { width: 10, height: 10, borderRadius: 5 },
  peakTop: { fontSize: 12.5, fontFamily: FontFamily.bodySemi, fontWeight: '700' },
  peakSub: { fontSize: 10, fontFamily: FontFamily.body, marginTop: 1 },
  chartWrap: { marginTop: 10 },
  curChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11, marginTop: 10 },
  curText: { fontSize: 11, fontFamily: FontFamily.bodyMedium, fontWeight: '600' },
  emptyText: { fontSize: 12, fontFamily: FontFamily.body, paddingVertical: 14, textAlign: 'center' },
});
