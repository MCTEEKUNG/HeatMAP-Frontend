import { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, Linking, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, FontFamily, RiskColors, GlassStyle } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GlassTabBar } from '@/components/ui/GlassTabBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskKey = 'High' | 'Elevated' | 'Normal' | 'Low';
type ActivityMode = 'general' | 'outdoor';
type ShelterPhase = 'idle' | 'locating' | 'loading' | 'loaded' | 'empty' | 'denied' | 'error';

interface Step {
  th: [string, string];
  en: [string, string];
  urgent?: boolean; // outdoor-worker prepended steps get distinct styling
}

interface ShelterResult {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance: number; // metres
  icon: string;
  categoryTh: string;
  categoryEn: string;
}

// ─── Shelter cache (module-level, survives tab navigation, cleared on restart) ──
// Prevents repeat API calls within 30 min / 500 m of last fetch.

interface ShelterCache {
  results: ShelterResult[];
  fetchedAt: number; // ms
  lat: number;
  lon: number;
}
let shelterCache: ShelterCache | null = null;
const CACHE_TTL_MS  = 15 * 60 * 1000; // 15 min — cyclist/scooter context changes fast
const CACHE_MOVE_M  = 300;             // re-fetch if user moved > 300 m (~72 s at 15 km/h)

function isCacheValid(lat: number, lon: number): boolean {
  if (!shelterCache) return false;
  if (Date.now() - shelterCache.fetchedAt > CACHE_TTL_MS) return false;
  if (haversine(lat, lon, shelterCache.lat, shelterCache.lon) > CACHE_MOVE_M) return false;
  return true;
}

// Re-compute distances from current position using cached place coordinates.
// Keeps displayed distances accurate even when user has moved within the cache threshold.
function refreshDistances(results: ShelterResult[], lat: number, lon: number): ShelterResult[] {
  return results
    .map(r => ({ ...r, distance: haversine(lat, lon, r.lat, r.lon) }))
    .sort((a, b) => a.distance - b.distance);
}

// ─── Shelter fallback (category-based Google Maps search) ─────────────────────

const SHELTER_CATEGORIES = [
  { icon: 'local_mall',       th: 'ห้างสรรพสินค้า',  en: 'Shopping Mall',   query: 'ห้างสรรพสินค้า shopping mall' },
  { icon: 'local_hospital',   th: 'โรงพยาบาล',        en: 'Hospital',        query: 'โรงพยาบาล hospital' },
  { icon: 'local_library',    th: 'ห้องสมุด',          en: 'Library',         query: 'ห้องสมุดสาธารณะ public library' },
  { icon: 'local_cafe',       th: 'ร้านกาแฟ/คาเฟ่',   en: 'Café',            query: 'ร้านกาแฟ cafe' },
  { icon: 'account_balance',  th: 'อาคารรัฐบาล',      en: 'Gov. Building',   query: 'สำนักงานราชการ government office' },
  { icon: 'place_of_worship', th: 'ศาสนสถาน',          en: 'Temple / Church', query: 'วัด temple' },
];

function openMapsSearch(query: string) {
  Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(query)}`);
}

// ─── Google Places API key (add EXPO_PUBLIC_GOOGLE_PLACES_KEY to .env) ────────
const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';

// Google Places (New API) — included types for cool shelter search
const GOOGLE_PLACE_TYPES = [
  'hospital', 'doctor', 'pharmacy',
  'shopping_mall', 'department_store', 'supermarket',
  'cafe', 'coffee_shop', 'bakery',
  'library',
  'local_government_office', 'city_hall', 'courthouse',
  'hindu_temple', 'mosque', 'church', 'place_of_worship',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} ม.`;
  return `${(m / 1000).toFixed(1)} กม.`;
}

// Maps Google Places primaryType → display icon + labels
function classifyGoogleType(primaryType: string): { icon: string; th: string; en: string } | null {
  if (['hospital', 'doctor', 'pharmacy'].includes(primaryType))
    return { icon: 'local_hospital', th: 'โรงพยาบาล', en: 'Hospital' };
  if (['shopping_mall', 'department_store', 'supermarket'].includes(primaryType))
    return { icon: 'local_mall', th: 'ห้างสรรพสินค้า', en: 'Shopping Mall' };
  if (['cafe', 'coffee_shop', 'bakery'].includes(primaryType))
    return { icon: 'local_cafe', th: 'ร้านกาแฟ', en: 'Café' };
  if (primaryType === 'library')
    return { icon: 'local_library', th: 'ห้องสมุด', en: 'Library' };
  if (['local_government_office', 'city_hall', 'courthouse'].includes(primaryType))
    return { icon: 'account_balance', th: 'อาคารสาธารณะ', en: 'Gov. Building' };
  if (['hindu_temple', 'mosque', 'church', 'place_of_worship'].includes(primaryType))
    return { icon: 'place_of_worship', th: 'วัด/ศาสนสถาน', en: 'Temple' };
  return null;
}

