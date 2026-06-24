import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, DesignTokens, GlassStyle, FontFamily, useResponsive } from '@/constants/theme';
import { colorForLevel, levelFromRiskLevel, type HeatLevel } from '@/constants/heatRisk';
import { GlassTabBar } from '@/components/ui/GlassTabBar';
import { useSettings } from '@/hooks/useSettings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MapGrid, generateThailandGrid, normalizeProvinceName, type GridCell, type Severity, type ProvinceRisk } from '@/components/map';
import { useLocation } from '@/hooks/useLocation';
import { ScaledText } from '@/components/ui/ScaledText';
import { getWeekData, getAllWeekSummaries, formatGeneratedAt, alertTierFromRiskLevel, alertTierColor, type MapForecastPoint } from '@/services/forecastService';
import { getProvinces, type Province } from '@/services/provincesService';
import { ProvinceForecastPanel } from '@/components/forecast/ProvinceForecastPanel';
import { SummaryBar } from '@/components/map/SummaryBar';
import { WeekSegmentedControl } from '@/components/map/WeekSegmentedControl';
import { HeatLegend } from '@/components/map/HeatLegend';
import { useRouter } from 'expo-router';
import { guidanceFor } from '@/constants/riskGuidance';

// Helper function to find grid cell containing user's location
const findUserGridCell = (
  latitude: number,
  longitude: number,
  gridData: GridCell[]
): GridCell | null => {
  for (const cell of gridData) {
    if (
      latitude >= cell.south &&
      latitude <= cell.north &&
      longitude >= cell.west &&
      longitude <= cell.east
    ) {
      return cell;
    }
  }
  return null;
};

