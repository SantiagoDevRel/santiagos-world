import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return NextResponse.json({ error: 'lat and lng must be valid numbers' }, { status: 400 });
  }

  if (latNum < -90 || latNum > 90) {
    return NextResponse.json({ error: 'lat must be between -90 and 90' }, { status: 400 });
  }

  if (lngNum < -180 || lngNum > 180) {
    return NextResponse.json({ error: 'lng must be between -180 and 180' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json({
        city: 'Unknown',
        country: 'Unknown',
        address: `${latNum}, ${lngNum}`,
      });
    }

    const result = data.results[0];
    const components = result.address_components || [];

    let city = '';
    let country = '';

    for (const comp of components) {
      if (comp.types.includes('locality')) {
        city = comp.long_name;
      }
      if (comp.types.includes('administrative_area_level_1') && !city) {
        city = comp.long_name;
      }
      if (comp.types.includes('country')) {
        country = comp.long_name;
      }
    }

    return NextResponse.json({
      city,
      country,
      address: result.formatted_address,
    });
  } catch {
    return NextResponse.json({ error: 'Geocoding request failed' }, { status: 500 });
  }
}
