import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, DesignTokens, BottomNavStyle } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          display: 'none', // Hide default tab bar - using custom bottom nav in screens
        },
      }}>
      {/* Map Tab - Live Map with Grid-Based Risk Overlay */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="map.fill" color={color} />
          ),
        }}
      />
      
      {/* Alerts Tab - Forecast Details */}
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="notifications" color={color} />
          ),
        }}
      />
      
      {/* Safety Tab - Safety Checklist (pointing to index which has checklist content) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Safety',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="shield.fill" color={color} />
          ),
        }}
      />
      
      {/* Settings Tab - Profile */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
