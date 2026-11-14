/**
 * OutlookSummary — the forecast-first hero.
 *
 * Foregrounds the S2S model's contribution (weeks 2-4) and tells the story:
 *   - a narrative headline + trend arrow ("3 weeks ahead ↗ — risk rising")
 *   - the weeks 2-4 trend chart (OutlookChart)
 *   - an action plan for the selected forecast week
 *
 * Current conditions aren't the star — the sub-seasonal forecast is.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colorForLevel, descriptorForLevel, HEAT_LEVELS, type HeatLevel } from '@/constants/heatRisk';
import { Colors, FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { OutlookChart } from './OutlookChart';
import { RiskGauge } from './RiskGauge';
import type { OutlookPoint, RiskLevel } from '@/services/forecastService';
import { guidanceFor } from '@/constants/riskGuidance';
import { humanRiskText, modelEvidenceText } from './outlookCopy';

interface Props {
  weeks: OutlookPoint[];
  selectedWeek: 1 | 2 | 3 | 4;
  onSelect: (week: 1 | 2 | 3 | 4) => void;
  provinceName?: string;
}

const riskFromLevel = (level: HeatLevel): RiskLevel => {
  if (level >= 3) return 'High';
  if (level === 2) return 'Elevated';
  if (level === 1) return 'Normal';
  return 'Low';
};

export function OutlookSummary({ weeks, selectedWeek, onSelect }: Props) {
  const { isDarkMode, language } = useSettings();
  const th = language === 'th';

  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  const textColor = theme.text;
  const muted = theme.textMuted;
  const divider = theme.border;

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
  const arrowColor = peak ? colorForLevel(peak.level) : muted;
  const dirText = dir === 'up'
    ? (th ? 'ความเสี่ยงมีแนวโน้มสูงขึ้น' : 'risk trending up')
    : dir === 'down'
      ? (th ? 'ความเสี่ยงมีแนวโน้มลดลง' : 'risk trending down')
      : (th ? 'ความเสี่ยงทรงตัว' : 'risk steady');

  const headline = th ? `${forecast.length} สัปดาห์ข้างหน้า` : `Next ${forecast.length} weeks`;
  const selected = weeks.find((w) => w.week === selectedWeek && w.available) ?? peak ?? forecast[0] ?? current;
  const selectedRisk = selected ? riskFromLevel(selected.level) : 'Low';
  const selectedGuidance = guidanceFor(selectedRisk, th ? 'th' : 'en');
  const selectedBand = selected ? descriptorForLevel(selected.level) : HEAT_LEVELS[0];
  const selectedHumanText = humanRiskText(selected, th);
  const selectedFootnote = modelEvidenceText(selected, th);
  const selectedColor = selected ? colorForLevel(selected.level) : colorForLevel(0);
  const compactScaleLabels = th
    ? ['ปกติ', 'เฝ้าระวัง', 'ระดับนี้', 'มาก', 'สูงสุด']
    : ['Normal', 'Watch', 'Current', 'High', 'Extreme'];

  if (forecast.length === 0) {
    return (
      <View>
        <ScaledText style={[styles.emptyTitle, { color: textColor }]}>
          {th ? 'ไทม์ไลน์ความเสี่ยง' : 'Risk timeline'}
        </ScaledText>
        <ScaledText style={[styles.emptyText, { color: muted }]}>
          {th ? 'ยังไม่มีพยากรณ์ล่วงหน้าสำหรับพื้นที่นี้' : 'No upcoming forecast for this area'}
        </ScaledText>
      </View>
    );
  }

  return (
    <View>
      <ScaledText style={[styles.sectionKicker, { color: muted }]} numberOfLines={1}>
        {th ? 'ไทม์ไลน์ความเสี่ยง' : 'Risk timeline'}
      </ScaledText>

      {/* Narrative headline */}
      <View style={styles.headRow}>
        <ScaledText style={[styles.headline, { color: textColor }]} numberOfLines={1}>{headline}</ScaledText>
        <ScaledText style={[styles.arrow, { color: arrowColor }]}>{arrow}</ScaledText>
      </View>
      <ScaledText style={[styles.dir, { color: muted }]}>{dirText}</ScaledText>

      {/* Weeks 2-4 trend chart */}
      <View
        style={[
          styles.chartWrap,
          {
            borderColor: divider,
          },
        ]}
      >
        <OutlookChart weeks={forecastAll} selectedWeek={selectedWeek} onSelect={onSelect} />
      </View>

      {selected && (
        <View
          style={[
            styles.plan,
            {
              borderColor: divider,
            },
          ]}
        >
          <View style={styles.planHead}>
            <View style={{ flex: 1 }}>
              <ScaledText style={[styles.planKicker, { color: muted }]} numberOfLines={1}>
                {th ? `แผนรับมือ · สัปดาห์ที่ ${selected.week}` : `Action plan · week ${selected.week}`}
              </ScaledText>
              <ScaledText style={[styles.planTitle, { color: textColor }]} numberOfLines={1}>
                {th ? selectedBand.labelTh : selectedBand.labelEn}
              </ScaledText>
            </View>
          </View>

          <RiskGauge
            level={selected.level}
            valueText={selectedHumanText}
            footnote={selectedFootnote}
            showHeader={false}
            showScaleLabels
            scaleLabels={compactScaleLabels}
          />

          <View style={styles.actions}>
            {selectedGuidance.actions.slice(0, selectedRisk === 'High' ? 3 : 2).map((action) => (
              <View key={action} style={styles.actionRow}>
                <View style={[styles.actionDot, { backgroundColor: selectedColor }]} />
                <ScaledText style={[styles.actionText, { color: textColor }]}>
                  {action}
                </ScaledText>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionKicker: { fontSize: 11, fontFamily: FontFamily.bodySemi, fontWeight: '700', marginBottom: 3 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headline: { fontSize: 24, lineHeight: 32, fontFamily: FontFamily.displaySemi },
  arrow: { fontSize: 24, lineHeight: 32, fontWeight: '500' },
  dir: { fontSize: 12, fontFamily: FontFamily.bodyMedium, marginTop: 1 },
  chartWrap: { marginTop: 12, borderRadius: 8, borderWidth: 1, padding: 8 },
  emptyTitle: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.bodySemi },
  emptyText: { fontSize: 13, lineHeight: 20, fontFamily: FontFamily.body, marginTop: 4 },
  plan: { marginTop: 12, borderRadius: 8, borderWidth: 1, padding: 12 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  planKicker: { fontSize: 10.5, fontFamily: FontFamily.bodyMedium },
  planTitle: { fontSize: 18, fontFamily: FontFamily.displaySemi },
  actions: { gap: 7, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actionDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  actionText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: FontFamily.bodyMedium },
});