// Maps OSM tags → display (Overpass fallback path)
function classifyElement(tags: Record<string, string>): { icon: string; th: string; en: string } | null {
  const { amenity, shop, office } = tags;
  if (amenity === 'hospital' || amenity === 'clinic') return { icon: 'local_hospital', th: 'โรงพยาบาล', en: 'Hospital' };
  if (shop === 'mall') return { icon: 'local_mall', th: 'ห้างสรรพสินค้า', en: 'Shopping Mall' };
  if (amenity === 'cafe') return { icon: 'local_cafe', th: 'ร้านกาแฟ', en: 'Café' };
  if (amenity === 'library') return { icon: 'local_library', th: 'ห้องสมุด', en: 'Library' };
  if (office === 'government' || office === 'administrative' || amenity === 'townhall' || amenity === 'community_centre')
    return { icon: 'account_balance', th: 'อาคารสาธารณะ', en: 'Gov. Building' };
  if (amenity === 'place_of_worship') return { icon: 'place_of_worship', th: 'วัด/ศาสนสถาน', en: 'Temple' };
  return null;
}

function openNavigation(lat: number, lon: number) {
  const url =
    Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lon}&dirflg=w`
      : Platform.OS === 'android'
        ? `google.navigation:q=${lat},${lon}&mode=w`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
  Linking.openURL(url);
}

// ─── Step data ────────────────────────────────────────────────────────────────

// Prepended when activityMode = 'outdoor' (risk-sensitive)
const OUTDOOR_STEPS: Record<'High' | 'Elevated', Step[]> = {
  High: [
    {
      urgent: true,
      th: ['แจ้งหัวหน้างาน ขอหยุดทันที', 'หยุดงานกลางแจ้งทุกอย่าง ความปลอดภัยสำคัญกว่างาน'],
      en: ['Notify supervisor — stop work now', 'Halt all outdoor work immediately, safety first'],
    },
    {
      urgent: true,
      th: ['ออกจากพื้นที่กลางแจ้ง', 'เข้าร่มหรืออาคารที่มีแอร์ พร้อมน้ำดื่ม อย่ากลับจนกว่าจะเย็นลง'],
      en: ['Exit outdoor area now', "Find shade/A/C with water, don't return until it cools"],
    },
  ],
  Elevated: [
    {
      urgent: true,
      th: ['แจ้งหัวหน้างาน', 'ขอหยุดพักหรือย้ายงานเข้าร่ม ใช้ระบบเพื่อนดูแลกัน'],
      en: ['Notify your supervisor', 'Request break or indoor work, use buddy system'],
    },
  ],
};

const STEPS: Record<RiskKey, Step[]> = {
  High: [
    { th: ['เข้าในร่มทันที',        'หยุดกิจกรรมกลางแจ้งทุกอย่างจนกว่าจะเย็นลง'],       en: ['Go indoors immediately',    'Stop all outdoor activity until it cools'] },
    { th: ['ดื่มน้ำเย็นเดี๋ยวนี้', 'ทุก 15–20 นาที แม้ไม่รู้สึกกระหาย'],               en: ['Drink cool water now',      'Every 15–20 min even if not thirsty'] },
    { th: ['ลดความร้อนร่างกาย',     'แอร์ / พัดลม / ผ้าเย็นประคบคอและรักแร้'],          en: ['Cool your body',            'A/C, fan, or cool cloth on neck & armpits'] },
    { th: ['อย่าอยู่คนเดียว',       'แจ้งคนใกล้ชิดให้คอยสังเกตอาการ'],                  en: ["Don't be alone",            'Tell someone nearby to watch for symptoms'] },
    { th: ['จับสัญญาณอันตราย',      'สับสน / หน้ามืด / ผิวร้อนแห้ง → โทร 1669 ทันที'], en: ['Watch for danger signs',   'Confused, faint, hot dry skin → call 1669'] },
  ],
  Elevated: [
    { th: ['ดื่มน้ำ 8+ แก้ว/วัน',   'ก่อนรู้สึกกระหาย เพิ่มเกลือแร่ถ้าออกกำลังกาย'],    en: ['Drink 8+ glasses/day',      'Before thirst; add electrolytes if exercising'] },
    { th: ['หลีกเลี่ยง 10:00–16:00', 'วางแผนกิจกรรมกลางแจ้งช่วงเช้าหรือเย็น'],          en: ['Avoid 10am–4pm outdoors',   'Plan outdoor activities in morning or evening'] },
    { th: ['แต่งกายสีอ่อน น้ำหนักเบา','ใส่หมวก ทาครีมกันแดด SPF 30+'],                  en: ['Wear light loose clothing', 'Add hat and SPF 30+ sunscreen'] },
    { th: ['ดูแลผู้สูงอายุและเด็กเล็ก','เช็คสถานะทุก 1–2 ชม. ในวันที่ร้อนจัด'],         en: ['Check on elderly & children','Check status every 1–2 hours on hot days'] },
  ],
  Normal: [
    { th: ['ดื่มน้ำให้เพียงพอ',  '6–8 แก้ว/วัน แม้อากาศไม่ร้อนมาก'],               en: ['Stay hydrated',           '6–8 glasses/day even when not very hot'] },
    { th: ['ระวังช่วงเที่ยงวัน',  'ใส่หมวก ทาครีมกันแดดเมื่อออกนอกบ้าน'],           en: ['Be cautious at midday',   'Wear hat and sunscreen outdoors'] },
    { th: ['รู้จักสัญญาณเตือน',   'เวียนหัว คลื่นไส้ เหนื่อยผิดปกติ → หาร่มเย็น'],  en: ['Know the warning signs',  'Dizziness, nausea, unusual fatigue → seek shade'] },
  ],
  Low: [
    { th: ['ดื่มน้ำตามปกติ',     '6–8 แก้ว/วัน'],                                     en: ['Stay hydrated',          '6–8 glasses/day'] },
    { th: ['รักษาสุขภาพตามปกติ', 'ความเสี่ยงต่ำในขณะนี้ แต่สังเกตการเปลี่ยนแปลง'],  en: ['Maintain normal habits', 'Low risk now, but watch for changes'] },
  ],
};

// ─── Risk config ──────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskKey, { color: string; labelTh: string; labelEn: string }> = {
  High:     { color: RiskColors.warning, labelTh: 'เตือนภัย',  labelEn: 'Warning' },
  Elevated: { color: RiskColors.watch,   labelTh: 'เฝ้าระวัง', labelEn: 'Watch' },
  Normal:   { color: RiskColors.safe,    labelTh: 'ปกติ',       labelEn: 'Normal' },
  Low:      { color: '#64748b',          labelTh: 'ต่ำ',        labelEn: 'Low' },
};

const RISK_ORDER: RiskKey[] = ['High', 'Elevated', 'Normal', 'Low'];

// ─── Warning signs ────────────────────────────────────────────────────────────

const WARNINGS = [
  {
    titleTh: 'ฮีทเอ็กซ์ฮอสชัน', titleEn: 'Heat Exhaustion',
    subTh: 'ระดับเบา', subEn: 'mild',
    color: RiskColors.watch,
    symptomsTh: ['เหงื่อออกมาก', 'ผิวเย็นซีดชื้น', 'เวียนหัว ปวดหัว', 'คลื่นไส้'],
    symptomsEn: ['Heavy sweating', 'Cool pale clammy skin', 'Dizziness, headache', 'Nausea'],
    actionTh: 'ย้ายเข้าร่ม · ดื่มน้ำ · ผ้าเย็น',
    actionEn: 'Move to shade · Drink water · Cool cloth',
  },
  {
    titleTh: 'ฮีทสโตรก (ลมแดด)', titleEn: 'Heat Stroke',
    subTh: 'ฉุกเฉิน', subEn: 'emergency',
    color: RiskColors.extreme,
    symptomsTh: ['ผิวร้อนแห้ง เหงื่อหยุด', 'อุณหภูมิร่างกาย >40°C', 'สับสน พูดไม่ชัด', 'ชัก / หมดสติ'],
    symptomsEn: ['Hot dry skin, no sweat', 'Body temp >40°C', 'Confusion, slurred speech', 'Seizures / unconscious'],
    actionTh: 'โทร 1669 ทันที',
    actionEn: 'Call 1669 immediately',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SafetyScreen() {
  const { risk: riskParam } = useLocalSearchParams<{ risk?: string }>();
  const segments = useSegments();
  const isTabMode = segments[0] === '(tabs)';
  const router = useRouter();
  const { isDarkMode, language, t } = useSettings();
  const theme = Colors[isDarkMode ? 'dark' : 'light'];

  const initialRisk: RiskKey = RISK_ORDER.includes(riskParam as RiskKey)
    ? (riskParam as RiskKey)
    : 'Elevated';

  const [selectedRisk, setSelectedRisk] = useState<RiskKey>(initialRisk);
  const [activityMode, setActivityMode] = useState<ActivityMode>('general');
  const [checked, setChecked] = useState<Set<number>>(new Set());

  // Shelter state
  const [shelterPhase, setShelterPhase] = useState<ShelterPhase>('idle');
  const [shelterResults, setShelterResults] = useState<ShelterResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Reset checkboxes and shelter when risk or activity changes
  useEffect(() => {
    setChecked(new Set());
  }, [selectedRisk, activityMode]);

  // Reset shelter when risk changes
  useEffect(() => {
    setShelterPhase('idle');
    setShelterResults([]);
    if (abortRef.current) abortRef.current.abort();
  }, [selectedRisk]);

  const showOutdoorToggle = selectedRisk === 'High' || selectedRisk === 'Elevated';
  const showShelter = selectedRisk === 'High' || selectedRisk === 'Elevated';

  // Compute final steps: outdoor prepend + base steps
  const outdoorPrepend: Step[] =
    activityMode === 'outdoor' && (selectedRisk === 'High' || selectedRisk === 'Elevated')
      ? OUTDOOR_STEPS[selectedRisk]
      : [];
  const steps: Step[] = [...outdoorPrepend, ...STEPS[selectedRisk]];

  const { color: accentColor } = RISK_CONFIG[selectedRisk];
  const isTh = language === 'th';

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const doneCount = checked.size;
  const allDone = doneCount === steps.length;
  const nextStep = steps.findIndex((_, i) => !checked.has(i));

  // ── Fetch helpers ──

  // Google Places (New API) — primary source when key is present
  async function fetchFromGoogle(lat: number, lon: number, signal: AbortSignal): Promise<ShelterResult[]> {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType',
      },
      body: JSON.stringify({
        includedTypes: GOOGLE_PLACE_TYPES,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius: 5000.0,
          },
        },
        languageCode: 'th',
        rankPreference: 'DISTANCE',
      }),
      signal,
    });
    if (!res.ok) throw new Error(`google_${res.status}`);
    const data: { places?: any[] } = await res.json();
    return (data.places ?? [])
      .map((p: any) => {
        const cat = classifyGoogleType(p.primaryType ?? '');
        const name: string = p.displayName?.text ?? '';
        if (!cat || !name) return null;
        const plat: number = p.location?.latitude;
        const plon: number = p.location?.longitude;
        if (!plat || !plon) return null;
        return {
          id: p.id ?? `google-${plat}-${plon}`,
          name,
          lat: plat,
          lon: plon,
          distance: haversine(lat, lon, plat, plon),
          icon: cat.icon,
          categoryTh: cat.th,
          categoryEn: cat.en,
        } satisfies ShelterResult;
      })
      .filter((r): r is ShelterResult => r !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  }

  // Overpass OSM — fallback when no Google key (or on web where CORS blocks Google)
  async function fetchFromOverpass(lat: number, lon: number, signal: AbortSignal): Promise<ShelterResult[]> {
    const query = `[out:json][timeout:10];