// Find the forecast point (one per province centroid) nearest to a coordinate.
// Used to colour every grid cell from the ~77 real province values returned by
// /api/forecast/map (squared-distance is enough for nearest-neighbour ranking).
const nearestPoint = (
  lat: number,
  lng: number,
  points: MapForecastPoint[]
): MapForecastPoint | null => {
  let best: MapForecastPoint | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const dLat = lat - p.lat;
    const dLng = lng - p.lon;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

export default function MapScreen() {
  const { isDarkMode, t, language } = useSettings();
  const router = useRouter();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  // Start with a neutral (uncoloured) grid — overwritten once forecast loads
  const [gridData, setGridData] = useState<GridCell[]>(generateThailandGrid());
  const [mapPoints, setMapPoints] = useState<MapForecastPoint[]>([]);
  // Explicit load state so "no real data" is visually distinct from "low risk":
  //   loading → fetch in flight (grey grid + spinner)
  //   error   → fetch threw / timed out (grey grid + Retry)
  //   empty   → fetch ok but no forecast yet (grey grid + Retry)
  //   ready   → real per-province colours shown
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  // "As of" timestamp from the model run (generated_at on /api/forecast/map)
  const [mapGeneratedAt, setMapGeneratedAt] = useState<string | null>(null);
  useResponsive(); // keeps layout reactive to viewport changes (web resize)

  // ── Province selector state ──────────────────────────────────────────────
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  // Ref so loadForecastMap (a useCallback) can access provinces without stale closure.
  const provincesRef = useRef<Province[]>([]);

  // ── Week selector state (1 = Open-Meteo, 2-4 = S2S model) ──────────────
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(1);
  // National-worst HeatLevel per week — used to colour the risk dot in each pill.
  const [weekSummaries, setWeekSummaries] = useState<Record<1|2|3|4, HeatLevel>>({ 1: 0, 2: 0, 3: 0, 4: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      setProvincesLoading(true);
      const { provinces: list } = await getProvinces();
      if (!active) return;
      setProvinces(list);
      setProvincesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Keep provincesRef in sync so loadForecastMap can read it without a stale closure.
  useEffect(() => { provincesRef.current = provinces; }, [provinces]);

  // Load per-week national-worst HeatLevel once provinces are available.
  // These power the risk dots in the WeekSegmentedControl pills.
  useEffect(() => {
    if (provinces.length === 0) return;
    let active = true;
    getAllWeekSummaries(provinces).then((s) => {
      if (active) setWeekSummaries(s);
    }).catch(() => { /* keep defaults on error */ });
    return () => { active = false; };
  }, [provinces]);

  // Location hook — declared early so lat/lng are available for map positioning
  const {
    location: userLocation,
    status: locationStatus,
    getCurrentLocation,
    requestPermission,
    isLoading: isLocationLoading,
  } = useLocation();

  // Load REAL per-province risk from /api/forecast/map (one calibrated value
  // per province centroid). Each grid cell is coloured by its NEAREST province
  // point's risk_level — no synthetic temperature/Math.sin severity.
  const loadForecastMap = useCallback(async () => {
    setStatus('loading');
    try {
      const points = await getWeekData(selectedWeek, provincesRef.current ?? []);

      if (!Array.isArray(points) || points.length === 0) {
        // Fetch succeeded but no forecast yet — grey grid + retry, not green
        setGridData(generateThailandGrid());
        setMapPoints([]);
        setMapGeneratedAt(null);
        setStatus('empty');
        return;
      }

      setMapPoints(points);
      setMapGeneratedAt(points[0]?.generated_at ?? null);

      const baseGrid = generateThailandGrid();
      // Build province lookup once for the whole grid pass.
      const byId = new Map((provincesRef.current ?? []).map((p) => [p.id, p]));
      const updated = baseGrid.map(cell => {
        const lat = (cell.north + cell.south) / 2;
        const lng = (cell.east  + cell.west)  / 2;
        const np = nearestPoint(lat, lng, points);
        if (!np) return cell;
        // Use canonical level mapping — 'Normal' is now 'moderate' (was missing before).
        const severity: Severity =
          np.risk_level === 'High'     ? 'extreme'
          : np.risk_level === 'Elevated' ? 'high'
          : np.risk_level === 'Normal'   ? 'moderate'
          : 'low';
        // probability is undefined for Week 1 (Open-Meteo has no probability output)
        const probability = Math.round((np.probability ?? 0) * 100);
        const prov = byId.get(np.province_id);
        const provinceName = prov ? normalizeProvinceName(prov.name_en) : undefined;
        return { ...cell, severity, probability, provinceName } as GridCell;
      });
      setGridData(updated);
      setStatus('ready');
    } catch {
      // Network error / timeout — grey grid + retry rather than fake data
      setGridData(generateThailandGrid());
      setMapPoints([]);
      setMapGeneratedAt(null);
      setStatus('error');
    }
  }, [selectedWeek]);

  // Province choropleth data (web): join forecast points with province names.
  // The model forecasts per PROVINCE — polygons are the honest rendering.
  const provinceRisk = useMemo(() => {
    if (mapPoints.length === 0 || provinces.length === 0) return null;
    const byId = new Map(provinces.map((p) => [p.id, p]));
    const rec: Record<string, ProvinceRisk> = {};
    for (const pt of mapPoints) {
      const prov = byId.get(pt.province_id);
      if (!prov) continue;
      const level =
        pt.risk_level === 'High'     ? 'warning'
        : pt.risk_level === 'Elevated' ? 'watch'
        : pt.risk_level === 'Normal'   ? 'normal'
        : 'low';
      rec[normalizeProvinceName(prov.name_en)] = {
        level,
        nameTh: prov.name_th,
        probability: Math.round((pt.probability ?? 0) * 100),
      };
    }
    return rec;
  }, [mapPoints, provinces]);

  // National tier counts for the floating status chip (mockup top-right)
  const tierCounts = useMemo(() => {
    let watch = 0;
    let warn = 0;
    if (provinceRisk) {
      for (const key of Object.keys(provinceRisk)) {
        const lv = provinceRisk[key].level;
        if (lv === 'watch') watch += 1;
        else if (lv === 'warning' || lv === 'extreme') warn += 1;
      }
    }
    return { watch, warn };
  }, [provinceRisk]);

  useEffect(() => {
    loadForecastMap();
  }, [loadForecastMap]);
  
  // Calculate user's current grid cell based on location
  const userGridCell = useMemo(() => {
    if (!userLocation) return null;
    return findUserGridCell(userLocation.latitude, userLocation.longitude, gridData);
  }, [userLocation, gridData]);

  // Get current severity level (null if low/no risk)
  const currentSeverity = userGridCell?.severity || null;

  // The hero "your area" card must reflect data availability, not just severity:
  // when the forecast isn't loaded the grid is the neutral (all-'low') grid, so
  // trusting severity here would show a misleading "Low Risk" green that's
  // indistinguishable from a real low-risk reading. Only honour severity when
  // status === 'ready'; otherwise show a neutral loading/no-data state.
  const dataReady = status === 'ready';
  const heroSeverity = dataReady ? currentSeverity : null;
  // The user's own province — nearest of the 77 centroids to their GPS fix.
  // (provinces always populated: getProvinces falls back to a bundled list.)
  const myProvince = useMemo(() => {
    if (!userLocation || provinces.length === 0) return null;
    let best = provinces[0];
    let bestD = Infinity;
    for (const p of provinces) {
      const dLat = userLocation.latitude - p.lat;
      const dLng = userLocation.longitude - p.lon;
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }, [userLocation, provinces]);

  const myProvincePoint = useMemo(
    () => myProvince ? mapPoints.find((p) => p.province_id === myProvince.id) ?? null : null,
    [myProvince, mapPoints],
  );

  // Hero card — all three values (colour, label, metric) derive from the
  // same myProvincePoint so they always describe the same province.
  const heroRiskLevel = dataReady ? (myProvincePoint?.risk_level ?? null) : null;
  // Use the canonical HeatRisk color for the hero metric text.
  const heatColor = heroRiskLevel
    ? colorForLevel(levelFromRiskLevel(heroRiskLevel))
    : dataReady ? colorForLevel(0) : theme.textSecondary;
  const riskLabel =
    !dataReady
      ? (status === 'loading' ? t('loading') : t('dataUnavailable'))
      : myProvincePoint?.risk_level_th ?? t('lowRisk');
  // Week 1: show peak apparent temperature; Weeks 2-4: show probability %.
  // Guard probability === undefined (Week 1 has no probability from Open-Meteo).
  const riskPct = dataReady && myProvincePoint && myProvincePoint.probability !== undefined
    ? Math.round((myProvincePoint.probability) * 100)
    : null;
  const apparentTempC = dataReady && selectedWeek === 1 && myProvincePoint?.apparent_temp_c !== undefined
    ? myProvincePoint.apparent_temp_c
    : null;

  // Calculate responsive values

  // Handle location button press
  const handleGetLocation = useCallback(async () => {
    if (locationStatus === 'granted') {
      await getCurrentLocation();
    } else {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        await getCurrentLocation();
      }
    }
  }, [locationStatus, requestPermission, getCurrentLocation]);

  // Handle province tap from the map — find province record and open the panel.
  const handleSelectProvince = useCallback((normalizedName: string) => {
    const match = provinces.find(
      (p) => normalizeProvinceName(p.name_en) === normalizedName
    );
    if (match) setSelectedProvince(match);
  }, [provinces]);

  // Auto-get location on first load (optional)
  useEffect(() => {
    // Auto-request location on mount
    if (locationStatus === 'idle') {
      getCurrentLocation();
    }
    // Intentionally mount-only: re-running on locationStatus/getCurrentLocation
    // changes would re-trigger permission prompts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get location coordinates for MapGrid
  const locationCoords = userLocation 
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
    : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Selected-province 7-day forecast panel (from /api/forecast/province/:id) */}
      {selectedProvince && (
        <View style={styles.provincePanel} pointerEvents="box-none">
          {/* Close row — dismisses province panel and restores the "your area" card */}
          <TouchableOpacity
            style={[
              styles.closePanelBtn,
              { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' },
            ]}
            onPress={() => setSelectedProvince(null)}
            accessibilityRole="button"
            accessibilityLabel="ปิดแผงจังหวัด"
          >
            <IconSymbol size={15} name="xmark" color={theme.textSecondary} />
            <ScaledText style={[styles.closePanelText, { color: theme.textSecondary }]}>
              {language === 'th' ? 'ปิด' : 'Close'}
            </ScaledText>
          </TouchableOpacity>
          <ProvinceForecastPanel province={selectedProvince} />
        </View>
      )}

      {/* Map Area with OSM and Grid Overlay */}
      <View style={styles.mapArea}>
        <MapGrid
          gridData={gridData}
          userLocation={locationCoords}
          onUserLocationRequest={handleGetLocation}
          isDarkMode={isDarkMode}
          neutral={status !== 'ready'}
          provinceRisk={provinceRisk}
          style={styles.mapGrid}
          onSelectProvince={handleSelectProvince}
        />

        {/* ── Week segmented control (Week 1–4 with date ranges + risk dots) ── */}
        <View style={styles.weekSelectorRow} pointerEvents="auto">
          <WeekSegmentedControl
            selectedWeek={selectedWeek}
            onSelect={setSelectedWeek}
            weekSummaries={weekSummaries}
          />
        </View>

        {/* Load-state overlays — keep "no data" visually distinct from low risk */}
        {status === 'loading' && (
          <View
            pointerEvents="none"
            style={[styles.statusOverlay, { top: 166 }]}
          >
            <View
              style={[
                styles.statusPill,
                GlassStyle[isDarkMode ? 'dark' : 'light'],
                { backgroundColor: isDarkMode ? 'rgba(24,19,15,0.72)' : 'rgba(255,255,255,0.82)' },
              ]}
            >
              <ActivityIndicator size="small" color={theme.primary} />
              <ScaledText style={[styles.statusText, { color: theme.text }]}>
                {t('loading')}
              </ScaledText>
            </View>
          </View>
        )}

        {(status === 'error' || status === 'empty') && (
          <View
            style={[styles.statusOverlay, { top: 166 }]}
          >
            <View
              style={[
                styles.statusPill,
                GlassStyle[isDarkMode ? 'dark' : 'light'],
                { backgroundColor: isDarkMode ? 'rgba(24,19,15,0.78)' : 'rgba(255,255,255,0.88)' },
              ]}
            >
              <IconSymbol size={18} name="warning" color={theme.textSecondary} />
              <ScaledText style={[styles.statusText, { color: theme.text }]}>
                {status === 'error' ? t('loadFailed') : t('noForecastData')}
              </ScaledText>
              <TouchableOpacity
                onPress={loadForecastMap}
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
              >
                <IconSymbol size={16} name="refresh" color="#fff" />
                <ScaledText style={styles.retryText}>{t('retry')}</ScaledText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Summary bar — title + date range + national status chip ── */}
        <View style={styles.mapTop} pointerEvents="box-none">
          <SummaryBar
            selectedWeek={selectedWeek}
            watchCount={tierCounts.watch}
            warnCount={tierCounts.warn}
            dataReady={dataReady}
          />
        </View>

        {/* Locate FAB — below the status overlay (top ~64+44=108), hugging right edge */}
        <View style={[styles.fabContainer, { right: 12, top: 166 }]}>
          <TouchableOpacity
            style={[
              styles.fab,
              GlassStyle[isDarkMode ? 'dark' : 'light'],
              locationStatus === 'granted' && styles.fabActive,
            ]}
            onPress={handleGetLocation}
            disabled={isLocationLoading}
          >
            {isLocationLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <IconSymbol
                size={24}
                name="my_location"
                color={locationStatus === 'granted' ? theme.primary : theme.textSecondary}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* ── "พื้นที่ของคุณ" glass card — hidden when a province panel is open ── */}
        {!selectedProvince && <View style={[styles.userCard, GlassStyle[isDarkMode ? 'dark' : 'light']]}>
          <View style={styles.ucLocRow}>
            <ScaledText style={[styles.ucLoc, { color: theme.textMuted }]}>
              {language === 'th' ? 'พื้นที่ของคุณ' : 'Your area'}{myProvince ? ` · ${myProvince.name_th}` : ''}
            </ScaledText>
            {status === 'ready' && mapGeneratedAt && (
              <ScaledText style={[styles.ucTs, { color: theme.textMuted }]}>
                {language === 'th' ? 'ข้อมูลเมื่อ' : 'As of'} {formatGeneratedAt(mapGeneratedAt, language as 'th' | 'en')}
              </ScaledText>
            )}
          </View>

          <View style={styles.ucRow}>
            <ScaledText numberOfLines={1} style={[styles.ucRisk, { color: theme.text }]}>
              {riskLabel}
            </ScaledText>
            {/* Week 1: show peak apparent temperature. Weeks 2-4: show probability %. */}
            {apparentTempC !== null && (
              <ScaledText style={[styles.ucPct, { color: heatColor }]}>
                {language === 'th' ? `สูงสุด ${apparentTempC}°C` : `Peak ${apparentTempC}°C`}
              </ScaledText>
            )}
            {riskPct !== null && apparentTempC === null && (
              <ScaledText style={[styles.ucPct, { color: heatColor }]}>
                {language === 'th' ? `โอกาสเกิด ${riskPct}%` : `${riskPct}% risk`}
              </ScaledText>
            )}
          </View>

          {/* Plain-language "what's happening" guidance line */}
          {dataReady && myProvincePoint && (
            <ScaledText style={[styles.ucGuidance, { color: theme.textMuted }]} numberOfLines={2}>
              {guidanceFor(myProvincePoint.risk_level, language).whatsHappening}
            </ScaledText>
          )}

          {/* "ดูวิธีรับมือ" button */}
          {dataReady && myProvincePoint && (
            <TouchableOpacity
              style={[styles.ucCta, { backgroundColor: alertTierColor(alertTierFromRiskLevel(myProvincePoint.risk_level), isDarkMode) + '22' }]}
              onPress={() => router.push({ pathname: '/safety' as any, params: { risk: myProvincePoint!.risk_level } })}
              accessibilityRole="button"
              accessibilityLabel={language === 'th' ? 'ดูคู่มือความปลอดภัย' : 'View safety guide'}
            >
              <ScaledText style={[styles.ucCtaText, { color: alertTierColor(alertTierFromRiskLevel(myProvincePoint.risk_level), isDarkMode) }]}>
                {'▸ ' + (language === 'th' ? 'ดูวิธีรับมือ' : 'See safety guide')}
              </ScaledText>
            </TouchableOpacity>
          )}

          {/* HeatRisk 5-level legend with metric footnote */}
          <View style={[styles.legendWrapper, { borderTopColor: theme.border }]}>
            <HeatLegend selectedWeek={selectedWeek} />
          </View>
        </View>}
      </View>

      {/* Floating liquid-glass tab bar (shared) */}
      <GlassTabBar active="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Summary bar + week selector overlays ──
  mapTop: {
    position: 'absolute',
    top: 14,
    left: 12,
    right: 12,
    zIndex: 30,
  },
  weekSelectorRow: {
    position: 'absolute',
    top: 86,
    left: 12,
    right: 12,
    zIndex: 30,
  },
  userCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 92,
    zIndex: 30,
    borderRadius: 14,
    padding: 12,
  },
  ucLocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  ucLoc: { fontSize: 11, fontFamily: FontFamily.bodyMedium },
  ucTs: { fontSize: 10, fontFamily: FontFamily.body },
  ucRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  ucRisk: { fontSize: 16, fontFamily: FontFamily.display, fontWeight: '700', flexShrink: 1 },
  ucPct: { fontSize: 12, fontFamily: FontFamily.displaySemi, fontWeight: '600' },
  ucGuidance: { fontSize: 11, fontFamily: FontFamily.body, marginTop: 3, lineHeight: 15 },
  ucCta: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 7, alignSelf: 'flex-start' },
  ucCtaText: { fontSize: 11, fontFamily: FontFamily.bodySemi, fontWeight: '600' },
  legendWrapper: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  // ── Legacy dead styles below (kept minimal for reference, safe to delete) ──
  ctaPrimary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 9,
    minHeight: 44,
  },
  ctaPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontFamily: FontFamily.bodySemi, fontWeight: '600' },
  topControls: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 30,
    gap: 8,
    alignItems: 'center',
  },
  asOfPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: DesignTokens.borderRadius.full,
  },
  asOfText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Load-state overlay (loading spinner / error + retry) — centred near the top,
  // above the scrims and hero card so the Retry button is reachable.
  statusOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 28,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: DesignTokens.borderRadius.full,
    maxWidth: '100%',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: DesignTokens.borderRadius.full,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  provincePanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 90,
    zIndex: 25,
  },
  closePanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 6,
  },
  closePanelText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
  },
  warningBanner: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignTokens.spacing.sm,
    paddingVertical: DesignTokens.spacing.sm,
    paddingHorizontal: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  warningSubText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.9,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  mapGrid: {
    flex: 1,
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 230,
  },
  tempCard: {
    position: 'absolute',
    left: 24,
    top: 140,
    paddingTop: DesignTokens.spacing.md + 4,
    paddingBottom: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.xl,
    overflow: 'hidden',
    zIndex: 10,
  },
  tempAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  heatHalo: {
    position: 'absolute',
    top: 6,
    left: -18,
    zIndex: 0,
  },
  tempEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tempBig: {
    fontSize: 54,
    fontWeight: '700',
    lineHeight: 58,
  },
  tempUnit: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 6,
    marginLeft: 2,
  },
  tempChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: DesignTokens.borderRadius.full,
    borderWidth: 1,
  },
  heroCard: {
    position: 'absolute',
    left: 24,
    paddingTop: 12,
    paddingBottom: 11,
    paddingHorizontal: 14,
    borderRadius: DesignTokens.borderRadius.lg,
    overflow: 'hidden',
    gap: 6,
    zIndex: 12,
  },
  heroEyebrow: { fontSize: 10.5, fontWeight: '700' },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroDot: { width: 9, height: 9, borderRadius: 4.5 },
  heroRisk: { fontSize: 21, fontWeight: '700', lineHeight: 24 },
  heroSep: { fontSize: 14, fontWeight: '700', marginHorizontal: 1 },
  heroTemp: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  heroChance: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  legend: {
    position: 'absolute',
    left: 24,
    right: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: DesignTokens.borderRadius.lg,
    zIndex: 11,
    gap: 4,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendTxt: { fontSize: 11, fontWeight: '700' },
  legendNote: { fontSize: 10.5, textAlign: 'center', lineHeight: 14 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  ctaText: { fontSize: 12.5, fontWeight: '700' },
  ctaArrow: { fontSize: 13, fontWeight: '700' },
  tempLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tempValue: {
    fontSize: 38,
    fontWeight: '700',
  },
  tempStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  tempIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tempStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fabContainer: {
    position: 'absolute',
    top: 140,
    zIndex: 10,
    gap: DesignTokens.spacing.sm,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: DesignTokens.borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabActive: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  timelineContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: DesignTokens.borderRadius.xl,
    zIndex: 10,
  },
  timelineContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: DesignTokens.spacing.md + 4,
    paddingHorizontal: DesignTokens.spacing.md,
  },
  timelineItem: {
    alignItems: 'center',
    gap: 6,
    opacity: 0.6,
    minWidth: 50,
  },
  timelineItemActive: {
    opacity: 1,
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timelineTemp: {
    fontSize: 14,
    fontWeight: '500',
  },
  timelineTempActive: {
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.md,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    position: 'relative',
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  activeDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
