import { Platform, Dimensions, useWindowDimensions, Text, TextStyle } from 'react-native';

// Neutral surfaces with semantic heat-risk colors
export const DesignTokens = {
  // Core palette
  primaryColor: '#1c1c1c',
  secondaryColor: '#464646',
  accentColor: '#E8702A',       // Warm accent - RISK-ONLY, never decorative

  // Severity colors (calm risk ramp - muted, not neon)
  severityColors: {
    extreme: '#A93226',  // Deep red - อันตราย
    warning: '#C75B39',  // Muted vermilion - เตือนภัย
    medium: '#C98A2D',   // Muted amber - เฝ้าระวัง (legacy key, = watch)
    low: '#3E7D5B',      // Muted green - ปกติ
  },
  
  // iOS colors
  iosBlue: '#007AFF',
  iosGray: '#8E8E93',
  
  // Background gradient colors
  backgroundGradient: {
    light: ['#f8f8f8', '#e6e6e6'],
    dark: ['#242424', '#0e0e0e'],
  },

  // Surface colors
  surfaceColor: '#FFFFFF',
  glassColor: 'rgba(255, 255, 255, 0.58)',
  glassBorder: 'rgba(255, 255, 255, 0.72)',
  glassDark: 'rgba(30, 30, 30, 0.78)',
  glassBorderDark: 'rgba(255, 255, 255, 0.16)',

  // Text colors
  textPrimary: '#171717',
  textSecondary: '#484848',
  textPrimaryDark: '#f5f5f5',
  textSecondaryDark: '#bdbdbd',

  // Border colors
  borderColor: '#d8d8d8',        // Hairline
  borderColorDark: 'rgba(255, 255, 255, 0.14)',

  // Error/Alert colors (semantic, calm)
  errorColor: '#A93226',
  warningColor: '#C98A2D',
  successColor: '#3E7D5B',

  // Liquid glass recipe (web adds backdropFilter; native uses higher opacity)
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  
  // Spacing based on 8px grid - standardized
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Border radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 9999,
  },
};

// Responsive breakpoints
export const Breakpoints = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// Hook for responsive design
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < Breakpoints.sm;
  const isMobile = width < Breakpoints.md;
  const isTablet = width >= Breakpoints.md && width < Breakpoints.lg;
  const isDesktop = width >= Breakpoints.lg;
  
  return {
    width,
    height,
    isSmall,
    isMobile,
    isTablet,
    isDesktop,
    isLandscape: width > height,
  };
}

// Risk ramp + soft backgrounds (chips/badges) — the ONLY warm colours allowed
export const RiskColors = {
  safe: '#3E7D5B',
  watch: '#C98A2D',
  warning: '#C75B39',
  extreme: '#A93226',
} as const;
export const RiskBg = {
  safe: '#EAF3EE',
  watch: '#F8F0E1',
  warning: '#F8E9E3',
  extreme: '#F5E3E1',
} as const;
export type RiskLevel = keyof typeof RiskColors;

// NWS HeatRisk 5-level colour tokens (used by map choropleth + legend)
// Canonical palette — use constants/heatRisk.ts for logic; these are raw tokens only.
export const HeatRiskColors = ['#DCEBD8', '#FCE33A', '#F39C2C', '#E5352B', '#9B1B9B'] as const;
export const HeatRiskBg     = ['#EAF3EE', '#FEFAE1', '#FDF0DC', '#FAE3E1', '#F3E0F3'] as const;

// Loaded font family names (registered in app/_layout.tsx via expo-google-fonts)
export const FontFamily = {
  display: 'BaiJamjuree_700Bold',
  displaySemi: 'BaiJamjuree_600SemiBold',
  body: 'Anuphan_400Regular',
  bodyMedium: 'Anuphan_500Medium',
  bodySemi: 'Anuphan_600SemiBold',
} as const;

const tintColorLight = DesignTokens.primaryColor;
const tintColorDark = '#eeeeee';