(
  node["amenity"~"hospital|clinic"](around:5000,${lat},${lon});
  way["amenity"~"hospital|clinic"](around:5000,${lat},${lon});
  node["shop"="mall"](around:5000,${lat},${lon});
  way["shop"="mall"](around:5000,${lat},${lon});
  node["amenity"="cafe"](around:3000,${lat},${lon});
  node["amenity"="library"](around:5000,${lat},${lon});
  node["office"~"government|administrative"](around:5000,${lat},${lon});
  node["amenity"~"townhall|community_centre"](around:5000,${lat},${lon});
  node["amenity"="place_of_worship"]["religion"="buddhist"](around:3000,${lat},${lon});
);
out center 40;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal,
    });
    if (!res.ok) throw new Error('overpass_error');
    const data: { elements: any[] } = await res.json();
    const results: ShelterResult[] = [];
    for (const el of data.elements) {
      const tags: Record<string, string> = el.tags ?? {};
      const name: string = tags['name:th'] || tags.name || '';
      if (name.length < 2) continue;
      const cat = classifyElement(tags);
      if (!cat) continue;
      const elLat: number = el.type === 'way' ? el.center?.lat : el.lat;
      const elLon: number = el.type === 'way' ? el.center?.lon : el.lon;
      if (!elLat || !elLon) continue;
      results.push({
        id: `${el.type}-${el.id}`,
        name,
        lat: elLat,
        lon: elLon,
        distance: haversine(lat, lon, elLat, elLon),
        icon: cat.icon,
        categoryTh: cat.th,
        categoryEn: cat.en,
      });
    }
    return results.sort((a, b) => a.distance - b.distance).slice(0, 10);
  }

  // ── Main fetch: cache → Google → Overpass → fallback buttons ──
  const fetchShelters = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setShelterPhase('locating');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setShelterPhase('denied'); return; }

      setShelterPhase('loading');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = loc.coords;

      // ── Cache hit: recalculate distances from current GPS, then serve ──
      // Even within the cache threshold the user may have moved up to 300 m,
      // so we always recompute haversine from the actual current position.
      if (isCacheValid(lat, lon)) {
        setShelterResults(refreshDistances(shelterCache!.results, lat, lon));
        setShelterPhase('loaded');
        return;
      }

      let results: ShelterResult[] = [];

      // Google Places: native only (CORS blocks it on web)
      if (GOOGLE_PLACES_KEY && Platform.OS !== 'web') {
        try {
          results = await fetchFromGoogle(lat, lon, ac.signal);
        } catch {
          // fall through to Overpass
        }
      }

      // Overpass: fallback (also primary path on web / when no Google key)
      if (results.length === 0) {
        try {
          results = await fetchFromOverpass(lat, lon, ac.signal);
        } catch {
          // fall through to empty state → category buttons shown
        }
      }

      // ── Save to cache ──
      if (results.length > 0) {
        shelterCache = { results, fetchedAt: Date.now(), lat, lon };
      }

      setShelterResults(results);
      setShelterPhase(results.length > 0 ? 'loaded' : 'empty');
    } catch (err: any) {
      if (err?.name !== 'AbortError') setShelterPhase('error');
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        {isTabMode ? (
          <View style={styles.headerSide} />
        ) : (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerSide}
            accessibilityRole="button"
            accessibilityLabel={isTh ? 'กลับ' : 'Back'}
          >
            <ScaledText style={[styles.backChevron, { color: theme.text }]}>‹</ScaledText>
          </TouchableOpacity>
        )}
        <ScaledText style={[styles.headerTitle, { color: theme.text }]}>
          {t('safetyScreenTitle')}
        </ScaledText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Risk Selector ── */}
        <View style={styles.selectorRow}>
          {RISK_ORDER.map((key) => {
            const cfg = RISK_CONFIG[key];
            const isSelected = key === selectedRisk;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.selectorChip,
                  isSelected
                    ? { backgroundColor: cfg.color, borderColor: cfg.color }
                    : { backgroundColor: 'transparent', borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : theme.border },
                ]}
                onPress={() => setSelectedRisk(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
              >
                <ScaledText style={[styles.selectorText, { color: isSelected ? '#fff' : theme.textMuted }]}>
                  {isTh ? cfg.labelTh : cfg.labelEn}
                </ScaledText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Activity Context Toggle (High / Elevated only) ── */}
        {showOutdoorToggle && (
          <View style={styles.activityRow}>
            <ScaledText style={[styles.activityLabel, { color: theme.textMuted }]}>
              {isTh ? 'คุณอยู่ที่ไหน?' : 'Your situation:'}
            </ScaledText>
            <View style={styles.activityChips}>
              {(['general', 'outdoor'] as const).map((mode) => {
                const isActive = activityMode === mode;
                const iconName = mode === 'general' ? 'house.fill' : 'directions_walk';
                const label = mode === 'general'
                  ? (isTh ? 'ทั่วไป' : 'General')
                  : (isTh ? 'กลางแจ้ง' : 'Outdoor');
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.activityChip,
                      isActive
                        ? { backgroundColor: accentColor, borderColor: accentColor }
                        : { backgroundColor: 'transparent', borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : theme.border },
                    ]}
                    onPress={() => setActivityMode(mode)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <IconSymbol name={iconName} size={14} color={isActive ? '#fff' : theme.textMuted} />
                    <ScaledText style={[styles.activityChipText, { color: isActive ? '#fff' : theme.textMuted }]}>
                      {label}
                    </ScaledText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Steps header + progress ── */}
        <View style={styles.stepsHeader}>
          <ScaledText style={[styles.sectionLabel, { color: theme.textMuted }]}>
            {isTh ? 'ทำตอนนี้เลย' : 'Do this now'}
          </ScaledText>
          {doneCount > 0 && (
            allDone ? (
              <View style={styles.allDoneInline}>
                <IconSymbol name="check_circle" size={14} color={RiskColors.safe} />
                <ScaledText style={[styles.progressText, { color: RiskColors.safe }]}>
                  {isTh ? 'ครบทุกขั้นตอน' : 'All done'}
                </ScaledText>
              </View>
            ) : (
              <ScaledText style={[styles.progressText, { color: accentColor }]}>
                {`${doneCount}/${steps.length}`}
              </ScaledText>
            )
          )}
        </View>

        {/* ── Step Cards ── */}
        {steps.map((step, i) => {
          const [title, detail] = isTh ? step.th : step.en;
          const isDone = checked.has(i);
          const isFirst = i === nextStep;
          const isUrgent = step.urgent === true;

          return (
            <Pressable
              key={`${selectedRisk}-${activityMode}-${i}`}
              onPress={() => toggle(i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              style={({ pressed }) => [
                styles.stepCard,
                GlassStyle[isDarkMode ? 'dark' : 'light'],
                isUrgent && !isDone && { borderLeftWidth: 3, borderLeftColor: accentColor },
                isFirst && !isUrgent && { borderColor: accentColor, borderWidth: 1 },
                isDone && { opacity: 0.55 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={[
                  styles.checkCircle,
                  isDone
                    ? { backgroundColor: RiskColors.safe, borderColor: RiskColors.safe }
                    : isFirst
                      ? { backgroundColor: accentColor, borderColor: accentColor }
                      : { backgroundColor: 'transparent', borderColor: isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)' },
                ]}
              >
                {isDone ? (
                  <IconSymbol name="check" size={16} color="#fff" />
                ) : (
                  <ScaledText style={[styles.checkNum, { color: isFirst ? '#fff' : theme.textMuted }]}>
                    {i + 1}
                  </ScaledText>
                )}
              </View>

              <View style={styles.stepBody}>
                <ScaledText style={[styles.stepTitle, { color: theme.text }, isDone && styles.stepDone]}>
                  {title}
                </ScaledText>
                <ScaledText style={[styles.stepDetail, { color: theme.textMuted }]}>
                  {detail}
                </ScaledText>
              </View>
            </Pressable>
          );
        })}

        {allDone && (
          <View style={[styles.allDoneBanner, { backgroundColor: RiskColors.safe + '18', borderColor: RiskColors.safe + '44' }]}>
            <ScaledText style={[styles.allDoneText, { color: RiskColors.safe }]}>
              {isTh ? 'เยี่ยมมาก! คุณทำครบทุกขั้นตอนแล้ว' : "Great! You've completed all steps"}
            </ScaledText>
          </View>
        )}

        {/* ── Cool Shelter Finder (High / Elevated only) ── */}
        {showShelter && (
          <View style={[styles.shelterCard, GlassStyle[isDarkMode ? 'dark' : 'light'], { borderColor: accentColor + '55', borderWidth: 1 }]}>
            <View style={styles.shelterTitleRow}>
              <IconSymbol name="ac_unit" size={18} color={accentColor} />
              <ScaledText style={[styles.shelterTitle, { color: theme.text }]}>
                {isTh ? 'หาที่พักร้อนใกล้คุณ' : 'Find a Cool Shelter'}
              </ScaledText>
            </View>

            {/* idle */}
            {shelterPhase === 'idle' && (
              <>
                <ScaledText style={[styles.shelterSub, { color: theme.textMuted }]}>
                  {isTh
                    ? 'สำหรับผู้อยู่กลางแจ้ง — ค้นหาสถานที่เย็นที่ใกล้คุณที่สุด'
                    : 'For those outdoors — finds the nearest cool place to escape the heat'}
                </ScaledText>
                <TouchableOpacity
                  style={[styles.shelterFetchBtn, { backgroundColor: accentColor }]}
                  onPress={fetchShelters}
                  accessibilityRole="button"
                >
                  <IconSymbol name="location_on" size={16} color="#fff" />
                  <ScaledText style={styles.shelterFetchText}>
                    {isTh ? 'หาตอนนี้' : 'Find Now'}
                  </ScaledText>
                </TouchableOpacity>
              </>
            )}

            {/* locating / loading */}
            {(shelterPhase === 'locating' || shelterPhase === 'loading') && (
              <View style={styles.shelterCenterRow}>
                <ActivityIndicator size="small" color={accentColor} />
                <ScaledText style={[styles.shelterSub, { color: theme.textMuted, marginLeft: 8 }]}>
                  {shelterPhase === 'locating'
                    ? (isTh ? 'กำลังขอตำแหน่ง...' : 'Getting location...')
                    : (isTh ? 'กำลังค้นหาสถานที่...' : 'Searching nearby places...')}
                </ScaledText>
              </View>
            )}

            {/* results */}
            {shelterPhase === 'loaded' && (
              <>
                <ScaledText style={[styles.shelterSubResult, { color: theme.textMuted }]}>
                  {isTh ? `พบ ${shelterResults.length} สถานที่ใกล้คุณ` : `${shelterResults.length} places near you`}
                  {shelterCache && Date.now() - shelterCache.fetchedAt > 60000
                    ? (isTh
                        ? ` · ${Math.floor((Date.now() - shelterCache.fetchedAt) / 60000)} นาทีที่แล้ว`
                        : ` · ${Math.floor((Date.now() - shelterCache.fetchedAt) / 60000)} min ago`)
                    : null}
                </ScaledText>
                {shelterResults.map((place) => (
                  <View
                    key={place.id}
                    style={[styles.shelterResultRow, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}
                  >
                    <IconSymbol name={place.icon} size={20} color={theme.textMuted} style={styles.shelterResultIcon} />
                    <View style={styles.shelterResultBody}>
                      <ScaledText style={[styles.shelterResultName, { color: theme.text }]} numberOfLines={1}>
                        {place.name}
                      </ScaledText>
                      <ScaledText style={[styles.shelterResultCat, { color: theme.textMuted }]}>
                        {isTh ? place.categoryTh : place.categoryEn} · {formatDist(place.distance)}
                      </ScaledText>
                    </View>
                    <TouchableOpacity
                      style={[styles.shelterNavBtn, { borderColor: accentColor }]}
                      onPress={() => openNavigation(place.lat, place.lon)}
                      accessibilityRole="button"
                      accessibilityLabel={isTh ? `นำทางไปยัง ${place.name}` : `Navigate to ${place.name}`}
                    >
                      <ScaledText style={[styles.shelterNavText, { color: accentColor }]}>
                        {isTh ? 'นำทาง' : 'Go'}
                      </ScaledText>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity onPress={() => { shelterCache = null; setShelterPhase('idle'); setShelterResults([]); }} style={styles.shelterResetRow}>
                  <ScaledText style={[styles.shelterResetText, { color: theme.textMuted }]}>
                    {isTh ? '↺ ค้นหาใหม่' : '↺ Search again'}
                  </ScaledText>
                </TouchableOpacity>
              </>
            )}

            {/* empty — fallback to category buttons */}
            {(shelterPhase === 'empty' || shelterPhase === 'error' || shelterPhase === 'denied') && (
              <>
                <ScaledText style={[styles.shelterSub, { color: theme.textMuted }]}>
                  {shelterPhase === 'denied'
                    ? (isTh ? 'ไม่ได้รับอนุญาต GPS — เลือกหมวดหมู่แทน' : 'Location access denied — browse by category')
                    : shelterPhase === 'error'
                      ? (isTh ? 'เชื่อมต่อไม่ได้ — เลือกหมวดหมู่แทน' : 'Search failed — browse by category')
                      : (isTh ? 'ไม่พบสถานที่ใน 5 กม. — เลือกหมวดหมู่แทน' : 'Nothing found within 5 km — browse by category')}
                </ScaledText>
                <View style={styles.shelterGrid}>
                  {SHELTER_CATEGORIES.map((s) => (
                    <TouchableOpacity
                      key={s.query}
                      style={[styles.shelterBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}
                      onPress={() => openMapsSearch(s.query)}
                      accessibilityRole="button"
                      accessibilityLabel={isTh ? s.th : s.en}
                    >
                      <IconSymbol name={s.icon} size={22} color={theme.textMuted} />
                      <ScaledText style={[styles.shelterLabel, { color: theme.text }]}>
                        {isTh ? s.th : s.en}
                      </ScaledText>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Warning Signs ── */}
        <ScaledText style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 20 }]}>
          {t('warningSigns')}
        </ScaledText>

        <View style={styles.warningRow}>
          {WARNINGS.map((w) => (
            <View
              key={w.titleEn}
              style={[styles.warningCard, GlassStyle[isDarkMode ? 'dark' : 'light'], { borderTopColor: w.color, borderTopWidth: 2 }]}
            >
              <ScaledText style={[styles.warningTitle, { color: w.color }]}>{isTh ? w.titleTh : w.titleEn}</ScaledText>
              <ScaledText style={[styles.warningSub, { color: theme.textMuted }]}>{isTh ? w.subTh : w.subEn}</ScaledText>
              <View style={styles.symptomList}>
                {(isTh ? w.symptomsTh : w.symptomsEn).map((s) => (
                  <View key={s} style={styles.symptomRow}>
                    <View style={[styles.symptomDot, { backgroundColor: w.color }]} />
                    <ScaledText style={[styles.symptomText, { color: theme.text }]}>{s}</ScaledText>
                  </View>
                ))}
              </View>
              <View style={[styles.warningAction, { backgroundColor: w.color + '18', borderColor: w.color + '44' }]}>
                <ScaledText style={[styles.warningActionText, { color: w.color }]}>
                  {isTh ? w.actionTh : w.actionEn}
                </ScaledText>
              </View>
            </View>
          ))}
        </View>

        {/* ── Emergency ── */}
        <TouchableOpacity
          style={[styles.emergencyBtn, { backgroundColor: RiskColors.extreme }]}
          onPress={() => Linking.openURL('tel:1669')}
          accessibilityRole="button"
          accessibilityLabel={t('callEmergency')}
        >
          <IconSymbol name="sos" size={20} color="#fff" />
          <ScaledText style={styles.emergencyText}>
            {t('callEmergency')}
          </ScaledText>
        </TouchableOpacity>

        <ScaledText style={[styles.disclaimer, { color: theme.textMuted }]}>
          {isTh
            ? 'ข้อมูลนี้เป็นการพยากรณ์ความเสี่ยง ไม่ใช่การยืนยันว่าเกิดคลื่นความร้อนแล้ว'
            : 'This is a risk forecast, not a confirmed heatwave event.'}
        </ScaledText>
      </ScrollView>
      {isTabMode && <GlassTabBar active="safety" />}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

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
  backChevron: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FontFamily.display,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: FontFamily.display,
    fontWeight: '700',
    textAlign: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // ── Risk Selector ──
  selectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  selectorChip: {
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectorText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
  },

  // ── Activity Toggle ──
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  activityLabel: {
    fontSize: 11,
    fontFamily: FontFamily.body,
  },
  activityChips: {
    flexDirection: 'row',
    gap: 6,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  activityChipText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
  },
  allDoneInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // ── Section header + progress ──
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.displaySemi,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },

  // ── Step Card ──
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkNum: {
    fontSize: 12,
    fontFamily: FontFamily.displaySemi,
    fontWeight: '700',
    lineHeight: 18,
  },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: {
    fontSize: 14,
    fontFamily: FontFamily.display,
    fontWeight: '700',
    lineHeight: 20,
  },
  stepDone: { textDecorationLine: 'line-through' },
  stepDetail: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    lineHeight: 17,
  },

  // ── All-done banner ──
  allDoneBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  allDoneText: {
    fontSize: 13,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },

  // ── Cool Shelter Finder ──
  shelterCard: {
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
    gap: 10,
  },
  shelterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shelterTitle: {
    fontSize: 14,
    fontFamily: FontFamily.display,
    fontWeight: '700',
    lineHeight: 20,
  },
  shelterSub: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    lineHeight: 16,
  },
  shelterSubResult: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    marginTop: -4,
  },
  shelterFetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  shelterFetchText: {
    fontSize: 13,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
    color: '#fff',
  },
  shelterCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },

  // Result list
  shelterResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  shelterResultIcon: { flexShrink: 0 },
  shelterResultBody: { flex: 1, gap: 1 },
  shelterResultName: {
    fontSize: 13,
    fontFamily: FontFamily.display,
    fontWeight: '600',
    lineHeight: 18,
  },
  shelterResultCat: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    lineHeight: 15,
  },
  shelterNavBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  shelterNavText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '700',
  },
  shelterResetRow: {
    alignSelf: 'flex-start',
    paddingTop: 4,
  },
  shelterResetText: {
    fontSize: 11,
    fontFamily: FontFamily.body,
  },

  // Fallback grid
  shelterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shelterBtn: {
    width: '30.5%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  shelterLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── Warning Signs ──
  warningRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  warningCard: {
    flex: 1,
    borderRadius: 12,
    padding: 11,
    gap: 6,
  },
  warningTitle: {
    fontSize: 13,
    fontFamily: FontFamily.display,
    fontWeight: '700',
    lineHeight: 18,
  },
  warningSub: {
    fontSize: 10,
    fontFamily: FontFamily.body,
    marginTop: -4,
  },
  symptomList: { gap: 4, marginTop: 2 },
  symptomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  symptomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    flexShrink: 0,
  },
  symptomText: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    lineHeight: 16,
    flex: 1,
  },
  warningAction: {
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
  },
  warningActionText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Emergency ──
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#A93226', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  emergencyText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FontFamily.display,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
});
