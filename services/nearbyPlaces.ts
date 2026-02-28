/**
 * Nearby Places Service
 * 
 * Fetches nearby rest care / cooling centers based on user location.
 * 
 * In production, this would call:
 * - Google Places API
 * - Overpass API (OpenStreetMap)
 * - A custom backend API
 * 
 * For now, we generate mock data based on coordinates.
 */

export interface Place {
  id: string;
  name: string;
  type: 'hospital' | 'cooling_center' | 'community_center' | 'park' | 'shop';
  address: string;
  latitude: number;
  longitude: number;
  distance: number; // in km
  openingHours: string;
  isOpen24Hours: boolean;
  phone?: string;
}

// Types of cooling/rest places
const PLACE_TYPES: { type: Place['type']; name: string; openingHours: string; open24: boolean }[] = [
  { type: 'cooling_center', name: 'Public Cooling Center', openingHours: '8:00 AM - 8:00 PM', open24: false },
  { type: 'community_center', name: 'Community Center', openingHours: '7:00 AM - 9:00 PM', open24: false },
  { type: 'hospital', name: 'Hospital', openingHours: '24/7', open24: true },
  { type: 'park', name: 'Public Park', openingHours: '6:00 AM - 10:00 PM', open24: false },
  { type: 'shop', name: 'Convenience Store', openingHours: '24/7', open24: true },
];

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate mock nearby places based on user location
 * 
 * In production, replace with actual API call:
 * - Google Places API: https://developers.google.com/maps/documentation/places/web-service
 * - Overpass API: https://overpass-api.de/
 * 
 * @param latitude User's latitude
 * @param longitude User's longitude
 * @param radius Search radius in km (default 5km)
 * @param limit Maximum number of places to return
 */
export async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
  radius: number = 5,
  limit: number = 5
): Promise<Place[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Generate random offset coordinates within radius
  const places: Place[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < limit; i++) {
    // Generate random offset within radius (roughly)
    const latOffset = (Math.random() - 0.5) * (radius / 111); // ~111km per degree
    const lonOffset = (Math.random() - 0.5) * (radius / 111);
    
    const placeLat = latitude + latOffset;
    const placeLon = longitude + lonOffset;
    
    // Get random place type
    const placeType = PLACE_TYPES[Math.floor(Math.random() * PLACE_TYPES.length)];
    
    // Generate unique name
    let placeName = `${placeType.name} ${String.fromCharCode(65 + i)}`;
    while (usedNames.has(placeName)) {
      placeName = `${placeType.name} ${Math.floor(Math.random() * 100)}`;
    }
    usedNames.add(placeName);

    // Calculate actual distance
    const distance = calculateDistance(latitude, longitude, placeLat, placeLon);

    places.push({
      id: `place-${i}`,
      name: placeName,
      type: placeType.type,
      address: `Nearby location (${distance.toFixed(1)} km away)`,
      latitude: placeLat,
      longitude: placeLon,
      distance: distance,
      openingHours: placeType.openingHours,
      isOpen24Hours: placeType.open24,
    });
  }

  // Sort by distance
  places.sort((a, b) => a.distance - b.distance);

  return places.slice(0, limit);
}

/**
 * Get the nearest cooling center or hospital
 */
export async function getNearestCoolingPlace(
  latitude: number,
  longitude: number
): Promise<Place | null> {
  const places = await fetchNearbyPlaces(latitude, longitude, 10, 10);
  
  // Prioritize: cooling centers, then community centers, then hospitals, then others
  const priority: Place['type'][] = ['cooling_center', 'community_center', 'hospital', 'park', 'shop'];
  
  for (const type of priority) {
    const found = places.find(p => p.type === type);
    if (found) return found;
  }
  
  return places[0] || null;
}

/**
 * Calculate estimated travel time (mock)
 */
export function estimateTravelTime(distanceKm: number): string {
  // Assume average speed of 30 km/h in city
  const hours = distanceKm / 30;
  const minutes = Math.round(hours * 60);
  
  if (minutes < 1) return 'Less than 1 min';
  if (minutes === 1) return '1 min';
  if (minutes < 60) return `${minutes} min`;
  
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
}

export default {
  fetchNearbyPlaces,
  getNearestCoolingPlace,
  estimateTravelTime,
};
