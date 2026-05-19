import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are Santiago's personal AI city guide. You are embedded in his travel app "Santiago's World" and you have real-time access to his GPS location, his full travel history, and Google Places.

WHO IS SANTIAGO:
- Developer Advocate who travels constantly across Africa, LATAM, and Europe
- Based in Lisbon but currently traveling
- Values: great coffee, strong wifi, local food (NOT tourist traps), gyms, coworking spaces
- Prefers: walkable distance, highly rated places, places that are currently open
- Speaks: English and Spanish

BEHAVIOR RULES:
1. ALWAYS use the search_nearby_places tool before recommending places — never guess or make up places.
2. When recommending places, always include: name, rating, distance, whether it's open NOW, and why it's good.
3. Sort recommendations by: currently open first, then by rating, then by distance.
4. If the user asks about their travel history, search their check-ins thoroughly. Reference specific dates and notes.
5. Be aware of the TIME OF DAY:
   - Morning: suggest breakfast spots, coffee shops
   - Afternoon: lunch places, coworking spaces
   - Evening: dinner spots, bars, interesting neighborhoods to walk
   - Night: be more careful with safety, suggest well-known areas
6. If the user says something vague like "I'm hungry" or "I'm bored", be proactive — give smart recommendations based on time of day and location.
7. When the user is in a city they've visited before, ALWAYS mention it with the date and their note.
8. Keep responses concise. Max 3-4 recommendations unless they ask for more.
9. Use casual, warm tone. You're a friend who knows the city, not a travel brochure.
10. If you find a place with rating below 3.5/5, skip it. Only recommend quality spots.
11. You also have web search. Use it when the user asks about local events, safety info, travel tips, SIM cards, transport, or information Google Places doesn't cover. Do NOT use web search for finding restaurants/places — use search_nearby_places for that.
12. ALWAYS reply in English, regardless of what language Santiago writes in. The only exception is if he explicitly asks you to reply in Spanish (e.g., "respond in Spanish", "contéstame en español"). Otherwise, always English.
13. When recommending places, ALWAYS lead with the highest-rated option first, even if it's not the closest. A 5.0/5 cafe 300m away is better than a 4.2/5 cafe 100m away. Users want QUALITY first, proximity second.
14. NEVER ask clarifying questions. If the query is vague (e.g. "I'm hungry", "I'm bored"), make a smart assumption based on time of day and search immediately.
15. CRITICAL LOCATION RULE: If the user mentions a specific place, neighborhood, mall, or area (e.g. "near Urbanización Los Mangos", "in Viva Envigado", "around El Poblado"), ALWAYS use the geocode_location tool FIRST to get exact coordinates of that place, then search around THOSE coordinates. Do NOT default to the user's GPS when they specify a different location.
16. For every place you recommend, ALWAYS include a Google Maps link. The tool results include a googleMapsUrl field — use it.
17. Use SHORT, SIMPLE keyword queries for search_nearby_places. Examples: "gym", "coffee shop", "restaurant", "coworking space". NOT long descriptive phrases.
18. CRITICAL: Call search_nearby_places ONLY ONCE per user request. If the first search returns results, use them immediately to write your response. Do NOT search again with different keywords.

