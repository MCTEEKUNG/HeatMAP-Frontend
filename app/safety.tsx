import { View, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, GlassStyle, SoftShadow, FontFamily, RiskColors, DesignTokens } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { guidanceFor } from '@/constants/riskGuidance';
import { alertTierFromRiskLevel, alertTierColor, type RiskLevel } from '@/services/forecastService';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_TIERS: RiskLevel[] = ['High', 'Elevated', 'Normal', 'Low'];

const EXHAUSTION_COLOR = '#C98A2D'; // RiskColors.watch equivalent — amber
const STROKE_COLOR = '#A93226';     // RiskColors.extreme — deep red

const HEAT_EXHAUSTION_SYMPTOMS = {
  en: 'Heavy sweating · Cool, pale, clammy skin · Weak rapid pulse · Dizziness, headache, nausea',
  th: 'เหงื่อออกมาก · ผิวเย็นซีดชื้น · ชีพจรเต้นเร็วอ่อนแรง · เวียนหัว ปวดหัว คลื่นไส้',
};

const HEAT_EXHAUSTION_FIRST_AID = {
  en: [
    'Move to cool, shaded place',
    'Loosen tight clothing',
    'Apply cool, wet cloths',
    'Sip water',
    'Seek medical care if no improvement within 1 hour or vomiting',
  ],
  th: [
    'ย้ายไปที่ร่มเย็น',
    'คลายเสื้อผ้า',
    'ใช้ผ้าเย็นเช็ดตัว',
    'จิบน้ำ',
    'ไปพบแพทย์หากไม่ดีขึ้นภายใน 1 ชั่วโมง หรือมีอาเจียน',
  ],
};

const HEAT_STROKE_SYMPTOMS = {
  en: 'Very hot body (>40°C) · Skin hot and DRY (sweating has STOPPED) · Confusion, slurred speech · Seizures · Loss of consciousness',
  th: 'ร่างกายร้อนมาก (>40°C) · ผิวร้อนแห้ง (เหงื่อหยุดออก) · สับสน พูดไม่ชัด · ชัก · หมดสติ',
};

const HEAT_STROKE_FIRST_AID = {
  en: [
    'Call 1669 immediately — this is a medical emergency',
    'Move to cool area',
    'Actively cool the body: ice packs to armpits/neck/groin, wet cloths',
    'Do NOT give fluids if unconscious',
    'Stay with the person until help arrives',
  ],
  th: [
    'โทร 1669 ทันที — นี่คือเหตุฉุกเฉินทางการแพทย์',
    'ย้ายไปที่เย็น',
    'ลดอุณหภูมิร่างกายอย่างรวดเร็ว: ใช้น้ำแข็งประคบรักแร้/คอ/ขาหนีบ ใช้ผ้าเย็น',
    'ห้ามให้ดื่มน้ำหากหมดสติ',
    'อยู่ดูแลจนกว่าความช่วยเหลือจะมาถึง',
  ],
};

// ─── IllnessCard ──────────────────────────────────────────────────────────────

interface IllnessCardProps {
  color: string;
  title: string;
  symptoms: string;
  firstAid: string[];
  theme: typeof Colors.light;
  isDarkMode: boolean;
}

