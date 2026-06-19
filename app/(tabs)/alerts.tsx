import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, DesignTokens, FontFamily, GlassStyle } from '@/constants/theme';
import { GlassTabBar } from '@/components/ui/GlassTabBar';
import { HistoricalRunBanner } from '@/components/forecast/HistoricalRunBanner';
import { useSettings } from '@/hooks/useSettings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScaledText } from '@/components/ui/ScaledText';
import { useProvinceForecast } from '@/hooks/useProvinceForecast';
import {
  getForecastMap,
  alertTierFromRiskLevel,
  alertTierColor,
  alertTierLabel,
  formatForecastDate,
  formatGeneratedAt,
  riskPercent,
  type AlertTier,
  type MapForecastPoint,
} from '@/services/forecastService';
import { HeatHealthCard } from '@/components/health/HeatHealthCard';
import { tierToRiskLevel, type AlertDisplayTier } from '@/constants/riskGuidance';

// ─── 3-tier risk colour helpers ───────────────────────────────────────────────
// CONVERGED: this screen now reads ONLY the 77-province model
// (/api/forecast/map + /api/forecast/province/:id) — the legacy
// single-location /api/forecast/latest hook has been retired here, so one
// screen can no longer mix two models. The 3-tier display maps 1:1 onto the
// unified alert vocabulary (src/risk.py):
// safe    = 🟢 Green  — tier 'none'    (risk_level low/moderate)
// caution = 🟡 Yellow — tier 'watch'   (risk_level high)
// danger  = 🔴 Red    — tier 'warning' (risk_level extreme)

type RiskLevel = 'safe' | 'caution' | 'danger';

function tierToRisk(tier: AlertTier): RiskLevel {
  return tier === 'warning' ? 'danger' : tier === 'watch' ? 'caution' : 'safe';
}

const RISK_COLORS = {
  safe:    { text: { dark: '#4ADE80', light: '#16A34A' } },
  caution: { text: { dark: '#FDE047', light: '#CA8A04' } },
  danger:  { text: { dark: '#F87171', light: '#DC2626' } },
};

function riskTextColor(risk: RiskLevel, isDark: boolean): string {
  return RISK_COLORS[risk]?.text[isDark ? 'dark' : 'light'] ?? (isDark ? '#A1A1AA' : '#6B7280');
}

