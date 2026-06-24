/**
 * MapGrid Component - OSM Map with Grid-based Heatwave Overlay
 * 
 * Uses react-native-maps for cross-platform support
 * with vector-based square grid cells representing 
 * heatwave prediction severity by latitude/longitude bounding boxes.
 * 
 * Cells are coloured from real per-province AI forecast data fetched
 * from the backend (/api/forecast/map); the grid starts neutral.
 * 
 * Grid System for Thailand:
 * - Covers full country boundaries (5.6°N to 20.5°N, 97.3°E to 105.6°E)
 * - Configurable cell size (default 0.5 degrees)
 * - Designed for future AI prediction integration
 */

import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { type RiskLevel } from '@/constants/theme';
import { colorForLevel, levelFromSeverity, levelFromRiskLevel } from '@/constants/heatRisk';

// Calm Authority: desaturated CARTO basemaps (free; OSM data) so the only
// saturated colour on screen is the risk layer itself.
const TILE_LAYERS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>';

// ── Province choropleth (the model forecasts per PROVINCE per day — heatwaves
// are regional, not point hotspots, so polygons are the honest rendering) ──
export type ChoroplethLevel = RiskLevel | 'normal' | 'low';
export interface ProvinceRisk {
  level: ChoroplethLevel;
  nameTh: string;
  probability: number;    // 0-100
}

const THAILAND_GEOJSON_URL =
  'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';
let thailandGeoPromise: Promise<any> | null = null;
function fetchThailandGeo(): Promise<any> {
  if (!thailandGeoPromise) {
    thailandGeoPromise = fetch(THAILAND_GEOJSON_URL).then((r) => r.json())
      .catch((e) => { thailandGeoPromise = null; throw e; });
  }
  return thailandGeoPromise;
}

// Normalise English province names so the GeoJSON ("Bangkok Metropolis",
// "Phangnga") joins with the DB's name_en ("Bangkok", "Phang Nga").
export function normalizeProvinceName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

export function riskForFeatureName(
  geoName: string,
  byNormName: Record<string, ProvinceRisk>,
): ProvinceRisk | null {
  const n = normalizeProvinceName(geoName);
  if (byNormName[n]) return byNormName[n];
  for (const key of Object.keys(byNormName)) {
    if (n.includes(key) || key.includes(n)) return byNormName[key];
  }
  return null;
}

// Thailand geographic boundaries
const THAILAND_BOUNDS = {
  north: 20.5,
  south: 5.6,
  east: 105.6,
  west: 97.3,
};

// Grid configuration
const GRID_CONFIG = {
  cellSize: 0.5, // degrees - adjustable for resolution
};

// Types for grid cell data
// Four tiers matching Heat Index thresholds:
//   extreme  = HI ≥ 41°C  → RED
//   high     = HI 35–40°C → ORANGE
//   moderate = HI 28–34°C → YELLOW
//   low      = HI < 28°C  → GREEN
// Plus a non-data 'neutral' tier (GREY) used while the forecast is loading or
// failed — so "no data yet" is visually distinct from genuine low risk.
export type Severity = 'extreme' | 'high' | 'moderate' | 'low' | 'neutral';

export interface GridCell {
  id: string;
  // Latitude/Longitude bounding box
  north: number;
  south: number;
  east: number;
  west: number;
  // Center point for label
  centerLat: number;
  centerLng: number;
  // Prediction data (from AI or mock)
  severity: Severity;
  temperature: number;
  probability: number; // 0-100 confidence
  timestamp: string;
  // Grid position for reference
  gridRow: number;
  gridCol: number;
  // Nearest province (set in map.tsx after forecast + provinces load; native tap-selection)
  provinceName?: string;
}

// Default map region - showing all of Thailand
const DEFAULT_REGION = {
  latitude: 13.5,
  longitude: 100.5,
  latitudeDelta: 16,
  longitudeDelta: 10,
};

/**
 * Generate the base Thailand grid cells.
 * Cells start neutral (low severity, no colour) and are meant to be
 * overwritten by real per-province AI forecast data from the backend.
 *
 * @param cellSize - Size of each grid cell in degrees
 * @returns Array of GridCell objects
 */