export const Colors = {
  light: {
    // Primary theme
    text: DesignTokens.textPrimary,
    textSecondary: DesignTokens.textSecondary,
    textMuted: '#595959',
    background: '#efefef',
    surface: DesignTokens.surfaceColor,
    glass: DesignTokens.glass.backgroundColor,
    tint: tintColorLight,
    icon: '#484848',
    tabIconDefault: '#595959',
    tabIconSelected: tintColorLight,
    primary: DesignTokens.primaryColor,
    secondary: DesignTokens.secondaryColor,
    accent: DesignTokens.accentColor,
    border: DesignTokens.borderColor,
    
    // Severity colors
    extreme: DesignTokens.severityColors.extreme,
    medium: DesignTokens.severityColors.medium,
    low: DesignTokens.severityColors.low,
    
    // Status colors
    error: DesignTokens.errorColor,
    warning: DesignTokens.warningColor,
    success: DesignTokens.successColor,
    
    // iOS colors
    iosBlue: DesignTokens.iosBlue,
    iosGray: DesignTokens.iosGray,
    
    // Additional
    backdrop: 'rgba(0, 0, 0, 0.4)',
    overlay: 'rgba(255, 255, 255, 0.9)',
  },
  dark: {
    // Primary theme - high contrast
    text: DesignTokens.textPrimaryDark,
    textSecondary: DesignTokens.textSecondaryDark,
    textMuted: '#b3b3b3',
    background: '#121212',
    surface: '#222222',
    glass: DesignTokens.glassDark,
    tint: tintColorDark,
    icon: '#d5d5d5',
    tabIconDefault: '#b3b3b3',
    tabIconSelected: tintColorDark,
    primary: tintColorDark,
    secondary: DesignTokens.secondaryColor,
    accent: DesignTokens.accentColor,
    border: DesignTokens.borderColorDark,
    
    // Severity colors (desaturated tonal variants for dark surfaces)
    extreme: '#D98577',
    medium: '#E0B468',
    low: '#7FB89A',

    // Status colors
    error: '#D98577',
    warning: '#E0B468',
    success: '#7FB89A',
    
    // iOS colors
    iosBlue: DesignTokens.iosBlue,
    iosGray: DesignTokens.iosGray,
    
    // Additional
    backdrop: 'rgba(0, 0, 0, 0.55)',
    overlay: 'rgba(17, 17, 17, 0.95)',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.body,
    serif: 'Georgia',
    rounded: FontFamily.bodyMedium,
    mono: 'Menlo',
    display: FontFamily.display,
  },
  android: {
    sans: FontFamily.body,
    serif: 'serif',
    rounded: FontFamily.bodyMedium,
    mono: 'monospace',
    display: FontFamily.display,
  },
  default: {
    sans: FontFamily.body,
    serif: 'serif',
    rounded: FontFamily.bodyMedium,
    mono: 'monospace',
    display: FontFamily.display,
  },
  web: {
    sans: `'${FontFamily.body}', 'Anuphan', system-ui, -apple-system, 'Segoe UI', sans-serif`,
    display: `'${FontFamily.display}', 'Bai Jamjuree', '${FontFamily.body}', system-ui, sans-serif`,
    serif: "Georgia, 'Times New Roman', serif",
    rounded: `'${FontFamily.bodyMedium}', 'Anuphan', sans-serif`,
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

// Font size scaling factors
export const FONT_SIZE_SCALE = {
  small: 0.85,
  default: 1,
  large: 1.25,
};

// Base font sizes (in pixels)
export const BASE_FONT_SIZES = {
  // Display / Headings
  displayLarge: 38,
  displayMedium: 32,
  displaySmall: 28,
  
  // Headings
  heading1: 24,
  heading2: 22,
  heading3: 20,
  heading4: 18,
  
  // Body
  bodyLarge: 18,
  bodyMedium: 16,
  bodySmall: 14,
  
  // Labels / UI
  labelLarge: 16,
  labelMedium: 14,
  labelSmall: 12,
  
  // Caption
  caption: 11,
};

// Typography sizes based on scale factor
export function getScaledFontSize(baseSize: number, scale: number = 1): number {
  return Math.round(baseSize * scale);
}

// Create scaled typography object
export function createTypography(scale: number = 1) {
  return {
    // Display
    displayLarge: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.displayLarge, scale),
      fontWeight: '700' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.displayLarge, scale) * 1.2,
    },
    displayMedium: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.displayMedium, scale),
      fontWeight: '700' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.displayMedium, scale) * 1.2,
    },
    displaySmall: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.displaySmall, scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.displaySmall, scale) * 1.2,
    },
    
    // Headings
    h1: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.heading1, scale),
      fontWeight: '700' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.heading1, scale) * 1.3,
    },
    h2: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.heading2, scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.heading2, scale) * 1.3,
    },
    h3: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.heading3, scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.heading3, scale) * 1.3,
    },
    h4: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.heading4, scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.heading4, scale) * 1.3,
    },
    
    // Body
    bodyLarge: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.bodyLarge, scale),
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.bodyLarge, scale) * 1.5,
    },
    bodyMedium: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.bodyMedium, scale),
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.bodyMedium, scale) * 1.5,
    },
    bodySmall: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.bodySmall, scale),
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.bodySmall, scale) * 1.5,
    },
    
    // Labels
    labelLarge: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.labelLarge, scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.labelLarge, scale) * 1.4,
    },
    labelMedium: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.labelMedium, scale),
      fontWeight: '500' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.labelMedium, scale) * 1.4,
    },
    labelSmall: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.labelSmall, scale),
      fontWeight: '500' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.labelSmall, scale) * 1.4,
    },
    
    // Caption
    caption: {
      fontSize: getScaledFontSize(BASE_FONT_SIZES.caption, scale),
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: getScaledFontSize(BASE_FONT_SIZES.caption, scale) * 1.4,
    },
  };
}

