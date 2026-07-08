import { describe, expect, it } from 'vitest';
import { parseExpoAddress, parseNominatimAddress } from './reverseGeocodeParser';

describe('reverse geocode administrative area parsing', () => {
  it('parses Thai Nominatim county and state as district/province', () => {
    expect(parseNominatimAddress({
      county: 'อำเภอเมืองชลบุรี',
      state: 'จังหวัดชลบุรี',
    })).toMatchObject({
      district: 'เมืองชลบุรี',
      province: 'ชลบุรี',
      source: 'nominatim',
    });
  });

  it('uses Bangkok city district when county is absent', () => {
    expect(parseNominatimAddress({
      city_district: 'เขตปทุมวัน',
      state: 'กรุงเทพมหานคร',
    })).toMatchObject({
      district: 'ปทุมวัน',
      province: 'กรุงเทพมหานคร',
    });
  });

  it('parses Expo address fields', () => {
    expect(parseExpoAddress({
      district: 'อำเภอศรีราชา',
      region: 'ชลบุรี',
    } as any)).toMatchObject({
      district: 'ศรีราชา',
      province: 'ชลบุรี',
      source: 'expo',
    });
  });
});
