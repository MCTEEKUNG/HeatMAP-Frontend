import { Platform } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { parseExpoAddress, parseNominatimAddress, type UserAdministrativeArea } from './reverseGeocodeParser';

export type { UserAdministrativeArea, ReverseGeocodeSource } from './reverseGeocodeParser';

async function reverseGeocodeWeb(latitude: number, longitude: number): Promise<UserAdministrativeArea> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('zoom', '12');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'th,en');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return { district: null, province: null, source: 'none' };

  const data = await res.json();
  return parseNominatimAddress(data?.address);
}

async function reverseGeocodeNative(latitude: number, longitude: number): Promise<UserAdministrativeArea> {
  const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
  return parseExpoAddress(results[0]);
}

export async function reverseGeocodeAdministrativeArea(
  latitude: number,
  longitude: number,
): Promise<UserAdministrativeArea> {
  try {
    if (Platform.OS === 'web') {
      return await reverseGeocodeWeb(latitude, longitude);
    }
    return await reverseGeocodeNative(latitude, longitude);
  } catch {
    return { district: null, province: null, source: 'none' };
  }
}
