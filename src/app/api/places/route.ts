import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { query, lat, lng, radius = 1500, mode = 'search' } = body;

    if (mode === 'details') {
      return handlePlaceDetails(body, apiKey);
    }

    // Default: text search
    if (!query || lat == null || lng == null) {
      return NextResponse.json({ error: 'query, lat, and lng are required' }, { status: 400 });
    }

    const url = 'https://places.googleapis.com/v1/places:searchText';
    const searchBody = {
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radius,
        },
      },
      maxResultCount: 8,
      languageCode: 'en',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.location,places.googleMapsUri,places.types',
      },
      body: JSON.stringify(searchBody),
    });

    const data = await res.json();

    if (!data.places || data.places.length === 0) {
      return NextResponse.json({ places: [], message: 'No places found' });
    }

    const places = data.places.map(
      (place: {
        displayName?: { text: string };
        formattedAddress?: string;
        rating?: number;
        userRatingCount?: number;
        currentOpeningHours?: { openNow?: boolean };
        location?: { latitude: number; longitude: number };
        googleMapsUri?: string;
        types?: string[];
      }) => {
        const placeLat = place.location?.latitude || 0;
        const placeLng = place.location?.longitude || 0;
        const distance = calculateDistance(lat, lng, placeLat, placeLng);

        return {
          name: place.displayName?.text || 'Unknown',
          address: place.formattedAddress || '',
          rating: place.rating || null,
          totalRatings: place.userRatingCount || 0,
          isOpenNow: place.currentOpeningHours?.openNow ?? null,
          distance: `${distance < 1 ? Math.round(distance * 1000) + 'm' : distance.toFixed(1) + 'km'}`,
          distanceMeters: Math.round(distance * 1000),
          googleMapsUrl: place.googleMapsUri || null,
          types: place.types || [],
        };
      }
    );

    return NextResponse.json({ places });
  } catch (error) {
    console.error('Places API error:', error);
    return NextResponse.json({ error: 'Failed to search places' }, { status: 500 });
  }
}

async function handlePlaceDetails(
  body: { place_name: string; lat: number; lng: number },
  apiKey: string
) {
  const { place_name, lat, lng } = body;

  if (!place_name) {
    return NextResponse.json({ error: 'place_name is required' }, { status: 400 });
  }

  try {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    const searchBody = {
      textQuery: place_name,
      locationBias: {
        circle: {
          center: { latitude: lat || 0, longitude: lng || 0 },
          radius: 2000,
        },
      },
      maxResultCount: 1,
      languageCode: 'en',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.regularOpeningHours,places.location,places.googleMapsUri,places.types,places.internationalPhoneNumber,places.websiteUri,places.priceLevel',
      },
      body: JSON.stringify(searchBody),
    });

    const data = await res.json();

    if (!data.places || data.places.length === 0) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }

    const p = data.places[0] as {
      displayName?: { text: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      currentOpeningHours?: { openNow?: boolean };
      regularOpeningHours?: { weekdayDescriptions?: string[] };
      location?: { latitude: number; longitude: number };
      googleMapsUri?: string;
      internationalPhoneNumber?: string;
      websiteUri?: string;
      priceLevel?: string;
      types?: string[];
    };

    return NextResponse.json({
      name: p.displayName?.text || 'Unknown',
      address: p.formattedAddress || '',
      rating: p.rating || null,
      totalRatings: p.userRatingCount || 0,
      isOpenNow: p.currentOpeningHours?.openNow ?? null,
      phone: p.internationalPhoneNumber || null,
      website: p.websiteUri || null,
      priceLevel: p.priceLevel || null,
      openingHours: p.regularOpeningHours?.weekdayDescriptions || null,
      googleMapsUrl: p.googleMapsUri || null,
      types: p.types || [],
    });
  } catch (error) {
    console.error('Place details error:', error);
    return NextResponse.json({ error: 'Failed to get place details' }, { status: 500 });
  }
}

// Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
