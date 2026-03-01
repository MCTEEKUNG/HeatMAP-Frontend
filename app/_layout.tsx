import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useFonts, OpenSans_300Light, OpenSans_400Regular, OpenSans_500Medium, OpenSans_600SemiBold, OpenSans_700Bold } from '@expo-google-fonts/open-sans';
import 'react-native-reanimated';

// Import global CSS for web (Leaflet)
if (Platform.OS === 'web') {
  require('./global.css');
}

import { Colors } from '@/constants/theme';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';

// Import Vercel Analytics for web
let Analytics: any = null;
if (Platform.OS === 'web') {
  const { Analytics: WebAnalytics } = require('@vercel/analytics/react');
  Analytics = WebAnalytics;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

// Custom theme based on Heatwave design
const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

// Inner component that uses settings context
function AppContent({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useSettings();
  const colorScheme = isDarkMode ? 'dark' : 'light';

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    OpenSans_300Light,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <SettingsProvider>
      <AppContent>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="prd" options={{ presentation: 'modal', title: 'Product Requirements' }} />
          <Stack.Screen name="checklist" options={{ presentation: 'modal', title: 'Safety Checklist' }} />
        </Stack>
        {Platform.OS === 'web' && Analytics && <Analytics />}
      </AppContent>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
});
