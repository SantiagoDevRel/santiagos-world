export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    // Try high accuracy first (GPS), fall back to low accuracy (IP/WiFi)
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {
        // High accuracy failed, try without it
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

interface GeocodingResult {
  city: string;
  country: string;
  continent: string;
  address: string;
}

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // Africa
  Nigeria: 'Africa', Kenya: 'Africa', Uganda: 'Africa', Ghana: 'Africa',
  'South Africa': 'Africa', Ethiopia: 'Africa', Tanzania: 'Africa',
  Rwanda: 'Africa', Senegal: 'Africa', Morocco: 'Africa', Egypt: 'Africa',
  Cameroon: 'Africa', "Côte d'Ivoire": 'Africa', Mozambique: 'Africa',
  Zimbabwe: 'Africa', Zambia: 'Africa', Algeria: 'Africa', Tunisia: 'Africa',

  // LATAM
  Colombia: 'LATAM', Argentina: 'LATAM', Brazil: 'LATAM', Mexico: 'LATAM',
  Chile: 'LATAM', Peru: 'LATAM', Ecuador: 'LATAM', Uruguay: 'LATAM',
  Paraguay: 'LATAM', Bolivia: 'LATAM', Venezuela: 'LATAM',
  'Costa Rica': 'LATAM', Panama: 'LATAM', Guatemala: 'LATAM',
  Honduras: 'LATAM', 'El Salvador': 'LATAM', Nicaragua: 'LATAM',
  Cuba: 'LATAM', 'Dominican Republic': 'LATAM', 'Puerto Rico': 'LATAM',

  // Europe
  Portugal: 'Europe', Spain: 'Europe', France: 'Europe', Germany: 'Europe',
  Italy: 'Europe', Netherlands: 'Europe', Belgium: 'Europe',
  'United Kingdom': 'Europe', Ireland: 'Europe', Switzerland: 'Europe',
  Austria: 'Europe', Poland: 'Europe', 'Czech Republic': 'Europe',
  Sweden: 'Europe', Norway: 'Europe', Denmark: 'Europe', Finland: 'Europe',
  Greece: 'Europe', Turkey: 'Europe', Romania: 'Europe', Hungary: 'Europe',
  Croatia: 'Europe', Serbia: 'Europe', Bulgaria: 'Europe', Ukraine: 'Europe',
  Estonia: 'Europe', Latvia: 'Europe', Lithuania: 'Europe',

  // Asia
  Thailand: 'Asia', Japan: 'Asia', 'South Korea': 'Asia', China: 'Asia',
  India: 'Asia', Vietnam: 'Asia', Indonesia: 'Asia', Philippines: 'Asia',
  Malaysia: 'Asia', Singapore: 'Asia', Taiwan: 'Asia', Cambodia: 'Asia',
  Myanmar: 'Asia', Nepal: 'Asia', 'Sri Lanka': 'Asia', Bangladesh: 'Asia',
  'United Arab Emirates': 'Asia', Israel: 'Asia', 'Saudi Arabia': 'Asia',
  Qatar: 'Asia', Bahrain: 'Asia', Jordan: 'Asia', Lebanon: 'Asia',

  // North America
  'United States': 'North America', Canada: 'North America',

  // Oceania
  Australia: 'Oceania', 'New Zealand': 'Oceania',
};

function getContinent(country: string): string {
  return COUNTRY_TO_CONTINENT[country] || 'Other';
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult> {
  const res = await fetch(
    `/api/geocode?lat=${lat}&lng=${lng}`
  );

  if (!res.ok) throw new Error('Geocoding failed');

  const data = await res.json();
  return {
    city: data.city || 'Unknown',
    country: data.country || 'Unknown',
    continent: getContinent(data.country || ''),
    address: data.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  };
}

export const CONTINENT_COLORS: Record<string, string> = {
  Europe: '#118ab2',      // ocean blue
  Africa: '#06d6a0',      // minty teal
  LATAM: '#ffd166',       // warm yellow
  Asia: '#ef476f',        // coral red
  'North America': '#7b68ee', // medium slate blue
  Oceania: '#ff8c42',     // tangerine
  Other: '#555570',       // muted gray
};