// Glassmorphism style helper
const glassBlur = Platform.OS === 'web' ? { backdropFilter: 'blur(18px)' } : {};

export const GlassStyle = {
  light: {
    ...glassBlur,
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.64)' : '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.12)',
    borderWidth: 1,
    borderRadius: 16,
  },
  dark: {
    ...glassBlur,
    backgroundColor: Platform.OS === 'web' ? 'rgba(32, 32, 32, 0.66)' : '#222222',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderRadius: 16,
  },
  // Opaque panel variant — for persistent legend & summary bar placed at screen edges
  // (NOT over the coloured choropleth; higher opacity so it doesn't mute map colours)
  panel: {
    light: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.9)',
      borderWidth: 1,
      borderRadius: 20,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 14,
      ...(Platform.OS === 'web'
        ? ({ backdropFilter: 'blur(20px) saturate(180%)' } as any)
        : null),
    },
    dark: {
      backgroundColor: 'rgba(20, 20, 20, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 14,
      ...(Platform.OS === 'web'
        ? ({ backdropFilter: 'blur(20px) saturate(180%)' } as any)
        : null),
    },
  },
};

// Soft shadow style
export const SoftShadow = {
  light: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 12,
  },
};

// Bottom navigation style
export const BottomNavStyle = {
  container: {
    position: 'absolute' as const,
    bottom: 14,
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 999,
    backgroundColor:
      Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.58)' : 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(18px) saturate(170%)' as any,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 12,
  },
  dark: {
    backgroundColor:
      Platform.OS === 'web' ? 'rgba(16, 36, 58, 0.6)' : 'rgba(16, 36, 58, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
};

// Header style
export const HeaderStyle = {
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(239, 239, 239, 0.88)',
    backdropFilter: 'blur(12px)' as any,
    borderBottomWidth: 0,
  },
  dark: {
    backgroundColor: 'rgba(18, 18, 18, 0.88)',
  },
};

// Card style
export const CardStyle = {
  light: {
    backgroundColor: '#FFFFFF',
    borderRadius: DesignTokens.borderRadius.md,
    padding: DesignTokens.spacing.md,
    borderWidth: 1,
    borderColor: DesignTokens.borderColor,
    ...SoftShadow.light,
  },
  dark: {
    backgroundColor: '#222222',
    borderRadius: DesignTokens.borderRadius.md,
    padding: DesignTokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...SoftShadow.dark,
  },
};

// Button styles
export const ButtonStyle = {
  primary: {
    backgroundColor: DesignTokens.primaryColor,
    borderRadius: DesignTokens.borderRadius.lg,
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.lg,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: DesignTokens.primaryColor,
    borderRadius: DesignTokens.borderRadius.lg,
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.lg,
  },
  danger: {
    backgroundColor: DesignTokens.severityColors.extreme,
    borderRadius: DesignTokens.borderRadius.lg,
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.lg,
  },
};
