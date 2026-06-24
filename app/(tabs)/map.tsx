import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, GlassStyle, FontFamily, useResponsive } from '@/constants/theme';
import { levelFromRiskLevel, type HeatLevel } from '@/constants/heatRisk';
import { GlassTabBar } from '@/components/ui/GlassTabBar';
import { useSettings } from '@/hooks/useSettings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MapGrid, generateThailandGrid, normalizeProvinceName, type GridCell, type Severity, type ProvinceRisk } from '@/components/map';
import { useLocation } from '@/hooks/useLocation';
import { ScaledText } from '@/components/ui/ScaledText';
import { getWeekData, getProvinceOutlook, formatGeneratedAt, alertTierFromRiskLevel, alertTierColor, type MapForecastPoint, type OutlookPoint } from '@/services/forecastService';
import { getProvinces, type Province } from '@/services/provincesService';
import { ProvinceForecastPanel } from '@/components/forecast/ProvinceForecastPanel';
import { WeekSegmentedControl } from '@/components/map/WeekSegmentedControl';
import { OutlookSummary } from '@/components/map/OutlookSummary';
import { ModelBadge } from '@/components/map/ModelBadge';
import { RiskGauge } from '@/components/map/RiskGauge';
import { useRouter } from 'expo-router';
import { guidanceFor } from '@/constants/riskGuidance';
import { formatWeekRange } from '@/utils/bangkokTime';

// Nearest province point to a coordinate (squared distance is enough for ranking).
const nearestPoint = (lat: number, lng: number, points: MapForecastPoint[]): MapForecastPoint | null => {
  let best: MapForecastPoint | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const dLat = lat - p.lat;
    const dLng = lng - p.lon;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
};

