import type * as ExpoLocation from 'expo-location';

export type ReverseGeocodeSource = 'nominatim' | 'expo' | 'none';

export interface UserAdministrativeArea {
  district: string | null;
  province: string | null;
  source: ReverseGeocodeSource;
}

export type NominatimAddress = {
  city?: string;
  city_district?: string;
  county?: string;
  municipality?: string;
  state?: string;
  province?: string;
  region?: string;
  suburb?: string;
  town?: string;
  village?: string;
};

const THAI_PREFIXES = /^(จังหวัด|จ\.|อำเภอ|อ\.|เขต|แขวง|ตำบล|ต\.)\s*/;

function cleanAreaName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(THAI_PREFIXES, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function firstArea(...values: unknown[]): string | null {
  for (const value of values) {
    const cleaned = cleanAreaName(value);
    if (cleaned) return cleaned;
  }
  return null;
}

export function parseNominatimAddress(address: NominatimAddress | null | undefined): UserAdministrativeArea {
  if (!address) return { district: null, province: null, source: 'none' };

  const province = firstArea(address.state, address.province, address.region);
  const district = firstArea(
    address.county,
    address.city_district,
    address.municipality,
    address.city,
    address.town,
    address.village,
    address.suburb,
  );

  return { district, province, source: district || province ? 'nominatim' : 'none' };
}

export function parseExpoAddress(address: ExpoLocation.LocationGeocodedAddress | null | undefined): UserAdministrativeArea {
  if (!address) return { district: null, province: null, source: 'none' };

  const province = firstArea(address.region);
  const district = firstArea(address.district, address.subregion, address.city);

  return { district, province, source: district || province ? 'expo' : 'none' };
}