export function generateThailandGrid(
  cellSize: number = GRID_CONFIG.cellSize,
): GridCell[] {
  const cells: GridCell[] = [];
  const { north, south, east, west } = THAILAND_BOUNDS;

  const latSteps = Math.ceil((north - south) / cellSize);
  const lngSteps = Math.ceil((east - west) / cellSize);

  for (let row = 0; row < latSteps; row++) {
    for (let col = 0; col < lngSteps; col++) {
      const cellNorth = north - row * cellSize;
      const cellSouth = cellNorth - cellSize;
      const cellWest  = west  + col * cellSize;
      const cellEast  = cellWest + cellSize;

      const centerLat = (cellNorth + cellSouth) / 2;
      const centerLng = (cellWest  + cellEast)  / 2;

      const severity: Severity = 'low';
      const temperature = 28;
      const probability = 0;

      cells.push({
        id: `cell-${row}-${col}`,
        north: cellNorth,
        south: cellSouth,
        east:  cellEast,
        west:  cellWest,
        centerLat,
        centerLng,
        severity,
        temperature,
        probability,
        timestamp:  new Date().toISOString(),
        gridRow: row,
        gridCol: col,
      });
    }
  }

  return cells;
}

// Zone colours — delegate to the canonical HeatRisk palette (constants/heatRisk.ts).
// 'neutral' (no data / loading state) uses grey and is NOT routed through HeatRisk.
export const getSeverityColor = (severity: Severity): string => {
  if (severity === 'neutral') return 'rgba(148, 163, 184, 0.35)';
  return colorForLevel(levelFromSeverity(severity));
};

export const getSeverityBorderColor = (severity: Severity): string => {
  if (severity === 'neutral') return 'rgba(148, 163, 184, 0.55)';
  // Slightly darker (overlay hex with 90% opacity via appended alpha hex)
  return colorForLevel(levelFromSeverity(severity)) + 'E6';
};