function IllnessCard({ color, title, symptoms, firstAid, theme, isDarkMode }: IllnessCardProps) {
  const { t } = useSettings();
  return (
    <View style={[styles.infoCard, GlassStyle[isDarkMode ? 'dark' : 'light'], SoftShadow.light, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <View style={[styles.accentBar, { backgroundColor: color }]} />
      <View style={styles.tierContent}>
        <ScaledText variant="h4" style={[styles.tierHeadline, { color }]}>
          {title}
        </ScaledText>

        <ScaledText variant="bodySmall" style={[styles.tierWhatsHappening, { color: theme.textSecondary }]}>
          {symptoms}
        </ScaledText>

        <ScaledText style={[styles.subLabel, { color: theme.textMuted }]}>
          {t('firstAid')}
        </ScaledText>
        {firstAid.map((step, i) => (
          <View key={i} style={styles.bulletRow}>
            <ScaledText style={[styles.bulletDot, { color }]}>•</ScaledText>
            <ScaledText variant="bodySmall" style={[styles.bulletText, { color: theme.text }]}>
              {step}
            </ScaledText>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SafetyScreen() {
  const router = useRouter();
  const { risk } = useLocalSearchParams<{ risk?: string }>();
  const { isDarkMode, t, language } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  const highlightedTier = RISK_TIERS.includes(risk as RiskLevel) ? (risk as RiskLevel) : null;

  const glassCard = GlassStyle[isDarkMode ? 'dark' : 'light'];

  const SectionH = ({ children }: { children: string }) => (
    <ScaledText style={[styles.sectionH, { color: theme.textMuted }]}>{children}</ScaledText>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(14,31,51,0.92)' : 'rgba(255,255,255,0.92)' }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconSymbol size={20} name="arrow_back_ios_new" color={theme.icon} />
        </TouchableOpacity>
        <ScaledText variant="h3" style={[styles.headerTitle, { color: theme.text }]}>
          {t('safetyScreenTitle')}
        </ScaledText>
        {/* Spacer to balance header */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section A: Risk Levels & What To Do ── */}
        <SectionH>
          {language === 'th' ? 'ระดับความเสี่ยงและวิธีรับมือ' : 'Risk Levels & What To Do'}
        </SectionH>

        {RISK_TIERS.map((tier) => {
          const guidance = guidanceFor(tier, language === 'th' ? 'th' : 'en');
          const alertTier = alertTierFromRiskLevel(tier);
          const accentColor = alertTierColor(alertTier, isDarkMode);
          const isHighlighted = highlightedTier === tier;

          return (
            <View
              key={tier}
              style={[
                styles.infoCard,
                glassCard,
                SoftShadow.light,
                {
                  borderLeftColor: accentColor,
                  borderLeftWidth: isHighlighted ? 4 : 3,
                  borderColor: isHighlighted ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.8)'),
                  borderWidth: isHighlighted ? 2 : 1,
                },
              ]}
            >
              {/* Accent bar + Headline */}
              <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
              <View style={styles.tierContent}>
                <ScaledText variant="h4" style={[styles.tierHeadline, { color: accentColor }]}>
                  {guidance.headline}
                </ScaledText>

                {/* What's happening */}
                <ScaledText variant="bodySmall" style={[styles.tierWhatsHappening, { color: theme.textSecondary }]}>
                  {guidance.whatsHappening}
                </ScaledText>

                {/* What to do */}
                <ScaledText style={[styles.subLabel, { color: theme.textMuted }]}>
                  {t('whatToDo')}
                </ScaledText>
                {guidance.actions.map((action, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <ScaledText style={[styles.bulletDot, { color: accentColor }]}>•</ScaledText>
                    <ScaledText variant="bodySmall" style={[styles.bulletText, { color: theme.text }]}>
                      {action}
                    </ScaledText>
                  </View>
                ))}

                {/* Who is at risk */}
                {guidance.whoAtRisk.length > 0 && (
                  <>
                    <ScaledText style={[styles.subLabel, { color: theme.textMuted }]}>
                      {t('whoAtRisk')}
                    </ScaledText>
                    <ScaledText variant="bodySmall" style={[styles.whoAtRiskText, { color: theme.textSecondary }]}>
                      {guidance.whoAtRisk.join(' · ')}
                    </ScaledText>
                  </>
                )}

                {/* Warning */}
                {guidance.warning && (
                  <View style={[styles.warningRow, { backgroundColor: accentColor + '18', borderColor: accentColor }]}>
                    <ScaledText variant="bodySmall" style={[styles.warningText, { color: accentColor }]}>
                      ⚠️ {guidance.warning}
                    </ScaledText>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* ── Section B: Recognize Heat Illness ── */}
        <SectionH>
          {language === 'th' ? 'รู้จักอาการ / Recognize heat illness' : 'Recognize Heat Illness'}
        </SectionH>

        <IllnessCard
          color={EXHAUSTION_COLOR}
          title={t('heatExhaustion')}
          symptoms={language === 'th' ? HEAT_EXHAUSTION_SYMPTOMS.th : HEAT_EXHAUSTION_SYMPTOMS.en}
          firstAid={language === 'th' ? HEAT_EXHAUSTION_FIRST_AID.th : HEAT_EXHAUSTION_FIRST_AID.en}
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <IllnessCard
          color={STROKE_COLOR}
          title={t('heatStroke')}
          symptoms={language === 'th' ? HEAT_STROKE_SYMPTOMS.th : HEAT_STROKE_SYMPTOMS.en}
          firstAid={language === 'th' ? HEAT_STROKE_FIRST_AID.th : HEAT_STROKE_FIRST_AID.en}
          theme={theme}
          isDarkMode={isDarkMode}
        />

        {/* ── Section C: Emergency ── */}
        <SectionH>
          {language === 'th' ? 'ฉุกเฉิน' : 'Emergency'}
        </SectionH>

        <TouchableOpacity
          style={[styles.emergencyButton, { backgroundColor: RiskColors.extreme }]}
          onPress={() => Linking.openURL('tel:1669')}
          accessibilityRole="button"
          accessibilityLabel={language === 'th' ? 'โทร 1669 ฉุกเฉิน' : 'Call 1669 Emergency'}
        >
          <ScaledText style={styles.emergencyButtonText}>
            {t('callEmergency')}
          </ScaledText>
        </TouchableOpacity>

        {/* Disclaimer */}
        <ScaledText style={[styles.disclaimer, { color: theme.textMuted }]}>
          {language === 'th'
            ? 'ข้อมูลนี้เป็นการพยากรณ์ความเสี่ยง ไม่ใช่การยืนยันว่าเกิดคลื่นความร้อนแล้ว'
            : 'This is a risk forecast, not a confirmed heatwave event.'}
        </ScaledText>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: DesignTokens.spacing.md,
    paddingBottom: 104,
  },

  // Section heading (like settings.tsx SectionH)
  sectionH: {
    fontSize: 12.5,
    fontFamily: FontFamily.displaySemi,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Shared info card (Section A tier cards + Section B illness cards)
  infoCard: {
    marginBottom: DesignTokens.spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  tierContent: {
    flex: 1,
    padding: DesignTokens.spacing.md,
  },
  tierHeadline: {
    fontWeight: '700',
    marginBottom: DesignTokens.spacing.sm,
  },
  tierWhatsHappening: {
    lineHeight: 20,
    marginBottom: DesignTokens.spacing.sm,
  },
  subLabel: {
    fontSize: 11,
    fontFamily: FontFamily.displaySemi,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: DesignTokens.spacing.sm,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  bulletDot: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
  },
  whoAtRiskText: {
    lineHeight: 20,
  },
  warningRow: {
    marginTop: DesignTokens.spacing.sm,
    padding: DesignTokens.spacing.sm,
    borderRadius: DesignTokens.borderRadius.md,
    borderWidth: 1,
  },
  warningText: {
    lineHeight: 20,
    fontWeight: '600',
  },

  // Emergency button (Section C)
  emergencyButton: {
    paddingVertical: DesignTokens.spacing.lg,
    paddingHorizontal: DesignTokens.spacing.lg,
    borderRadius: DesignTokens.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: DesignTokens.spacing.md,
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Disclaimer
  disclaimer: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: DesignTokens.spacing.md,
    marginBottom: DesignTokens.spacing.md,
  },
});
