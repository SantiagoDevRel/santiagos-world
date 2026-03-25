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
  // ── Africa (54 countries) ──
  Algeria: 'Africa',
  Angola: 'Africa',
  Benin: 'Africa',
  Botswana: 'Africa',
  'Burkina Faso': 'Africa',
  Burundi: 'Africa',
  'Cabo Verde': 'Africa',
  'Cape Verde': 'Africa',
  Cameroon: 'Africa',
  'Central African Republic': 'Africa',
  Chad: 'Africa',
  Comoros: 'Africa',
  'Democratic Republic of the Congo': 'Africa',
  'Republic of the Congo': 'Africa',
  Congo: 'Africa',
  "Côte d'Ivoire": 'Africa',
  'Ivory Coast': 'Africa',
  Djibouti: 'Africa',
  Egypt: 'Africa',
  'Equatorial Guinea': 'Africa',
  Eritrea: 'Africa',
  Eswatini: 'Africa',
  Swaziland: 'Africa',
  Ethiopia: 'Africa',
  Gabon: 'Africa',
  Gambia: 'Africa',
  Ghana: 'Africa',
  Guinea: 'Africa',
  'Guinea-Bissau': 'Africa',
  Kenya: 'Africa',
  Lesotho: 'Africa',
  Liberia: 'Africa',
  Libya: 'Africa',
  Madagascar: 'Africa',
  Malawi: 'Africa',
  Mali: 'Africa',
  Mauritania: 'Africa',
  Mauritius: 'Africa',
  Morocco: 'Africa',
  Mozambique: 'Africa',
  Namibia: 'Africa',
  Niger: 'Africa',
  Nigeria: 'Africa',
  Rwanda: 'Africa',
  'São Tomé and Príncipe': 'Africa',
  Senegal: 'Africa',
  Seychelles: 'Africa',
  'Sierra Leone': 'Africa',
  Somalia: 'Africa',
  'South Africa': 'Africa',
  'South Sudan': 'Africa',
  Sudan: 'Africa',
  Tanzania: 'Africa',
  Togo: 'Africa',
  Tunisia: 'Africa',
  Uganda: 'Africa',
  Zambia: 'Africa',
  Zimbabwe: 'Africa',

  // ── LATAM (33 countries + territories) ──
  Argentina: 'LATAM',
  Belize: 'LATAM',
  Bolivia: 'LATAM',
  Brazil: 'LATAM',
  Chile: 'LATAM',
  Colombia: 'LATAM',
  'Costa Rica': 'LATAM',
  Cuba: 'LATAM',
  'Dominican Republic': 'LATAM',
  Ecuador: 'LATAM',
  'El Salvador': 'LATAM',
  Guatemala: 'LATAM',
  Guyana: 'LATAM',
  Haiti: 'LATAM',
  Honduras: 'LATAM',
  Jamaica: 'LATAM',
  Mexico: 'LATAM',
  Nicaragua: 'LATAM',
  Panama: 'LATAM',
  Paraguay: 'LATAM',
  Peru: 'LATAM',
  'Puerto Rico': 'LATAM',
  Suriname: 'LATAM',
  'Trinidad and Tobago': 'LATAM',
  Uruguay: 'LATAM',
  Venezuela: 'LATAM',
  // Caribbean
  'Antigua and Barbuda': 'LATAM',
  Bahamas: 'LATAM',
  'The Bahamas': 'LATAM',
  Barbados: 'LATAM',
  Dominica: 'LATAM',
  Grenada: 'LATAM',
  'Saint Kitts and Nevis': 'LATAM',
  'Saint Lucia': 'LATAM',
  'Saint Vincent and the Grenadines': 'LATAM',

  // ── Europe (44 countries) ──
  Albania: 'Europe',
  Andorra: 'Europe',
  Armenia: 'Europe',
  Austria: 'Europe',
  Azerbaijan: 'Europe',
  Belarus: 'Europe',
  Belgium: 'Europe',
  'Bosnia and Herzegovina': 'Europe',
  Bulgaria: 'Europe',
  Croatia: 'Europe',
  Cyprus: 'Europe',
  'Czech Republic': 'Europe',
  Czechia: 'Europe',
  Denmark: 'Europe',
  Estonia: 'Europe',
  Finland: 'Europe',
  France: 'Europe',
  Georgia: 'Europe',
  Germany: 'Europe',
  Greece: 'Europe',
  Hungary: 'Europe',
  Iceland: 'Europe',
  Ireland: 'Europe',
  Italy: 'Europe',
  Kosovo: 'Europe',
  Latvia: 'Europe',
  Liechtenstein: 'Europe',
  Lithuania: 'Europe',
  Luxembourg: 'Europe',
  Malta: 'Europe',
  Moldova: 'Europe',
  Monaco: 'Europe',
  Montenegro: 'Europe',
  Netherlands: 'Europe',
  'North Macedonia': 'Europe',
  Norway: 'Europe',
  Poland: 'Europe',
  Portugal: 'Europe',
  Romania: 'Europe',
  Russia: 'Europe',
  'San Marino': 'Europe',
  Serbia: 'Europe',
  Slovakia: 'Europe',
  Slovenia: 'Europe',
  Spain: 'Europe',
  Sweden: 'Europe',
  Switzerland: 'Europe',
  Turkey: 'Europe',
  Ukraine: 'Europe',
  'United Kingdom': 'Europe',
  'Vatican City': 'Europe',

  // ── Asia (49 countries) ──
  Afghanistan: 'Asia',
  Bahrain: 'Asia',
  Bangladesh: 'Asia',
  Bhutan: 'Asia',
  Brunei: 'Asia',
  Cambodia: 'Asia',
  China: 'Asia',
  'East Timor': 'Asia',
  'Timor-Leste': 'Asia',
  India: 'Asia',
  Indonesia: 'Asia',
  Iran: 'Asia',
  Iraq: 'Asia',
  Israel: 'Asia',
  Japan: 'Asia',
  Jordan: 'Asia',
  Kazakhstan: 'Asia',
  Kuwait: 'Asia',
  Kyrgyzstan: 'Asia',
  Laos: 'Asia',
  Lebanon: 'Asia',
  Malaysia: 'Asia',
  Maldives: 'Asia',
  Mongolia: 'Asia',
  Myanmar: 'Asia',
  Nepal: 'Asia',
  'North Korea': 'Asia',
  Oman: 'Asia',
  Pakistan: 'Asia',
  Palestine: 'Asia',
  Philippines: 'Asia',
  Qatar: 'Asia',
  'Saudi Arabia': 'Asia',
  Singapore: 'Asia',
  'South Korea': 'Asia',
  'Sri Lanka': 'Asia',
  Syria: 'Asia',
  Taiwan: 'Asia',
  Tajikistan: 'Asia',
  Thailand: 'Asia',
  Turkmenistan: 'Asia',
  'United Arab Emirates': 'Asia',
  Uzbekistan: 'Asia',
  Vietnam: 'Asia',
  Yemen: 'Asia',

  // ── North America (3 countries) ──
  Canada: 'North America',
  'United States': 'North America',

  // ── Oceania (14 countries) ──
  Australia: 'Oceania',
  Fiji: 'Oceania',
  Kiribati: 'Oceania',
  'Marshall Islands': 'Oceania',
  Micronesia: 'Oceania',
  Nauru: 'Oceania',
  'New Zealand': 'Oceania',
  Palau: 'Oceania',
  'Papua New Guinea': 'Oceania',
  Samoa: 'Oceania',
  'Solomon Islands': 'Oceania',
  Tonga: 'Oceania',
  Tuvalu: 'Oceania',
  Vanuatu: 'Oceania',
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

// Re-export from constants for backwards compatibility
export { CONTINENT_COLORS } from '@/lib/constants';
