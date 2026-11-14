import { Tabs } from 'expo-router';
import React, { type PropsWithChildren } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Platform, View } from 'react-native';

import { GlassTabBar } from '@/components/ui/GlassTabBar';

function TabScene({ children }: PropsWithChildren) {
  const focused = useIsFocused();

  // Web fallback screens can stay mounted and painted behind a transparent tab.
  return (
    <View style={{ flex: 1, display: focused ? 'flex' : 'none' }}>
      {children}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="map"
      screenLayout={Platform.OS === 'web' ? ({ children }) => <TabScene>{children}</TabScene> : undefined}
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="safety" options={{ title: 'Guide' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