RESPONSE FORMAT FOR RECOMMENDATIONS:
📍 [Place Name] — ⭐ [rating]/5
📏 [distance] · [Open NOW ✅ / Closed ❌]
→ [One sentence why this place is good]
🗺️ [Google Maps link]`;

interface CheckIn {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  continent: string;
  address: string;
  note: string;
  tags: string[];
  rating: number | null;
  created_at: string;
}

interface ChatRequestBody {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  location: { lat: number; lng: number; city: string; country: string } | null;
  checkinHistory: CheckIn[];
  timestamp?: string;
}

const tools: Anthropic.Tool[] = [
  {
    name: 'search_nearby_places',
    description:
      'Search for nearby places like restaurants, cafés, coworking spaces, gyms, bars, etc. using Google Places. Use this whenever Santiago asks for recommendations or wants to find a specific type of place near him.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query, e.g. "best coffee shop", "coworking space", "gym", "local restaurant"',
        },
        lat: { type: 'number', description: 'Latitude of the search center' },
        lng: { type: 'number', description: 'Longitude of the search center' },
        radius: { type: 'number', description: 'Search radius in meters (default 1500)' },
      },
      required: ['query', 'lat', 'lng'],
    },
  },
  {
    name: 'search_checkin_history',
    description:
      "Search through Santiago's check-in history. Use this when he asks about places he's been, past trips, or travel history.",
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search text to match against city, country, address, or notes',
        },
        continent: {
          type: 'string',
          description: 'Filter by continent: Europe, Africa, LATAM, Asia, North America, Oceania',
        },
        country: { type: 'string', description: 'Filter by country name' },
      },
      required: ['query'],
    },
  },
  {
    name: 'geocode_location',
    description:
      'Convert a place name, neighborhood, address, or landmark into exact GPS coordinates. ALWAYS use this FIRST when Santiago mentions a specific location (e.g. "near Viva Envigado", "in El Poblado", "around Urbanización Los Mangos") before searching for places around it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: {
          type: 'string',
          description: 'The place name, neighborhood, address, or landmark to geocode. Include city/country for better accuracy.',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_place_details',
    description:
      'Get detailed information about a specific place: full address, phone number, website, opening hours, price level. Use when Santiago wants more details about a particular place.',
    input_schema: {
      type: 'object' as const,
      properties: {
        place_name: { type: 'string', description: 'Name of the place to look up' },
        lat: { type: 'number', description: 'Latitude near the place' },
        lng: { type: 'number', description: 'Longitude near the place' },
      },
      required: ['place_name', 'lat', 'lng'],
    },
  },
];

// ---------- Tool execution helpers ----------

interface GooglePlace {
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  id?: string;
  types?: string[];
}

function generateQueryVariations(query: string): string[] {
  const q = query.toLowerCase();
  const variations = [query];

  // Coffee/cafe variations
  if (q.includes('coffee') || q.includes('cafe') || q.includes('café')) {
    if (!q.includes('coffee')) variations.push(query.replace(/caf[eé]/i, 'coffee shop'));
    if (!q.includes('cafe')) variations.push(query.replace(/coffee\s*(shop)?/i, 'café'));
    if (q.includes('work') || q.includes('cowork'))
      variations.push(query.replace(/(cowork\w*|work\w*)/i, '').trim() + ' with wifi');
  }
  // Coworking variations
  else if (q.includes('cowork')) {
    variations.push(query.replace(/cowork\w*/i, 'café with wifi'));
    variations.push(query.replace(/cowork\w*/i, 'shared office'));
  }
  // Food/restaurant variations
  else if (q.includes('food') || q.includes('restaurant') || q.includes('eat') || q.includes('hungry')) {
    if (!q.includes('restaurant')) variations.push(query + ' restaurant');
    variations.push(query.replace(/(food|eat\w*|hungry)/i, 'best restaurant'));
  }
  // Gym variations
  else if (q.includes('gym') || q.includes('workout') || q.includes('exercise')) {
    if (!q.includes('gym')) variations.push(query.replace(/(workout|exercise)/i, 'gym'));
    variations.push(query.replace(/(gym|workout|exercise)/i, 'fitness center'));
  }
  // For any other query, add a "best" prefix variation
  else {
    if (!q.startsWith('best')) variations.push('best ' + query);
  }

  // Return max 3 unique variations
  return [...new Set(variations)].slice(0, 3);
}

async function singlePlacesSearch(
  query: string,
  lat: number,
  lng: number,
  radius: number,
  apiKey: string
): Promise<GooglePlace[]> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    maxResultCount: 10,
    languageCode: 'en',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.location,places.googleMapsUri,places.types',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log(`[Places API] "${query}" → ${(data.places || []).length} results${data.error ? ' | Error: ' + JSON.stringify(data.error) : ''}`);
  if (!data.places && data.error) console.log('[Places API] Full error response:', JSON.stringify(data));
  return data.places || [];
}

async function executeSearchNearbyPlaces(input: {
  query: string;
  lat: number;
  lng: number;
  radius?: number;
}): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return JSON.stringify({ error: 'Google Maps API key not configured' });

    const radius = Math.max(input.radius || 1500, 1500);
    const queryVariations = generateQueryVariations(input.query);

    console.log('[Places Search] Query:', input.query, '| Lat:', input.lat, '| Lng:', input.lng, '| Radius:', radius);
    console.log('[Places Search] Variations:', queryVariations);

    // Run multiple searches in parallel
    const allResults = await Promise.all(
      queryVariations.map((q) => singlePlacesSearch(q, input.lat, input.lng, radius, apiKey))
    );

    // Merge and deduplicate by place id (or name+address as fallback)
    const seen = new Set<string>();
    const merged: GooglePlace[] = [];

    for (const results of allResults) {
      for (const place of results) {
        const key = place.id || `${place.displayName?.text}|${place.formattedAddress}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(place);
        }
      }
    }

    console.log('[Places Search] Total merged results:', merged.length);
    if (merged.length === 0) {
      console.log('[Places Search] Zero results — all variations returned empty');
      return JSON.stringify({ result: 'No places found matching that search.' });
    }

    // Map to our format
    const places = merged.map((place) => {
      const placeLat = place.location?.latitude || 0;
      const placeLng = place.location?.longitude || 0;
      const dist = calculateDistance(input.lat, input.lng, placeLat, placeLng);
      const name = place.displayName?.text || 'Unknown';
      // Build Google Maps link with place_id when available
      const googleMapsUrl = place.googleMapsUri
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (place.formattedAddress || ''))}`;
      return {
        name,
        address: place.formattedAddress || '',
        rating: place.rating || 0,
        totalRatings: place.userRatingCount || 0,
        isOpenNow: place.currentOpeningHours?.openNow ?? null,
        distance: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`,
        distanceMeters: Math.round(dist * 1000),
        googleMapsUrl,
        types: place.types || [],
      };
    });

    // Sort by rating (highest first), tiebreak by total reviews
    places.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.totalRatings - a.totalRatings;
    });

    // Return top 6 with minimal fields to save tokens
    const trimmed = places.slice(0, 6).map(p => ({
      name: p.name,
      rating: p.rating,
      reviews: p.totalRatings,
      open: p.isOpenNow,
      dist: p.distance,
      url: p.googleMapsUrl,
    }));
    return JSON.stringify({ places: trimmed });
  } catch (error) {
    console.error('Places search error:', error);
    return JSON.stringify({ error: 'Failed to search for places. Please try again.' });
  }
}