// ─── Forecast confidence per week index (0 = Week 2, 1 = Week 3, …) ──────────
// Verified backtest (Jan–Feb 2024, 77 provinces, B=2000 bootstrap):
//   Lead 2: BSS +0.298 AUC 0.592 — strong skill
//   Lead 3: BSS +0.259 AUC 0.686 — strong skill (highest AUC)
//   Lead 4: BSS +0.073 AUC 0.569 — modest skill
//   Lead 5: BSS −0.004 AUC 0.437 — no skill (below climatology)
//   Lead 6: BSS +0.189 AUC 0.462 — calibration artefact, no discrimination
const WEEK_CONFIDENCE: Array<{ th: string; en: string; color: string } | null> = [
  null,                                                                        // Week 2 — BSS +0.298, AUC 0.592
  null,                                                                        // Week 3 — BSS +0.259, AUC 0.686 (best AUC)
  { th: 'skill ลดลง',      en: 'Weakening skill',   color: '#C98A2D' },      // Week 4 — BSS +0.073, AUC 0.569
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const { isDarkMode, t, language } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  // National two-tier alert roll-up (watch / warning) from the per-province map.
  // Tier comes from the server's risk_level (single source of truth: src/risk.py
  // bands nest the alert thresholds — extreme==warning, high==watch).
  const [mapPoints, setMapPoints] = useState<MapForecastPoint[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const fetchMap = useCallback(() => {
    let alive = true;
    setMapLoading(true);
    setMapError(false);
    getForecastMap()
      .then((pts) => {
        if (!alive) return;
        setMapPoints(pts);
        // Empty result is "no data", not a real all-clear — flag it as such.
        setMapError(pts.length === 0);
        setMapLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setMapError(true);
        setMapLoading(false);
      });
    return () => { alive = false; };
  }, []);
  useEffect(() => fetchMap(), [fetchMap]);
  const mapGeneratedAt = useMemo(
    () => formatGeneratedAt(mapPoints[0]?.generated_at),
    [mapPoints],
  );
  const { warningCount, watchCount, rollupDate } = useMemo(() => {
    let warning = 0;
    let watch = 0;
    let soonest: string | null = null;
    for (const p of mapPoints) {
      const tier = alertTierFromRiskLevel(p.risk_level);
      if (tier === 'warning') warning++;
      else if (tier === 'watch') watch++;
      if (soonest === null || p.target_date < soonest) soonest = p.target_date;
    }
    return { warningCount: warning, watchCount: watch, rollupDate: soonest };
  }, [mapPoints]);

  // The user's province: nearest map point to the Bangkok default coordinates.
  // When GPS is wired into this screen, swap these coords for the fix; everything
  // below adapts automatically.
  const HOME_LAT = 13.7563;
  const HOME_LON = 100.5018;
  const provinceId = useMemo(() => {
    if (mapPoints.length === 0) return null;
    let best: MapForecastPoint = mapPoints[0];
    let bestD = Infinity;
    for (const p of mapPoints) {
      const dLat = HOME_LAT - p.lat;
      const dLon = HOME_LON - p.lon;
      const d = dLat * dLat + dLon * dLon;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best.province_id;
  }, [mapPoints]);

  // 7-day per-province forecast — the SAME model the map and roll-up use.
  const {
    days: provinceDays,
    generatedAt: provinceGeneratedAt,
    loading: forecastLoading,
    error: forecastError,
    refresh: refreshProvince,
  } = useProvinceForecast(provinceId);

  // Combined state for the per-province hero/calendar. Because `provinceId` is
  // derived from the national map, a map cold-start/timeout leaves the province
  // hook idle (loading=false, error=null, days=[]) — so we must fold the map
  // stage in, or the hero falsely renders "🟢 Safe" while data is missing.
  // Empty `provinceDays` WITHOUT an error means the province hook simply hasn't
  // started yet (the frame right after the map resolves and sets provinceId) —
  // treat that as still-loading so we never flash "no data" on the happy path.
  const provinceLoading =
    mapLoading ||
    forecastLoading ||
    (provinceId != null && !mapError && !forecastError && provinceDays.length === 0);
  const provinceFailed = !provinceLoading && (mapError || Boolean(forecastError));
  const provinceAsOf = formatGeneratedAt(provinceGeneratedAt);

  const refresh = useCallback(async () => {
    fetchMap();
    await refreshProvince();
  }, [fetchMap, refreshProvince]);

  // Leads 5–6 have no forecast skill (backtest: BSS < 0 or AUC < 0.5).
  // Only show leads 2–4 to users.
  const actionableDays = provinceDays.slice(0, 3);

  // Derive today's headline from the SOONEST province forecast day (today or
  // the nearest upcoming target_date).
  const todayForecast = actionableDays.length > 0 ? actionableDays[0] : null;
  const todayRisk: RiskLevel = todayForecast
    ? tierToRisk(alertTierFromRiskLevel(todayForecast.risk_level))
    : 'safe';

  const heatwaveDays = useMemo(
    () => actionableDays.filter((d) => Boolean(d.predicted_label)).length,
    [provinceDays],
  );
  const avgProbability = useMemo(
    () => actionableDays.length === 0
      ? 0
      : actionableDays.reduce((s, d) => s + Number(d.probability ?? 0), 0) / actionableDays.length,
    [provinceDays],
  );

  const todayLabel =
    todayRisk === 'danger'  ? '🔴 DANGER — Check Safety Guide Now' :
    todayRisk === 'caution' ? '🟡 Caution — Prepare Yourself' :
                              '🟢 Safe — No Heatwave';

  // ── Normal render ──
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <ScaledText style={[styles.headerTitle, { color: theme.text }]}>{t('navAlerts')}</ScaledText>
        <TouchableOpacity onPress={refresh} disabled={forecastLoading} style={styles.headerSide}>
          {forecastLoading
            ? <ActivityIndicator size="small" color={theme.primary} />
            : <IconSymbol size={20} name="refresh" color={theme.textSecondary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Historical-run notice: forecast dates are early 2024 because the
            model's latest complete-feature issue_date is 2023-12-31. */}
        <HistoricalRunBanner issueDate={mapPoints[0]?.issue_date} generatedAt={mapPoints[0]?.generated_at} />

        {/* ── National two-tier alert roll-up ──
            Four explicit states so "all clear" is never confused with "no data":
            loading → spinner; error OR empty fetch → message + Retry;
            data + alerts → counts; data + none → 🟢 all-clear line. */}
        <View style={[styles.nationalCard, GlassStyle[isDarkMode ? 'dark' : 'light']]}>
          {mapLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ScaledText variant="bodySmall" style={{ color: theme.textSecondary, marginLeft: DesignTokens.spacing.sm }}>
                {t('loading')}
              </ScaledText>
            </View>
          ) : mapError ? (
            <View style={styles.stateRow}>
              <IconSymbol size={16} name="error_outline" color={isDarkMode ? '#F87171' : '#EF4444'} />
              <ScaledText variant="bodySmall" style={{ color: isDarkMode ? '#F87171' : '#EF4444', flex: 1, marginLeft: 8 }}>
                {t('loadFailed')}
              </ScaledText>
              <TouchableOpacity style={[styles.retryChip, { borderColor: isDarkMode ? '#F87171' : '#EF4444' }]} onPress={fetchMap}>
                <ScaledText variant="labelSmall" style={{ color: isDarkMode ? '#F87171' : '#EF4444', fontWeight: '700' }}>
                  {t('retry')}
                </ScaledText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScaledText variant="labelMedium" style={[styles.sectionTitle, { color: theme.textSecondary, marginBottom: DesignTokens.spacing.sm }]}>
                {`ภาพรวมทั้งประเทศ · ${mapPoints.length} จังหวัด${rollupDate ? ` · พยากรณ์ ${formatForecastDate(rollupDate)}` : ''}`}
              </ScaledText>
              {warningCount > 0 || watchCount > 0 ? (
                <View style={styles.nationalRow}>
                  <View style={[styles.tierChip, { borderColor: alertTierColor('warning', isDarkMode) }]}>
                    <ScaledText variant="displaySmall" style={[styles.tierNum, { color: alertTierColor('warning', isDarkMode) }]}>{warningCount}</ScaledText>
                    <ScaledText variant="labelSmall" style={[styles.tierLab, { color: alertTierColor('warning', isDarkMode) }]}>🔴 เตือนภัย</ScaledText>
                  </View>
                  <View style={[styles.tierChip, { borderColor: alertTierColor('watch', isDarkMode) }]}>
                    <ScaledText variant="displaySmall" style={[styles.tierNum, { color: alertTierColor('watch', isDarkMode) }]}>{watchCount}</ScaledText>
                    <ScaledText variant="labelSmall" style={[styles.tierLab, { color: alertTierColor('watch', isDarkMode) }]}>🟡 เฝ้าระวัง</ScaledText>
                  </View>
                </View>
              ) : (
                <View style={[styles.allClearRow, { borderColor: alertTierColor('none', isDarkMode) }]}>
                  <ScaledText variant="labelMedium" style={[styles.allClearText, { color: alertTierColor('none', isDarkMode) }]}>
                    🟢 ปกติทุกจังหวัด — ไม่มีการแจ้งเตือนคลื่นความร้อน
                  </ScaledText>
                </View>
              )}
              {mapGeneratedAt !== '' && (
                <ScaledText variant="labelSmall" style={[styles.asOfText, { color: theme.textSecondary }]}>
                  {`${t('asOf')} ${mapGeneratedAt}`}
                </ScaledText>
              )}
            </>
          )}
        </View>

        {/* ── Hero Forecast Card ── */}
        <View style={[styles.heroCard, GlassStyle[isDarkMode ? 'dark' : 'light']]}>
          <ScaledText variant="labelMedium" style={[styles.forecastLabel, { color: theme.primary }]}>
            {t('forecastLabel')}
          </ScaledText>

          <View style={styles.weatherIcon}>
            <View style={styles.sunGlow} />
            <ScaledText variant="displayLarge" style={styles.sunIcon}>
              {todayRisk === 'danger' ? '🔥' : todayRisk === 'caution' ? '☀️' : '🌤️'}
            </ScaledText>
          </View>

          {/* AI risk headline — never assert "Safe" while the forecast is
              loading, failed, or empty (the original misleading-state bug). */}
          {provinceLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ScaledText variant="bodyMedium" style={{ color: theme.textSecondary, marginLeft: DesignTokens.spacing.sm }}>
                {t('loading')}
              </ScaledText>
            </View>
          ) : provinceFailed ? (
            <View style={styles.heroErrorBox}>
              <ScaledText variant="h4" style={[styles.heatStatus, { color: isDarkMode ? '#F87171' : '#EF4444', marginBottom: DesignTokens.spacing.sm }]}>
                {forecastError ? t('loadFailed') : t('noForecastData')}
              </ScaledText>
              <TouchableOpacity style={[styles.retryChip, { borderColor: isDarkMode ? '#F87171' : '#EF4444' }]} onPress={refresh}>
                <ScaledText variant="labelSmall" style={{ color: isDarkMode ? '#F87171' : '#EF4444', fontWeight: '700' }}>
                  {t('retry')}
                </ScaledText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScaledText
                variant="h4"
                style={[styles.heatStatus, { color: riskTextColor(todayRisk, isDarkMode) }]}
              >
                {todayLabel}
              </ScaledText>

              {todayForecast && (
                <ScaledText variant="bodyMedium" style={[styles.forecastDesc, { color: theme.textSecondary }]}>
                  {`${heatwaveDays} heatwave weeks predicted in the next ${actionableDays.length} weeks — ${(avgProbability * 100).toFixed(0)}% average risk`}
                </ScaledText>
              )}

              {provinceAsOf !== '' && (
                <ScaledText variant="labelSmall" style={[styles.asOfText, { color: theme.textSecondary }]}>
                  {`${t('asOf')} ${provinceAsOf}`}
                </ScaledText>
              )}
            </>
          )}
        </View>

        {/* ── Health guidance card (keyed to today's provincial risk) ── */}
        {!provinceLoading && !provinceFailed && todayForecast && (
          <HeatHealthCard risk={tierToRiskLevel(todayRisk as AlertDisplayTier)} />
        )}

        {/* ── 2–4 Week Outlook ── */}
        <View style={styles.calendarSection}>
          <ScaledText variant="labelMedium" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {language === 'th' ? 'แนวโน้ม 2–4 สัปดาห์ข้างหน้า' : '2–4 week outlook'}
          </ScaledText>

          <View style={[styles.calendarCard, GlassStyle[isDarkMode ? 'dark' : 'light']]}>
            {provinceLoading ? (
              <View style={styles.stateRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <ScaledText variant="bodySmall" style={{ color: theme.textSecondary, marginLeft: DesignTokens.spacing.sm }}>
                  {t('loading')}
                </ScaledText>
              </View>
            ) : provinceFailed ? (
              <View style={styles.stateRow}>
                <ScaledText variant="bodySmall" style={{ color: theme.textSecondary, flex: 1 }}>
                  {t('dataUnavailable')}
                </ScaledText>
                <TouchableOpacity style={[styles.retryChip, { borderColor: theme.primary }]} onPress={refresh}>
                  <ScaledText variant="labelSmall" style={{ color: theme.primary, fontWeight: '700' }}>
                    {t('retry')}
                  </ScaledText>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {actionableDays.map((day, i) => {
                  const tier = alertTierFromRiskLevel(day.risk_level);
                  const tierColor = alertTierColor(tier, isDarkMode);
                  const conf = WEEK_CONFIDENCE[i] ?? null;
                  const isUncertain = conf !== null;

                  return (
                    <React.Fragment key={day.target_date}>

                      <View
                        style={[
                          styles.weekRow,
                          { borderBottomColor: theme.border },
                          isUncertain && { opacity: 0.82 },
                        ]}
                      >
                        <View style={styles.weekLeft}>
                          <ScaledText style={[styles.weekTitle, { color: theme.text }]}>
                            {language === 'th' ? `สัปดาห์ที่ ${i + 2}` : `Week ${i + 2}`}
                          </ScaledText>
                          <ScaledText style={[styles.weekDate, { color: theme.textSecondary }]}>
                            {formatForecastDate(day.target_date)}
                          </ScaledText>
                          {conf && (
                            <View style={[styles.confBadge, { backgroundColor: conf.color + '18', borderColor: conf.color + '40' }]}>
                              <ScaledText style={[styles.confText, { color: conf.color }]}>
                                {language === 'th' ? conf.th : conf.en}
                              </ScaledText>
                            </View>
                          )}
                        </View>
                        <View style={styles.weekRight}>
                          <ScaledText style={[styles.weekPct, { color: tierColor }]}>
                            {riskPercent(day.probability)}%
                          </ScaledText>
                          <ScaledText style={[styles.weekTier, { color: tierColor }]}>
                            {alertTierLabel(tier, language)}
                          </ScaledText>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}

                {/* Footnote: verified backtest results */}
                <ScaledText style={[styles.outlookNote, { color: theme.textMuted }]}>
                  {language === 'th'
                    ? 'ทดสอบย้อนหลัง (ม.ค.–ก.พ. 2567, 77 จังหวัด): Lead 2–4 ดีกว่าค่าเฉลี่ยภูมิอากาศ (BSS +0.07 ถึง +0.30) — Lead 5–6 ไม่มี skill ใช้เป็นสัญญาณอ้างอิงเท่านั้น'
                    : 'Backtest (Jan–Feb 2024, 77 provinces): Leads 2–4 beat provincial climatology (BSS +0.07 to +0.30). Leads 5–6 have no forecast skill — treat as climate background only.'}
                </ScaledText>
              </>
            )}
          </View>
        </View>

      </ScrollView>

      {/* Floating liquid-glass tab bar (shared) */}
      <GlassTabBar active="alerts" />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1 },
  centeredContent:{ flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerSide: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: FontFamily.display,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.lg,
    borderRadius: DesignTokens.borderRadius.xl,
  },
  scrollView:   { flex: 1 },
  scrollContent:{ padding: DesignTokens.spacing.lg, paddingBottom: 120 },

  // Shared load-state primitives (loading / error / empty rows)
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.sm,
  },
  retryChip: {
    paddingVertical: DesignTokens.spacing.xs,
    paddingHorizontal: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
    borderWidth: 1,
  },
  asOfText: {
    fontSize: 10,
    marginTop: DesignTokens.spacing.sm,
    textAlign: 'center',
  },
  heroErrorBox: {
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.xl,
  },

  // National two-tier roll-up
  nationalCard: {
    padding:      DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.xl,
    marginBottom: DesignTokens.spacing.lg,
  },
  nationalRow: { flexDirection: 'row', gap: DesignTokens.spacing.md },
  allClearRow: {
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.sm,
    borderRadius: DesignTokens.borderRadius.lg,
    borderWidth: 1,
  },
  allClearText: { fontWeight: '700' },
  tierChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
    borderWidth: 1,
  },
  tierNum: { fontSize: 34, fontWeight: '900', lineHeight: 38 },
  tierLab: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  // Hero
  heroCard: {
    alignItems:   'center',
    padding:       DesignTokens.spacing.lg,
    borderRadius:  DesignTokens.borderRadius.xl,
    marginBottom:  DesignTokens.spacing.lg,
  },
  forecastLabel: {
    fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: DesignTokens.spacing.sm,
  },
  weatherIcon: { position: 'relative', marginBottom: DesignTokens.spacing.lg },
  sunGlow: {
    position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
    backgroundColor: 'rgba(250,204,21,0.2)', borderRadius: 50,
  },
  sunIcon:    { fontSize: 64 },
  tempValue:  { fontSize: 72, fontWeight: '900', marginBottom: DesignTokens.spacing.sm },
  heatStatus: {
    fontSize: 14, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: DesignTokens.spacing.xl,
  },
  forecastDesc: { fontSize: 12, textAlign: 'center', maxWidth: 260 },

  // Calendar / Weekly Outlook
  calendarSection: { marginBottom: DesignTokens.spacing.lg },
  sectionTitle: {
    fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: DesignTokens.spacing.md,
  },
  calendarCard: {
    padding:      DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.xl,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekLeft: {},
  weekTitle: { fontSize: 16, fontWeight: '600' },
  weekDate: { fontSize: 13, marginTop: 2 },
  weekRight: { alignItems: 'flex-end' },
  weekPct: { fontSize: 20, fontWeight: '700' },
  weekTier: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Confidence / uncertainty
  accuracySep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  accuracySepLine: { flex: 1, height: StyleSheet.hairlineWidth },
  accuracySepLabel: { fontSize: 10, fontFamily: FontFamily.bodySemi, fontWeight: '600', letterSpacing: 0.5 },
  confBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 5,
    borderWidth: 1,
  },
  confText: { fontSize: 10, fontFamily: FontFamily.bodySemi, fontWeight: '600' },
  outlookNote: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    lineHeight: 16,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 4,
    textAlign: 'center',
  },

  // Metrics
  metricsSection: { marginBottom: DesignTokens.spacing.lg },
  metricsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: DesignTokens.spacing.md },
  metricCard: {
    width: '47%', padding: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.xl,
  },
  metricHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: DesignTokens.spacing.sm, marginBottom: DesignTokens.spacing.sm,
  },
  metricLabel:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  metricValue:  { fontSize: 24, fontWeight: '700' },
  metricStatus: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },

  // 7-day weather
  dailySection: { marginBottom: DesignTokens.spacing.lg },
  dailyCard: {
    borderRadius: DesignTokens.borderRadius.xl,
    overflow: 'hidden',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.lg,
  },
  dailyDay: { width: 52, fontWeight: '600' },
  dailyMiddle: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  dailyTemps: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Bottom nav
  bottomNav: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'center',
    paddingHorizontal: DesignTokens.spacing.md,
  },
  navItem: {
    alignItems: 'center', justifyContent: 'center',
    width: 64, position: 'relative',
  },
  navLabel: {
    fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 4,
  },
  activeDot: {
    position: 'absolute', bottom: -8,
    width: 4, height: 4, borderRadius: 2,
  },
});
