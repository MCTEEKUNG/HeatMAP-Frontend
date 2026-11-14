import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, FontFamily, GlassStyle } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScaledText } from '@/components/ui/ScaledText';
import { useSettings } from '@/hooks/useSettings';

const TABS: Record<string, { icon: string; labelKey: string }> = {
  map: { icon: 'map.fill', labelKey: 'navMap' },
  safety: { icon: 'ac_unit', labelKey: 'navSafety' },
  settings: { icon: 'settings', labelKey: 'navSettings' },
};

const GAP = 4;

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { isDarkMode, t } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  const surface = GlassStyle[isDarkMode ? 'dark' : 'light'];
  const selected = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
  const [trackWidth, setTrackWidth] = useState(0);
  const tabWidth = Math.max(0, (trackWidth - GAP * (state.routes.length - 1)) / state.routes.length);
  const activeIndex = useSharedValue(state.index);

  useEffect(() => {
    activeIndex.value = withTiming(state.index, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [activeIndex, state.index]);

  const slidingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeIndex.value * (tabWidth + GAP) }],
  }));

  return (
    <View style={[surface, styles.bar]}>
      <View
        style={styles.inner}
        accessibilityRole="tablist"
        onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)}
      >
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { width: tabWidth, backgroundColor: selected }, slidingStyle]}
          />
        )}
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          const isActive = index === state.index;
          const color = isActive ? theme.primary : theme.textSecondary;
          const label = t(tab.labelKey);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (isActive || event.defaultPrevented) return;
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              aria-selected={isActive}
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
            >
              <IconSymbol size={18} name={tab.icon} color={color} />
              <ScaledText variant="labelSmall" style={[styles.label, { color }]}>
                {label}
              </ScaledText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 40,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GAP,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 24,
  },
  pressed: {
    opacity: 0.7,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 48,
    paddingVertical: 4,
    borderRadius: 8,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FontFamily.bodySemi,
  },
});
