/**
 * ModelBadge — trust strip that names the S2S model as the engine behind the
 * 2-4 week outlook and links to the accuracy / track-record screen. This is the
 * thread that tells reviewers the AI has real, validated skill — and lets the
 * public tap through to the evidence.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';

interface Props {
  onPress: () => void;
}

export function ModelBadge({ onPress }: Props) {
  const { isDarkMode, language } = useSettings();
  const th = language === 'th';
  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  const border = theme.border;
  const textColor = theme.textMuted;

  return (
    <TouchableOpacity
      style={[styles.badge, { borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={th ? 'ดูความแม่นยำของโมเดล' : 'View model accuracy'}
    >
      <ScaledText style={[styles.text, { color: textColor }]}>
        {th ? 'โมเดล S2S · พยากรณ์ล่วงหน้า 2–4 สัปดาห์' : 'S2S model · 2–4 weeks ahead'}
      </ScaledText>
      <ScaledText style={[styles.link, { color: theme.primary }]} numberOfLines={1}>
        {th ? 'ดูความแม่นยำ ›' : 'Accuracy ›'}
      </ScaledText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  text: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.bodyMedium, flexShrink: 1 },
  link: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.bodyMedium, textDecorationLine: 'underline', flexShrink: 0 },
});
