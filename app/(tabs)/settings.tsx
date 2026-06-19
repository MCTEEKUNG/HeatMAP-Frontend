import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CustomSwitch } from '@/components/ui/CustomSwitch';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, SoftShadow } from '@/constants/theme';
import { GlassTabBar } from '@/components/ui/GlassTabBar';
import { useSettings, Language, FontSize } from '@/hooks/useSettings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScaledText } from '@/components/ui/ScaledText';

const MODEL_LABEL = 'Logistic Regression (Balanced) · Platt Cal';
const SOURCE_LABEL = 'ERA5 / CDS (1994–2023)';

export default function SettingsScreen() {
  const {
    isDarkMode,
    setThemeMode,
    language,
    setLanguage,
    fontSize,
    setFontSize,
    pushNotifications,
    setPushNotifications,
    hapticFeedback,
    setHapticFeedback,
    t,
  } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, SoftShadow.light];

  // ── Sub-components ──────────────────────────────────────────────────────────

  const SectionH = ({ label }: { label: string }) => (
    <ScaledText fontSize={12} style={[styles.sectionH, { color: theme.textMuted }]}>
      {label}
    </ScaledText>
  );

  /** A settings row. Pass `stack` to put the right control below the label (for wide controls). */
  const Row = ({ icon, label, sub, right, last, stack }: {
    icon: string; label: string; sub?: string;
    right: React.ReactNode; last?: boolean; stack?: boolean;
  }) => (
    <View style={[
      stack ? styles.rowStack : styles.row,
      !last && { borderBottomWidth: 1, borderBottomColor: theme.border },
    ]}>
      <View style={styles.rowLeft}>
        <IconSymbol size={20} name={icon as never} color={theme.icon} />
        <View style={styles.rowText}>
          <ScaledText fontSize={15} style={[styles.rowLabel, { color: theme.text }]}>{label}</ScaledText>
          {sub ? (
            <ScaledText fontSize={12} style={[styles.rowSub, { color: theme.textMuted }]}>{sub}</ScaledText>
          ) : null}
        </View>
      </View>
      <View style={stack ? styles.stackRight : undefined}>{right}</View>
    </View>
  );

  const Segmented = <T extends string>({ value, options, onChange }: {
    value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
  }) => (
    <View style={[styles.segmented, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.v}
          style={[styles.segment, value === opt.v && { backgroundColor: theme.primary }]}
          onPress={() => onChange(opt.v)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === opt.v }}
          accessibilityLabel={opt.label}
        >
          <ScaledText fontSize={13} style={[styles.segmentText, { color: value === opt.v ? '#FFFFFF' : theme.textMuted }]}>
            {opt.label}
          </ScaledText>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <ScaledText fontSize={17} style={[styles.headerTitle, { color: theme.text }]}>
            {t('settingsTitle')}
          </ScaledText>
        </View>

        {/* ── Notifications ── */}
        <SectionH label={t('notifications')} />
        <View style={card}>
          <Row
            icon="notifications_active"
            label={t('riskAlerts')}
            sub={t('riskAlertsSub')}
            right={<CustomSwitch value={pushNotifications} onValueChange={setPushNotifications} />}
          />
          <Row
            last
            icon="vibration"
            label={t('hapticFeedback')}
            right={<CustomSwitch value={hapticFeedback} onValueChange={setHapticFeedback} />}
          />
        </View>

        {/* ── Display ── */}
        <SectionH label={t('sectionDisplay')} />
        <View style={card}>
          <Row
            icon="language"
            label={t('language')}
            right={
              <Segmented<Language>
                value={language}
                options={[{ v: 'th', label: 'ไทย' }, { v: 'en', label: 'EN' }]}
                onChange={setLanguage}
              />
            }
          />
          {/* Font-size row: stacked so 3 pills don't crowd the label */}
          <Row
            stack
            icon="format_size"
            label={t('fontSize')}
            right={
              <Segmented<FontSize>
                value={fontSize}
                options={[
                  { v: 'small',   label: t('fontSizeSmall') },
                  { v: 'default', label: t('fontSizeMedium') },
                  { v: 'large',   label: t('fontSizeLarge') },
                ]}
                onChange={setFontSize}
              />
            }
          />
          <Row
            last
            icon={isDarkMode ? 'dark_mode' : 'light_mode'}
            label={t('darkMode')}
            sub={isDarkMode ? t('darkModeOn') : t('darkModeOff')}
            right={<CustomSwitch value={isDarkMode} onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')} />}
          />
        </View>

        {/* ── About the forecast ── */}
        <SectionH label={t('sectionAbout')} />
        <View style={[...card, styles.aboutCard]}>
          {([
            [t('aboutModel'),    MODEL_LABEL],
            [t('aboutCoverage'), t('aboutCoverageVal')],
            [t('aboutSource'),   SOURCE_LABEL],
          ] as const).map(([k, v], i, arr) => (
            <View
              key={k}
              style={[
                styles.aboutRow,
                i < arr.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  borderStyle: 'dashed' as never,
                },
              ]}
            >
              <ScaledText fontSize={12} style={[styles.aboutKey, { color: theme.textMuted }]}>{k}</ScaledText>
              <ScaledText fontSize={12} style={[styles.aboutVal, { color: theme.text }]}>{v}</ScaledText>
            </View>
          ))}
          <ScaledText fontSize={11.5} style={[styles.aboutNote, { color: theme.textMuted }]}>
            {t('aboutHeatwaveDef')}
          </ScaledText>
        </View>

        <ScaledText fontSize={11.5} style={[styles.footerNote, { color: theme.textMuted }]}>
          {t('settingsFooter')}
        </ScaledText>
      </ScrollView>

      <GlassTabBar active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 104, paddingHorizontal: 16 },

  header: {
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontWeight: '700',
  },

  sectionH: {
    fontFamily: FontFamily.displaySemi,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
  },

  // ── Standard row (label left, control right) ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    minHeight: 52,
  },
  // ── Stacked row (label top, control full-width below) ──
  rowStack: {
    flexDirection: 'column',
    gap: 10,
    paddingVertical: 14,
  },
  stackRight: {
    alignSelf: 'stretch',
  },

  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  rowText: { flexShrink: 1 },
  rowLabel: { fontFamily: FontFamily.bodyMedium },
  rowSub: { fontFamily: FontFamily.body, marginTop: 2 },

  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    gap: 2,
    flexShrink: 0,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontFamily: FontFamily.bodySemi, fontWeight: '600' },

  aboutCard: { paddingVertical: 6 },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    flexWrap: 'wrap',
  },
  aboutKey: { fontFamily: FontFamily.body, flexShrink: 0 },
  aboutVal: { fontFamily: FontFamily.bodySemi, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  aboutNote: { fontFamily: FontFamily.body, lineHeight: 19, paddingVertical: 10 },

  footerNote: {
    fontFamily: FontFamily.body,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
});
