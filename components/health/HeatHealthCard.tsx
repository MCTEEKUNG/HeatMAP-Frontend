/**
 * HeatHealthCard — compact bilingual health guidance card
 *
 * Displays localized health guidance for a given RiskLevel.
 * Consumed by:
 *   - app/(tabs)/alerts.tsx        (full, between hero and outlook)
 *   - app/(tabs)/map.tsx           (optional, in "your area" hero)
 *   - components/forecast/ProvinceForecastPanel.tsx  (compact=true)
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, GlassStyle, SoftShadow, FontFamily, DesignTokens } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { guidanceFor } from '@/constants/riskGuidance';
import {
  alertTierFromRiskLevel,
  alertTierColor,
  type RiskLevel,
} from '@/services/forecastService';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface HeatHealthCardProps {
  /** Four-tier risk from the backend: 'Low' | 'Normal' | 'Elevated' | 'High' */
  risk: RiskLevel;
  /**
   * Compact mode — show only 2 actions instead of all.
   * Used by ProvinceForecastPanel where space is limited.
   * @default false
   */
  compact?: boolean;
}

// ─── Chip label helper ────────────────────────────────────────────────────────

/**
 * Returns emoji + label for a risk chip.
 * NOTE: We cannot reuse `alertTierLabel(alertTierFromRiskLevel(risk), lang)` here
 * because `alertTierFromRiskLevel('Low')` returns 'none' which maps to 'Normal'
 * label — obscuring the distinction between Low and Normal tiers in the UI.
 */
function tierChipLabel(risk: RiskLevel, lang: 'en' | 'th'): string {
  const labels: Record<RiskLevel, { en: string; th: string }> = {
    High:     { en: '⚠️ Warning',     th: '⚠️ เตือนภัย' },
    Elevated: { en: '👀 Watch',        th: '👀 เฝ้าระวัง' },
    Normal:   { en: '✅ Normal',       th: '✅ ปกติ' },
    Low:      { en: '✅ Low',          th: '✅ ต่ำ' },
  };
  return labels[risk][lang];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HeatHealthCard({ risk, compact = false }: HeatHealthCardProps) {
  const router = useRouter();
  const { t, language, isDarkMode } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  const guidance = guidanceFor(risk, language);
  const tier = alertTierFromRiskLevel(risk);
  const accentColor = alertTierColor(tier, isDarkMode);

  // Determine how many actions to show
  const isActionable = risk === 'Elevated' || risk === 'High';
  const actionsToShow = isActionable
    ? guidance.actions.slice(0, compact ? 2 : 3)
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
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Card body */}
      <View style={styles.body}>

        {/* Title row */}
        <View style={styles.titleRow}>
          <ScaledText
            style={[styles.title, { color: theme.text, fontFamily: FontFamily.display }]}
            numberOfLines={1}
          >
            {t('healthGuidanceTitle')}
          </ScaledText>
          <View style={[styles.chip, { borderColor: accentColor }]}>
            <ScaledText
              style={[styles.chipText, { color: accentColor, fontFamily: FontFamily.bodySemi }]}
              numberOfLines={1}
            >
              {tierChipLabel(risk, language)}
            </ScaledText>
          </View>
        </View>

        {/* "What's happening" section */}
        <ScaledText
          style={[styles.sectionLabel, { color: theme.textMuted, fontFamily: FontFamily.bodySemi }]}
        >
          {t('whatsHappening')}
        </ScaledText>
        <ScaledText
          style={[styles.bodyText, { color: theme.text, fontFamily: FontFamily.body }]}
        >
          {guidance.whatsHappening}
        </ScaledText>

        {/* Action list */}
        {actionsToShow.length > 0 && (
          <View style={styles.actionList}>
            {isActionable
              ? actionsToShow.map((action) => (
                  <View key={action} style={styles.actionRow}>
                    <ScaledText
                      style={[styles.bullet, { color: accentColor }]}
                      accessible={false}
                    >
                      {'•'}
                    </ScaledText>
                    <ScaledText
                      style={[styles.actionText, { color: theme.text, fontFamily: FontFamily.body }]}
                    >
                      {action}
                    </ScaledText>
                  </View>
                ))
              : (
                  <ScaledText
                    style={[styles.bodyText, { color: theme.text, fontFamily: FontFamily.body }]}
                  >
                    {actionsToShow[0]}
                  </ScaledText>
                )}
          </View>
        )}

        {/* Footer link */}
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push({ pathname: '/safety' as any, params: { risk } })
          }
          accessibilityRole="link"
          accessibilityLabel={t('viewFullGuidance')}
        >
          <ScaledText
            style={[styles.footerBtnText, { color: accentColor, fontFamily: FontFamily.bodySemi }]}
          >
            {`▸ ${t('viewFullGuidance')}`}
          </ScaledText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default HeatHealthCard;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    // borderRadius is inherited from GlassStyle (16)
  },

  // 4px left accent strip — absolutely inset on the left
  accentBar: {
    width: 4,
    // height fills the card via flexDirection: 'row' + alignSelf stretch
  },

  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },

  title: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },

  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },

  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  bodyText: {
    fontSize: 12,
    lineHeight: 20,
  },

  actionList: {
    marginTop: 4,
    gap: 4,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },

  bullet: {
    fontSize: 12,
    lineHeight: 20,
    width: 10,
  },

  actionText: {
    fontSize: 12,
    lineHeight: 20,
    flex: 1,
  },

  footerBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },

  footerBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
