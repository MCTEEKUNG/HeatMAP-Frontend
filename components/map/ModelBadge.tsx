/**
 * ModelBadge — trust strip that names the S2S model as the engine behind the
 * 2-4 week outlook and links to the accuracy / track-record screen. This is the
 * thread that tells reviewers the AI has real, validated skill — and lets the
 * public tap through to the evidence.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FontFamily } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';

interface Props {
  onPress: () => void;
}

export function ModelBadge({ onPress }: Props) {
  const { isDarkMode, language } = useSettings();
  const th = language === 'th';
  const bg = isDarkMode ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.12)';
  const border = isDarkMode ? 'rgba(245,158,11,0.32)' : 'rgba(245,158,11,0.30)';
  const tColor = isDarkMode ? '#FFC14D' : '#B45309';
  const linkColor = isDarkMode ? '#9CC2F0' : '#1D4ED8';

  return (
    <TouchableOpacity
      style={[styles.badge, { backgroundColor: bg, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={th ? 'ดูความแม่นยำของโมเดล' : 'View model accuracy'}
    >
      <ScaledText style={[styles.text, { color: tColor }]} numberOfLines={1}>
        {th ? 'ⓘ โมเดล S2S · พยากรณ์ล่วงหน้า 2-4 สัปดาห์' : 'ⓘ S2S model · forecasts 2-4 weeks ahead'}
      </ScaledText>
      <ScaledText style={[styles.link, { color: linkColor }]} numberOfLines={1}>
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
    borderRadius: 12,
    borderWidth: 1,
  },
  text: { fontSize: 10.5, fontFamily: FontFamily.bodySemi, fontWeight: '700', flexShrink: 1 },
  link: { fontSize: 10.5, fontFamily: FontFamily.bodySemi, fontWeight: '700', textDecorationLine: 'underline', flexShrink: 0 },
});
