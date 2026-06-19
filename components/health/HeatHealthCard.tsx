import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, GlassStyle, SoftShadow, FontFamily, DesignTokens } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { guidanceFor } from '@/constants/riskGuidance';
import { alertTierFromRiskLevel, alertTierColor, type RiskLevel } from '@/services/forecastService';

export interface HeatHealthCardProps {
  risk: RiskLevel;
  compact?: boolean;
}

const TIER_LABEL: Record<RiskLevel, { en: string; th: string }> = {
  High:     { en: '⚠️ Warning',  th: '⚠️ เตือนภัย' },
  Elevated: { en: '👀 Watch',    th: '👀 เฝ้าระวัง' },
  Normal:   { en: '✅ Normal',   th: '✅ ปกติ' },
  Low:      { en: '✅ Low',      th: '✅ ต่ำ' },
};

export function HeatHealthCard({ risk, compact = false }: HeatHealthCardProps) {
  const router = useRouter();
  const { t, language, isDarkMode } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  const guidance = guidanceFor(risk, language);
  const tier = alertTierFromRiskLevel(risk);
  const accentColor = alertTierColor(tier, isDarkMode);

  // Actionable tiers show 2 tips; safe tiers show 1
  const tips = (risk === 'Elevated' || risk === 'High')
    ? guidance.actions.slice(0, compact ? 1 : 2)
    : guidance.actions.slice(0, 1);

  return (
    <View
      style={[
        styles.card,
        GlassStyle[isDarkMode ? 'dark' : 'light'],
        SoftShadow.light,
        { marginBottom: DesignTokens.spacing.md },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        {/* Status chip — the only "header" needed */}
        <View style={[styles.chip, { borderColor: accentColor }]}>
          <ScaledText style={[styles.chipText, { color: accentColor }]}>
            {TIER_LABEL[risk][language]}
          </ScaledText>
        </View>

        {/* 1–2 key tips only, no section heading */}
        {tips.map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <View style={[styles.tipDot, { backgroundColor: accentColor }]} />
            <ScaledText style={[styles.tipText, { color: theme.text }]}>
              {tip}
            </ScaledText>
          </View>
        ))}

        {/* Quiet link to full guide */}
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/safety' as any, params: { risk } })
          }
          accessibilityRole="link"
          accessibilityLabel={t('viewFullGuidance')}
          style={styles.link}
        >
          <ScaledText style={[styles.linkText, { color: accentColor }]}>
            {`${t('viewFullGuidance')} →`}
          </ScaledText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default HeatHealthCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 9,
  },
  chipText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  tipText: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    lineHeight: 18,
    flex: 1,
  },
  link: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
  },
});