async function executeGeocodeLocation(input: { address: string }): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return JSON.stringify({ error: 'Google Maps API key not configured' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input.address)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return JSON.stringify({ error: `Could not find location: ${input.address}` });
    }

    const result = data.results[0];
    return JSON.stringify({
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
    });
  } catch (error) {
    console.error('Geocode error:', error);
    return JSON.stringify({ error: 'Failed to geocode location.' });
  }
}

async function executeGetPlaceDetails(input: {
  place_name: string;
  lat: number;
  lng: number;
}): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return JSON.stringify({ error: 'Google Maps API key not configured' });

    const url = 'https://places.googleapis.com/v1/places:searchText';
    const body = {
      textQuery: input.place_name,
      locationBias: {
        circle: {
          center: { latitude: input.lat, longitude: input.lng },
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
          'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.location,places.googleMapsUri,places.types,places.internationalPhoneNumber,places.websiteUri,places.priceLevel,places.regularOpeningHours',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.places || data.places.length === 0) {
      return JSON.stringify({ result: 'Could not find details for that place.' });
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

    return JSON.stringify({
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
    });
  } catch (error) {
    console.error('Place details error:', error);
    return JSON.stringify({ error: 'Failed to get place details.' });
  }
}

function executeSearchCheckinHistory(
  input: { query: string; continent?: string; country?: string },
  checkins: CheckIn[]
): string {
  const query = input.query.toLowerCase();

  let results = checkins.filter((c) => {
    const matchesText =
      c.city.toLowerCase().includes(query) ||
      c.country.toLowerCase().includes(query) ||
      c.address.toLowerCase().includes(query) ||
      c.note.toLowerCase().includes(query) ||
      c.tags.some((t) => t.toLowerCase().includes(query)) ||
      query === 'all' ||
      query === '*';

    const matchesContinent = input.continent
      ? c.continent.toLowerCase() === input.continent.toLowerCase()
      : true;

    const matchesCountry = input.country
      ? c.country.toLowerCase() === input.country.toLowerCase()
      : true;

    return matchesText && matchesContinent && matchesCountry;
  });

  results = results.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (results.length === 0) {
    return JSON.stringify({ result: 'No check-ins found matching that search.' });
  }

  const simplified = results.slice(0, 10).map((c) => ({
    city: c.city,
    country: c.country,
    date: new Date(c.created_at).toLocaleDateString(),
    note: c.note ? c.note.slice(0, 100) : '',
    tags: c.tags,
  }));

  return JSON.stringify({ checkins: simplified, total: results.length });
}

// ---------- Context builder ----------

function getTimeOfDay(timestamp?: string): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function buildContextBlock(
  location: ChatRequestBody['location'],
  checkins: CheckIn[],
  timestamp?: string
): string {
  const now = timestamp ? new Date(timestamp) : new Date();
  const timeOfDay = getTimeOfDay(timestamp);
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let ctx = '[CONTEXT] ';

  if (location) {
    ctx += `Location: ${location.city}, ${location.country} (${location.lat}, ${location.lng}). `;
  } else {
    ctx += 'Location: unknown (GPS unavailable). ';
  }

  ctx += `Local time: ${timeStr} (${timeOfDay}). `;

  // Check if user has visited this city before
  if (location) {
    const previousVisits = checkins.filter(
      (c) => c.city.toLowerCase() === location.city.toLowerCase()
    );
    if (previousVisits.length > 0) {
      const visitDates = previousVisits
        .slice(0, 3)
        .map((v) => {
          const d = new Date(v.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          return `${d}${v.note ? ` ("${v.note}")` : ''}`;
        })
        .join('; ');
      ctx += `Santiago has been to ${location.city} before: ${visitDates}. `;
    }
  }

  // Stats
  const countries = new Set(checkins.map((c) => c.country));
  ctx += `Total: ${checkins.length} check-ins across ${countries.size} countries. `;

  // Last 5 check-ins
  if (checkins.length > 0) {
    const recent = checkins
      .slice(0, 5)
      .map((c) => `${c.city}, ${c.country} (${new Date(c.created_at).toLocaleDateString()})`)
      .join('; ');
    ctx += `Recent: ${recent}. `;
  }

  ctx += '[END CONTEXT]';
  return ctx;
}

// ---------- Haversine ----------

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

// ---------- SSE encoder helper ----------

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ---------- POST handler ----------

export async function POST(request: NextRequest) {
  if (!process.env.CLAUDE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: ChatRequestBody = await request.json();
    const { message, location } = body;
    const history = body.history || [];
    const checkinHistory = body.checkinHistory || [];

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build smart context
    const contextBlock = buildContextBlock(location, checkinHistory, body.timestamp);
    const augmentedMessage = `${contextBlock}\n\nUser message: ${message}`;

    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: augmentedMessage },
    ];

    const allTools: (Anthropic.Tool | Anthropic.WebSearchTool20250305)[] = [
      ...tools,
      { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
    ];

    // Token debugging helper
    function estimateTokens(text: string): number {
      return Math.ceil(text.length / 4); // rough estimate: 1 token ≈ 4 chars
    }

    const systemTokens = estimateTokens(SYSTEM_PROMPT);
    const historyTokens = estimateTokens(JSON.stringify(history));
    const contextTokens = estimateTokens(contextBlock);
    console.log(`[Token Estimate] System: ~${systemTokens}, History: ~${historyTokens}, Context: ~${contextTokens}`);

    // Tool status helper
    function getToolStatusMessage(toolName: string): string {
      switch (toolName) {
        case 'search_nearby_places': return '🔍 Searching nearby places...';
        case 'search_checkin_history': return '📋 Looking through your travel history...';
        case 'geocode_location': return '📍 Finding that location...';
        case 'get_place_details': return '📍 Getting place details...';
        case 'web_search': return '🌐 Searching the web...';
        default: return '⏳ Working on it...';
      }
    }

    // Execute a single tool call
    async function executeTool(
      toolUse: Anthropic.ToolUseBlock,
      loc: ChatRequestBody['location'],
      checkins: CheckIn[]
    ): Promise<string> {
      const inp = toolUse.input as Record<string, unknown>;

      if (toolUse.name === 'search_nearby_places') {
        return executeSearchNearbyPlaces({
          query: inp.query as string,
          lat: (inp.lat as number) || loc?.lat || 0,
          lng: (inp.lng as number) || loc?.lng || 0,
          radius: inp.radius as number | undefined,
        });
      } else if (toolUse.name === 'search_checkin_history') {
        return executeSearchCheckinHistory(
          inp as { query: string; continent?: string; country?: string },
          checkins
        );
      } else if (toolUse.name === 'geocode_location') {
        return executeGeocodeLocation(inp as { address: string });
      } else if (toolUse.name === 'get_place_details') {
        return executeGetPlaceDetails({
          place_name: inp.place_name as string,
          lat: (inp.lat as number) || loc?.lat || 0,
          lng: (inp.lng as number) || loc?.lng || 0,
        });
      }
      return JSON.stringify({ error: `Unknown tool: ${toolUse.name}` });
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(data: unknown) {
          controller.enqueue(encoder.encode(sseEncode(data)));
        }

        try {
          let currentMessages = [...messages];
          let iterations = 0;
          const MAX_ITERATIONS = 3;
          let totalInputTokens = 0;
          let totalOutputTokens = 0;

          // PHASE 1: Non-streaming tool-calling loop
          // Keep calling Claude with tools until it's ready to give a final text answer
          while (iterations < MAX_ITERATIONS) {
            iterations++;

            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 2048,
              temperature: 0.3,
              system: SYSTEM_PROMPT,
              tools: allTools,
              messages: currentMessages,
            });

            if (response.usage) {
              totalInputTokens += response.usage.input_tokens || 0;
              totalOutputTokens += response.usage.output_tokens || 0;
            }

            // If Claude doesn't want to call tools, we're done with phase 1
            if (response.stop_reason !== 'tool_use') {
              // Extract text from this response and stream it
              const textContent = response.content
                .filter((b): b is Anthropic.TextBlock => b.type === 'text')
                .map((b) => b.text)
                .join('');

              if (textContent) {
                send({ type: 'text_delta', text: textContent });
              }

              const inputCost = totalInputTokens * (3 / 1_000_000);
              const outputCost = totalOutputTokens * (15 / 1_000_000);
              send({
                type: 'done',
                usage: {
                  input_tokens: totalInputTokens,
                  output_tokens: totalOutputTokens,
                  total_cost_usd: +(inputCost + outputCost).toFixed(6),
                },
              });

              console.log(`[Token Actual] Input: ${totalInputTokens}, Output: ${totalOutputTokens}, Iterations: ${iterations}`);
              break;
            }

            // Claude wants to call tools — send status to UI, execute tools silently
            const toolUseBlocks = response.content.filter(
              (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
            );

            for (const toolUse of toolUseBlocks) {
              send({ type: 'tool_status', message: getToolStatusMessage(toolUse.name) });
            }

            const toolResultContents: Anthropic.ToolResultBlockParam[] = [];
            for (const toolUse of toolUseBlocks) {
              const result = await executeTool(toolUse, location, checkinHistory);
              const resultTokens = estimateTokens(result);
              console.log(`[Tool] ${toolUse.name}: ~${resultTokens} result tokens`);
              toolResultContents.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: result,
              });
            }

            // Add assistant message + tool results to conversation for next iteration
            currentMessages = [
              ...currentMessages,
              { role: 'assistant' as const, content: response.content },
              { role: 'user' as const, content: toolResultContents },
            ];
          }

          // If we hit MAX_ITERATIONS without a text response, force a final answer
          // by calling Claude one more time with tools disabled
          if (iterations >= MAX_ITERATIONS) {
            console.log('[Chat] Hit MAX_ITERATIONS — forcing final response without tools');
            const finalResponse = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 1024,
              temperature: 0.3,
              system: SYSTEM_PROMPT,
              tool_choice: { type: 'none' },
              messages: currentMessages,
            });

            if (finalResponse.usage) {
              totalInputTokens += finalResponse.usage.input_tokens || 0;
              totalOutputTokens += finalResponse.usage.output_tokens || 0;
            }

            const textContent = finalResponse.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('');

            if (textContent) send({ type: 'text_delta', text: textContent });

            const inputCost = totalInputTokens * (3 / 1_000_000);
            const outputCost = totalOutputTokens * (15 / 1_000_000);
            send({
              type: 'done',
              usage: {
                input_tokens: totalInputTokens,
                output_tokens: totalOutputTokens,
                total_cost_usd: +(inputCost + outputCost).toFixed(6),
              },
            });
          }

        } catch (error) {
          console.error('Chat error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          let friendlyMessage: string;
          if (errorMessage.includes('location') || errorMessage.includes('GPS')) {
            friendlyMessage = "I need your location to help. Please enable GPS and try again.";
          } else if (errorMessage.includes('rate') || errorMessage.includes('429') || errorMessage.includes('overloaded')) {
            friendlyMessage = "I'm getting too many requests right now. Give me a sec and try again.";
          } else {
            friendlyMessage = "I'm having trouble connecting right now. Try again in a moment?";
          }

          send({ type: 'error', message: friendlyMessage });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: "I'm having trouble connecting right now. Try again?" }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