// Web Leaflet Map Component
function WebLeafletMap({
  gridData,
  userLocation,
  onGetLocation,
  isDarkMode,
  neutral,
  provinceRisk,
  onSelectProvince,
  fitPaddingTop = 16,
}: {
  gridData: GridCell[];
  userLocation: { latitude: number; longitude: number } | null;
  onGetLocation: () => void;
  isDarkMode: boolean;
  neutral: boolean;
  provinceRisk?: Record<string, ProvinceRisk> | null;
  onSelectProvince?: (provinceName: string) => void;
  fitPaddingTop?: number;
}) {
  const [MapView, setMapView] = useState<any>(null);
  const [thailandGeo, setThailandGeo] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      // Web-only dynamic require: react-leaflet/leaflet must never be bundled for native.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ReactLeaflet = require('react-leaflet');
      const { MapContainer, TileLayer, Polygon, Marker, GeoJSON, useMap } = ReactLeaflet;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      setMapView({ MapContainer, TileLayer, Polygon, Marker, GeoJSON, useMap, L: require('leaflet') });
    } catch (e) {
      console.log('Leaflet not available:', e);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    fetchThailandGeo().then(setThailandGeo).catch((e) => {
      console.warn('Thailand GeoJSON unavailable, falling back to grid:', e);
    });
  }, []);

  // Keep the hero map framed on the whole country so risk colours are readable
  // at a glance. We deliberately DON'T snap-zoom to the user's GPS fix (that
  // zoomed to street-level ocean and pushed every province polygon off-screen);
  // the user's position is still shown via the pulsing marker on the country map.
  const MapController = ({ userLoc: _userLoc }: { userLoc: { latitude: number; longitude: number } | null }) => {
    const map = MapView?.useMap();

    useEffect(() => {
      if (!map || !MapView?.L) return;
      // Fit the full Thailand extent once the map is ready. `fitPaddingTop` clears
      // any controls floating over the top (week pills in the expanded view ~72px;
      // ~12px for the mini card which has no overlay). Bottom keeps a small margin.
      const bounds = MapView.L.latLngBounds(
        [THAILAND_BOUNDS.south, THAILAND_BOUNDS.west],
        [THAILAND_BOUNDS.north, THAILAND_BOUNDS.east],
      );
      map.fitBounds(bounds, {
        paddingTopLeft: [16, fitPaddingTop],
        paddingBottomRight: [16, 24],
      });
    }, [map, fitPaddingTop]);

    return null;
  };

  if (!MapView) {
    return (
      <View style={styles.webFallback}>
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  const { MapContainer, TileLayer, Polygon, Marker, GeoJSON } = MapView;

  // Get the appropriate tile layer URL based on theme
  const tileLayerUrl = isDarkMode ? TILE_LAYERS.dark : TILE_LAYERS.light;

  // Choropleth mode: real province polygons shaded by forecast tier. Active
  // whenever the boundaries + per-province risk are both available.
  const choropleth = !neutral && provinceRisk && Object.keys(provinceRisk).length > 0 && thailandGeo;

  // Convert grid cell to Leaflet polygon positions
  const getPolygonPositions = (cell: GridCell): [number, number][] => {
    return [
      [cell.north, cell.west],
      [cell.north, cell.east],
      [cell.south, cell.east],
      [cell.south, cell.west],
    ];
  };

  // Custom user location marker icon
  const userLocationIcon = MapView.L?.divIcon({
    className: 'user-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: #16324F;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(16,36,58,0.35);
        position: relative;
      ">
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          background: rgba(22, 50, 79, 0.2);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 2s infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const initialRegion = userLocation 
    ? { 
        latitude: userLocation.latitude, 
        longitude: userLocation.longitude,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }
    : DEFAULT_REGION;

  return (
    <MapContainer
      center={[initialRegion.latitude, initialRegion.longitude]}
      zoom={6}
      style={{ flex: 1, width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={tileLayerUrl} />

      <MapController userLoc={userLocation} />

      {choropleth ? (
        /* Province choropleth — warm fill ONLY where risk exists */
        <GeoJSON
          key={`choro-${Object.keys(provinceRisk!).length}`}
          data={thailandGeo}
          style={(feature: any) => {
            const z = riskForFeatureName(feature?.properties?.name ?? '', provinceRisk!);
            if (z) {
              // Route through the canonical HeatRisk palette.
              // ChoroplethLevel → legacy RiskLevel string → HeatLevel → hex color.
              // fillOpacity ~0.9 for discrete choropleth with white borders (research:
              // high opacity needed so risk classes are distinguishable at a glance).
              const rlMap: Record<string, Parameters<typeof levelFromRiskLevel>[0]> = {
                warning: 'High',
                watch:   'Elevated',
                normal:  'Normal',
                low:     'Low',
              };
              const rl = rlMap[z.level] ?? 'Low';
              const fillColor = colorForLevel(levelFromRiskLevel(rl));
              return { color: '#FFFFFF', weight: 1, fillColor, fillOpacity: 0.88 };
            }
            // Province not in forecast data — render as faint grey (base-map visible)
            return { color: '#B3C4D2', weight: 0.6, fillColor: '#7E93A6', fillOpacity: 0.05 };
          }}
          onEachFeature={(feature: any, layer: any) => {
            const featureName = feature?.properties?.name ?? '';
            layer.on('click', () => {
              onSelectProvince?.(normalizeProvinceName(featureName));
            });
          }}
        />
      ) : (
        /* Grid fallback — grey ('neutral') while data isn't ready */
        gridData.map((cell) => {
          const sev: Severity = neutral ? 'neutral' : cell.severity;
          return (
            <Polygon
              key={cell.id}
              positions={getPolygonPositions(cell)}
              pathOptions={{
                fillColor: getSeverityColor(sev),
                fillOpacity: 0.35,
                color: getSeverityBorderColor(sev),
                weight: 1,
              }}
            />
          );
        })
      )}
      
      {/* User location marker - ANCHORED TO MAP, not screen */}
      {userLocation && (
        <Marker 
          position={[userLocation.latitude, userLocation.longitude]}
          icon={userLocationIcon}
        />
      )}
    </MapContainer>
  );
}

// Native Map Component using react-native-maps
function NativeMapView({
  gridData,
  userLocation,
  onGetLocation,
  isDarkMode,
  neutral,
  onSelectProvince,
}: {
  gridData: GridCell[];
  userLocation: { latitude: number; longitude: number } | null;
  onGetLocation: () => void;
  isDarkMode: boolean;
  neutral: boolean;
  onSelectProvince?: (provinceName: string) => void;
}) {
  const [mapModule, setMapModule] = useState<any>(null);

  useEffect(() => {
    try {
      // Native-only dynamic require: react-native-maps is unavailable on web.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      setMapModule(require('react-native-maps'));
    } catch (e) {
      console.log('react-native-maps not available:', e);
    }
  }, []);

  const mapRef = useRef<any>(null);

  if (!mapModule) {
    return (
      <View style={styles.nativeFallback}>
        <Text style={styles.loadingText}>Map not available</Text>
      </View>
    );
  }

  const { default: MapView, Marker, Polygon } = mapModule;

  const initialRegion = userLocation 
    ? { 
        latitude: userLocation.latitude, 
        longitude: userLocation.longitude,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }
    : DEFAULT_REGION;

  return (
    <MapView
      ref={mapRef}
      style={styles.nativeMap}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
    >
      {/* Grid overlay polygons — grey ('neutral') while data isn't ready */}
      {gridData.map((cell) => {
        const sev: Severity = neutral ? 'neutral' : cell.severity;
        return (
          <Polygon
            key={cell.id}
            coordinates={[
              { latitude: cell.north, longitude: cell.west },
              { latitude: cell.north, longitude: cell.east },
              { latitude: cell.south, longitude: cell.east },
              { latitude: cell.south, longitude: cell.west },
            ]}
            fillColor={getSeverityColor(sev)}
            strokeColor={getSeverityBorderColor(sev)}
            strokeWidth={2}
            tappable={true}
            onPress={() => {
              if (cell.provinceName) onSelectProvince?.(cell.provinceName);
            }}
          />
        );
      })}

      {/* User location marker - ANCHORED TO MAP COORDINATES */}
      {userLocation && (
        <Marker
          coordinate={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          centerOffset={{ x: 0, y: 0 }}
        >
          <View style={styles.nativeMarkerContainer}>
            <View style={styles.nativeMarkerPulse} />
            <View style={styles.nativeMarkerDot} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

// Main component
export function MapGrid({
  gridData = generateThailandGrid(),
  userLocation = null,
  onUserLocationRequest,
  style,
  isDarkMode = false,
  neutral = false,
  provinceRisk = null,
  onSelectProvince,
  fitPaddingTop,
}: {
  gridData?: GridCell[];
  userLocation?: { latitude: number; longitude: number } | null;
  onUserLocationRequest?: () => void;
  style?: any;
  isDarkMode?: boolean;
  // When true, every cell renders GREY instead of its real severity colour —
  // used while the forecast is loading / failed so "no data" ≠ "low risk".
  neutral?: boolean;
  // Per-province risk keyed by NORMALISED English name (normalizeProvinceName).
  // When provided (web), renders the honest province choropleth instead of the grid.
  provinceRisk?: Record<string, ProvinceRisk> | null;
  // Callback fired when user taps a province on the map (web: GeoJSON polygon;
  // native: grid cell with provinceName populated by map.tsx).
  onSelectProvince?: (provinceName: string) => void;
  // Top padding (px) for fitBounds — clears controls floating over the map top.
  fitPaddingTop?: number;
}) {
  const [isWeb, setIsWeb] = useState(false);
  
  useEffect(() => {
    setIsWeb(Platform.OS === 'web');
  }, []);

  const handleGetLocation = onUserLocationRequest || (() => {});

  return (
    <View style={[styles.container, style]}>
      {isWeb ? (
        <WebLeafletMap
          gridData={gridData}
          userLocation={userLocation}
          onGetLocation={handleGetLocation}
          isDarkMode={isDarkMode}
          neutral={neutral}
          provinceRisk={provinceRisk}
          onSelectProvince={onSelectProvince}
          fitPaddingTop={fitPaddingTop}
        />
      ) : (
        <NativeMapView
          gridData={gridData}
          userLocation={userLocation}
          onGetLocation={handleGetLocation}
          isDarkMode={isDarkMode}
          neutral={neutral}
          onSelectProvince={onSelectProvince}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  nativeFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  nativeMap: {
    flex: 1,
  },
  nativeMarkerContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeMarkerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  nativeMarkerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