export default function MapScreen() {
  const { isDarkMode, t, language } = useSettings();
  const router = useRouter();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  const glass = GlassStyle[isDarkMode ? 'dark' : 'light'];
  const th = language === 'th';
  useResponsive();

  const [gridData, setGridData] = useState<GridCell[]>(generateThailandGrid());
  const [mapPoints, setMapPoints] = useState<MapForecastPoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [mapGeneratedAt, setMapGeneratedAt] = useState<string | null>(null);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const provincesRef = useRef<Province[]>([]);

  // Default to the first S2S forecast week — the hero leads with the model's
  // outlook (weeks 2-4), not the current week.
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(2);
  const [outlook, setOutlook] = useState<OutlookPoint[]>([]);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Load provinces (getProvinces falls back to a bundled list, so this resolves fast).
  useEffect(() => {
    let active = true;
    (async () => {
      const { provinces: list } = await getProvinces();
      if (active) setProvinces(list);
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => { provincesRef.current = provinces; }, [provinces]);

  const {
    location: userLocation,
    status: locationStatus,
    getCurrentLocation,
    requestPermission,
    isLoading: isLocationLoading,
  } = useLocation();

  // Selected-week per-province data → drives the map card + the detail gauge.
  const loadForecastMap = useCallback(async () => {
    setStatus('loading');
    try {
      const points = await getWeekData(selectedWeek, provincesRef.current ?? []);
      if (!Array.isArray(points) || points.length === 0) {
        setGridData(generateThailandGrid());
        setMapPoints([]);
        setMapGeneratedAt(null);
        setStatus('empty');
        return;
      }
      setMapPoints(points);
      setMapGeneratedAt(points[0]?.generated_at ?? null);

      const baseGrid = generateThailandGrid();
      const byId = new Map((provincesRef.current ?? []).map((p) => [p.id, p]));
      const updated = baseGrid.map((cell) => {
        const lat = (cell.north + cell.south) / 2;
        const lng = (cell.east + cell.west) / 2;
        const np = nearestPoint(lat, lng, points);
        if (!np) return cell;
        const severity: Severity =
          np.risk_level === 'High' ? 'extreme'
          : np.risk_level === 'Elevated' ? 'high'
          : np.risk_level === 'Normal' ? 'moderate'
          : 'low';
        const probability = Math.round((np.probability ?? 0) * 100);
        const prov = byId.get(np.province_id);
        const provinceName = prov ? normalizeProvinceName(prov.name_en) : undefined;
        return { ...cell, severity, probability, provinceName } as GridCell;
      });
      setGridData(updated);
      setStatus('ready');
    } catch {
      setGridData(generateThailandGrid());
      setMapPoints([]);
      setMapGeneratedAt(null);
      setStatus('error');
    }
  }, [selectedWeek]);

  // Gate on provinces being ready so Week-1 never calls Open-Meteo with empty
  // coordinates (the cold-load race). Re-runs when provinces arrive or week changes.
  useEffect(() => {
    if (provinces.length === 0) return;
    loadForecastMap();
  }, [loadForecastMap, provinces.length]);

  // Province choropleth for the map.
  const provinceRisk = useMemo(() => {
    if (mapPoints.length === 0 || provinces.length === 0) return null;
    const byId = new Map(provinces.map((p) => [p.id, p]));
    const rec: Record<string, ProvinceRisk> = {};
    for (const pt of mapPoints) {
      const prov = byId.get(pt.province_id);
      if (!prov) continue;
      const level =
        pt.risk_level === 'High' ? 'warning'
        : pt.risk_level === 'Elevated' ? 'watch'
        : pt.risk_level === 'Normal' ? 'normal'
        : 'low';
      rec[normalizeProvinceName(prov.name_en)] = {
        level, nameTh: prov.name_th, probability: Math.round((pt.probability ?? 0) * 100),
      };
    }
    return rec;
  }, [mapPoints, provinces]);

  // The user's province — nearest centroid to GPS, or Bangkok before GPS resolves.
  const myProvince = useMemo(() => {
    if (provinces.length === 0) return null;
    if (!userLocation) return provinces.find((p) => p.code === 'BKK') ?? provinces[0];
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

  // The user's 4-week outlook (hero chart). Gated on provinces so Week-1 Open-Meteo
  // gets real coordinates. Re-runs when location resolves the province.
  useEffect(() => {
    if (provinces.length === 0 || !myProvince) return;
    let active = true;
    getProvinceOutlook(myProvince.id, provinces).then((o) => active && setOutlook(o)).catch(() => {});
    return () => { active = false; };
  }, [myProvince, provinces]);

  const dataReady = status === 'ready';
  const myProvincePoint = useMemo(
    () => (myProvince ? mapPoints.find((p) => p.province_id === myProvince.id) ?? null : null),
    [myProvince, mapPoints],
  );

  const riskPct = dataReady && myProvincePoint && myProvincePoint.probability !== undefined
    ? Math.round(myProvincePoint.probability * 100) : null;
  const apparentTempC = dataReady && myProvincePoint?.apparent_temp_c !== undefined
    ? myProvincePoint.apparent_temp_c : null;

  const weekSource = (mapPoints[0]?.source ?? null) as 's2s' | 'open-meteo' | null;
  const isLiveForecast = weekSource === 'open-meteo';

  const gaugeLevel: HeatLevel | null =
    !dataReady || !myProvincePoint ? null
    : myProvincePoint.heat_level !== undefined ? (myProvincePoint.heat_level as HeatLevel)
    : levelFromRiskLevel(myProvincePoint.risk_level);
  const gaugeValueText = apparentTempC !== null ? `${apparentTempC}°C` : riskPct !== null ? `${riskPct}%` : '';
  const gaugeFootnote = isLiveForecast
    ? (th ? 'อุณหภูมิสัมผัสสูงสุด · Open-Meteo' : 'Peak apparent temp · Open-Meteo')
    : (th ? 'ความน่าจะเป็นความเสี่ยง · โมเดล S2S' : 'Risk probability · S2S model');

  const handleGetLocation = useCallback(async () => {
    if (locationStatus === 'granted') { await getCurrentLocation(); }
    else { const ok = await requestPermission(); if (ok) await getCurrentLocation(); }
  }, [locationStatus, requestPermission, getCurrentLocation]);

  const handleSelectProvince = useCallback((normalizedName: string) => {
    const match = provinces.find((p) => normalizeProvinceName(p.name_en) === normalizedName);
    if (match) setSelectedProvince(match);
  }, [provinces]);

  useEffect(() => {
    if (locationStatus === 'idle') getCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationCoords = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : null;

  const asOf = mapGeneratedAt ? formatGeneratedAt(mapGeneratedAt, th ? 'th' : 'en') : '';
  const weekRangeLabel = formatWeekRange(selectedWeek, th ? 'th' : 'en');
  const sourceLabel = !dataReady ? '' : isLiveForecast
    ? (th ? 'พยากรณ์อากาศจริง' : 'live forecast')
    : (th ? 'โมเดล S2S' : 'S2S model');

  // ── Expanded full-screen map ────────────────────────────────────────────────
  if (mapExpanded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.mapArea}>
          <MapGrid
            gridData={gridData}
            userLocation={locationCoords}
            onUserLocationRequest={handleGetLocation}
            isDarkMode={isDarkMode}
            neutral={status !== 'ready'}
            provinceRisk={provinceRisk}
            fitPaddingTop={72}
            style={styles.mapGrid}
            onSelectProvince={handleSelectProvince}
          />

          <View style={styles.expandedPills} pointerEvents="box-none">
            <WeekSegmentedControl selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
          </View>

          <TouchableOpacity
            style={[styles.iconBtn, glass, { top: 14, right: 12 }]}
            onPress={() => setMapExpanded(false)}
            accessibilityRole="button"
            accessibilityLabel={th ? 'ย่อแผนที่' : 'Collapse map'}
          >
            <IconSymbol size={20} name="xmark" color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, glass, { bottom: 100, right: 12 }, locationStatus === 'granted' && styles.fabActive]}
            onPress={handleGetLocation}
            disabled={isLocationLoading}
          >
            {isLocationLoading
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <IconSymbol size={22} name="my_location" color={locationStatus === 'granted' ? theme.primary : theme.textSecondary} />}
          </TouchableOpacity>

          {selectedProvince && (
            <View style={styles.provincePanel} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.closePanelBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}
                onPress={() => setSelectedProvince(null)}
                accessibilityRole="button" accessibilityLabel={th ? 'ปิด' : 'Close'}
              >
                <IconSymbol size={15} name="xmark" color={theme.textSecondary} />
                <ScaledText style={[styles.closePanelText, { color: theme.textSecondary }]}>{th ? 'ปิด' : 'Close'}</ScaledText>
              </TouchableOpacity>
              <ProvinceForecastPanel province={selectedProvince} />
            </View>
          )}
        </View>
        <GlassTabBar active="map" />
      </View>
    );
  }

  // ── Home: scrollable card stack ─────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ScaledText style={[styles.title, { color: theme.text }]}>
          {th ? 'แนวโน้มคลื่นความร้อน' : 'Heatwave outlook'}
        </ScaledText>
        <ScaledText style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
          {(th ? 'พื้นที่ของคุณ' : 'Your area')}{myProvince ? ` · ${th ? myProvince.name_th : myProvince.name_en}` : ''}
          {asOf ? `  ·  ${th ? 'ข้อมูล ณ' : 'as of'} ${asOf}` : ''}
        </ScaledText>

        {/* HERO — forecast-first outlook (weeks 2-4 = S2S model) */}
        <View style={[styles.card, glass]}>
          {outlook.length > 0 ? (
            <OutlookSummary weeks={outlook} selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
          ) : (
            <View style={styles.chartLoading}><ActivityIndicator color={theme.primary} /></View>
          )}
        </View>

        {/* Model trust badge → accuracy screen */}
        <ModelBadge onPress={() => router.push('/accuracy' as any)} />

        {/* Selected-week detail */}
        <View style={[styles.card, glass]}>
          <ScaledText style={[styles.detailHead, { color: theme.textMuted }]} numberOfLines={1}>
            {(th ? `สัปดาห์ที่ ${selectedWeek}` : `Week ${selectedWeek}`)} · {weekRangeLabel}{sourceLabel ? ` · ${sourceLabel}` : ''}
          </ScaledText>

          {gaugeLevel !== null ? (
            <RiskGauge level={gaugeLevel} valueText={gaugeValueText} footnote={gaugeFootnote} />
          ) : (
            <View style={styles.detailStatus}>
              {status === 'loading' && <ActivityIndicator size="small" color={theme.primary} />}
              <ScaledText style={[styles.detailStatusText, { color: theme.textMuted }]}>
                {status === 'loading' ? t('loading')
                  : status === 'error' ? t('loadFailed')
                  : status === 'empty' ? (th ? 'ยังไม่มีพยากรณ์สำหรับสัปดาห์นี้' : 'No forecast for this week yet')
                  : t('dataUnavailable')}
              </ScaledText>
              {(status === 'error' || status === 'empty') && (
                <TouchableOpacity onPress={loadForecastMap} style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
                  <ScaledText style={styles.retryText}>{t('retry')}</ScaledText>
                </TouchableOpacity>
              )}
            </View>
          )}

          {dataReady && myProvincePoint && (
            <ScaledText style={[styles.guide, { color: theme.textMuted }]} numberOfLines={3}>
              {guidanceFor(myProvincePoint.risk_level, language).whatsHappening}
            </ScaledText>
          )}
          {dataReady && myProvincePoint && (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: alertTierColor(alertTierFromRiskLevel(myProvincePoint.risk_level), isDarkMode) + '22' }]}
              onPress={() => router.push({ pathname: '/safety' as any, params: { risk: myProvincePoint!.risk_level } })}
              accessibilityRole="button" accessibilityLabel={th ? 'ดูคู่มือความปลอดภัย' : 'View safety guide'}
            >
              <ScaledText style={[styles.ctaText, { color: alertTierColor(alertTierFromRiskLevel(myProvincePoint.risk_level), isDarkMode) }]}>
                {'▸ ' + (th ? 'ดูวิธีรับมือ' : 'See safety guide')}
              </ScaledText>
            </TouchableOpacity>
          )}
        </View>

        {/* Map card — tap to expand full-screen */}
        <View style={[styles.card, glass, styles.mapCard]}>
          <View style={styles.mapCardHead}>
            <ScaledText style={[styles.cardTitle, { color: theme.text }]}>
              {th ? 'แผนที่ทั้งประเทศ' : 'National map'}
            </ScaledText>
            <ScaledText style={[styles.mapHint, { color: theme.textMuted }]}>
              {th ? `สัปดาห์ที่ ${selectedWeek}` : `Week ${selectedWeek}`}
            </ScaledText>
          </View>
          <View style={styles.mapMiniWrap}>
            <MapGrid
              gridData={gridData}
              userLocation={locationCoords}
              isDarkMode={isDarkMode}
              neutral={status !== 'ready'}
              provinceRisk={provinceRisk}
              fitPaddingTop={12}
              style={styles.mapMini}
            />
            {/* Tap-catcher: whole mini-map expands; also stops Leaflet eating page scroll */}
            <TouchableOpacity
              style={styles.mapTapCatcher}
              activeOpacity={0.85}
              onPress={() => setMapExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel={th ? 'ขยายแผนที่' : 'Expand map'}
            >
              <View style={[styles.expandChip, glass]}>
                <IconSymbol size={16} name="open_in_full" color={theme.text} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <GlassTabBar active="map" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 12, paddingBottom: 110, gap: 10 },
  title: { fontSize: 22, fontFamily: FontFamily.display, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 11.5, fontFamily: FontFamily.bodyMedium, marginTop: 1, marginBottom: 2 },
  card: { borderRadius: 18, padding: 14 },
  cardTitle: { fontSize: 13, fontFamily: FontFamily.bodySemi, fontWeight: '700', marginBottom: 6 },
  chartLoading: { height: 150, alignItems: 'center', justifyContent: 'center' },
  detailHead: { fontSize: 11, fontFamily: FontFamily.bodyMedium, marginBottom: 8 },
  detailStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  detailStatusText: { fontSize: 13, fontFamily: FontFamily.bodyMedium, flexShrink: 1 },
  retryBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  guide: { fontSize: 11.5, fontFamily: FontFamily.body, marginTop: 10, lineHeight: 16 },
  cta: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 9, alignSelf: 'flex-start' },
  ctaText: { fontSize: 11.5, fontFamily: FontFamily.bodySemi, fontWeight: '600' },
  // map card
  mapCard: { padding: 10 },
  mapCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  mapHint: { fontSize: 10, fontFamily: FontFamily.body },
  mapMiniWrap: { height: 190, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mapMini: { flex: 1 },
  mapTapCatcher: { ...StyleSheet.absoluteFillObject, alignItems: 'flex-end', justifyContent: 'flex-start', padding: 8 },
  expandChip: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  // expanded
  mapArea: { flex: 1, position: 'relative' },
  mapGrid: { flex: 1 },
  expandedPills: { position: 'absolute', top: 14, left: 12, right: 60, zIndex: 30 },
  iconBtn: { position: 'absolute', width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 31 },
  fabActive: { borderWidth: 2, borderColor: '#3b82f6' },
  // province panel
  provincePanel: { position: 'absolute', left: 12, right: 12, bottom: 96, zIndex: 32 },
  closePanelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, marginBottom: 6 },
  closePanelText: { fontSize: 12, fontFamily: FontFamily.bodySemi, fontWeight: '600' },
});
