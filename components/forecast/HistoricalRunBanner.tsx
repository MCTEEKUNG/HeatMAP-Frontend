/**
 * HistoricalRunBanner
 *
 * The model runs on the latest date with complete ERA5 features
 * (issue_date 2023-12-31), so forecast target dates fall in early 2024.
 * This banner makes that explicit so the historical dates read as an
 * intentional model run, not a broken "live" forecast.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, DesignTokens } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatForecastDate } from '@/services/forecastService';

export function HistoricalRunBanner({ issueDate }: { issueDate?: string }) {
  const { isDarkMode, language } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  if (!issueDate) return null;

  const issued = formatForecastDate(issueDate);
  const text =
    language === 'th'
      ? `โมเดลรันย้อนหลัง · ออกพยากรณ์ ${issued} — วันที่ด้านล่างเป็นข้อมูลอดีตเพื่อสาธิต`
      : `Historical model run · issued ${issued} — dates below are historical (demo)`;
  const accent = isDarkMode ? '#FDE047' : '#CA8A04';

  return (
    <View
      style={[
        styles.banner,
        {
          borderColor: accent,
          backgroundColor: isDarkMode ? 'rgba(253,224,71,0.08)' : 'rgba(202,138,4,0.08)',
        },
      ]}
    >
      <IconSymbol size={16} name="info.fill" color={accent} />
      <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

export default HistoricalRunBanner;

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
    paddingVertical: DesignTokens.spacing.sm,
    paddingHorizontal: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
    borderWidth: 1,
    marginBottom: DesignTokens.spacing.lg,
  },
  text: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
});
