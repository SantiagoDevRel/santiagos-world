'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAllCheckIns, type CheckIn } from '@/lib/db';
import { getCurrentPosition } from '@/lib/geo';
import { CONTINENT_COLORS, THEME, PIN, GLASS } from '@/lib/constants';
import { subscribe } from '@/lib/events';
import CheckInDetail from './CheckInDetail';

declare global {
  interface Window {
    google: typeof google;
    __googleMapsLoaderPromise?: Promise<void>;
    gm_authFailure?: () => void;
  }
}

/**
 * Promise-based singleton loader using Google's official inline bootstrap.
 *
 * The old `<script onload>` approach is unreliable with `v=weekly`: `onload`
 * fires when the tiny bootstrap loads, which can be BEFORE `google.maps.Map`
 * actually exists, and it can only catch resource-level network errors (so an
 * ad/tracking blocker or an unenabled API surfaces as a generic "failed to
 * load" with no detail). The bootstrap below defines `google.maps.importLibrary`,
 * and awaiting `importLibrary(...)` resolves only once the real library is ready
 * and rejects with a descriptive error otherwise.
 */
/**
 * Injects the Google Maps JS bootstrap that defines `google.maps.importLibrary`.
 * This is a readable rewrite of Google's official inline loader snippet.
 */
function bootstrapGoogleMaps(apiKey: string): void {
  const g = window.google || (window.google = {} as typeof google);
  const maps = (g.maps || (g.maps = {} as typeof google.maps)) as unknown as {
    importLibrary?: (name: string, ...rest: unknown[]) => Promise<unknown>;
    __ib__?: (value: unknown) => void;
  };
  if (maps.importLibrary) return; // already bootstrapped

  const requested = new Set<string>();
  let scriptPromise: Promise<void> | undefined;

  const ensureScript = (): Promise<void> => {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise<void>((resolve, reject) => {
      const params = new URLSearchParams();
      params.set('libraries', [...requested].join(','));
      params.set('key', apiKey);
      params.set('v', 'weekly');
      params.set('callback', 'google.maps.__ib__');
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      maps.__ib__ = () => resolve();
      script.onerror = () => reject(new Error('The Google Maps JavaScript API could not load.'));
      document.head.append(script);
    });
    return scriptPromise;
  };

  maps.importLibrary = (name: string, ...rest: unknown[]) => {
    requested.add(name);
    return ensureScript().then(() =>
      (g.maps.importLibrary as (n: string, ...r: unknown[]) => Promise<unknown>)(name, ...rest)
    );
  };
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (window.__googleMapsLoaderPromise) return window.__googleMapsLoaderPromise;

  window.__googleMapsLoaderPromise = (async () => {
    if (!window.google?.maps?.importLibrary) {
      bootstrapGoogleMaps(apiKey);
    }
    // Resolves only when the real libraries are available; rejects with a
    // descriptive error if the API can't be reached/initialized.
    await Promise.all([
      window.google.maps.importLibrary('maps'),
      window.google.maps.importLibrary('marker'),
    ]);
  })();

  return window.__googleMapsLoaderPromise;
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<(google.maps.marker.AdvancedMarkerElement | google.maps.Marker)[]>([]);
  const listenerRefs = useRef<google.maps.MapsEventListener[]>([]);
  const useAdvancedMarkers = !!process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCheckins = useCallback(async () => {
    const all = await getAllCheckIns();
    setCheckins(all);
  }, []);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError('Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local');
      return;
    }

    // Google calls this when the key/referer/billing is invalid. The script's
    // onload still fires on auth failure, so without this the map just shows
    // blank with no clue why.
    window.gm_authFailure = () => {
      setError(
        'Google Maps rejected the API key. Check that the key is valid, billing is enabled, and this domain is in the key\'s allowed referrers.'
      );
    };

    loadGoogleMapsScript(apiKey)
      .then(() => setMapLoaded(true))
      .catch(() =>
        setError(
          'Could not load Google Maps. This is usually an ad/tracking blocker or privacy browser blocking maps.googleapis.com — try disabling it for this site. If that is not it, the Maps JavaScript API may be disabled or billing not enabled on the key.'
        )
      );
  }, []);

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;
    const initMap = async () => {
      let center = { lat: 20, lng: 0 };
      let zoom = 2;
      try {
        const pos = await getCurrentPosition();
        center = { lat: pos.latitude, lng: pos.longitude };
        zoom = 13;
      } catch { /* default world */ }

      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;
      const darkStyles: google.maps.MapTypeStyle[] = [
        { elementType: 'geometry', stylers: [{ color: THEME.bgSecondary }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: THEME.bgSecondary }] },
        { elementType: 'labels.text.fill', stylers: [{ color: THEME.labelText }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: THEME.bgTertiary }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: THEME.bgTertiary }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: THEME.bgHighway }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: THEME.water }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: THEME.borderSubtle }] },
        { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: THEME.borderCountry }] },
      ];

      mapInstanceRef.current = new google.maps.Map(mapRef.current!, {
        center, zoom,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        ...(mapId ? { mapId } : { styles: darkStyles }),
      });
      loadCheckins();
    };
    initMap();
  }, [mapLoaded, loadCheckins]);

  // Place markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    // Clean up previous markers and their listeners
    listenerRefs.current.forEach((l) => l.remove());
    listenerRefs.current = [];
    markersRef.current.forEach((m) => { if (m instanceof google.maps.Marker) m.setMap(null); else m.map = null; });
    markersRef.current = [];

    checkins.forEach((checkin) => {
      const color = CONTINENT_COLORS[checkin.continent] || CONTINENT_COLORS.Other;
      const position = { lat: checkin.latitude, lng: checkin.longitude };

      if (useAdvancedMarkers) {
        // Advanced Markers (requires Map ID)
        const pinEl = document.createElement('div');
        pinEl.style.cssText = `
          width:14px; height:14px; border-radius:50%;
          background:${color}; border:2px solid ${PIN.borderColor};
          box-shadow: 0 0 10px ${color}${PIN.glowAlpha}, 0 2px 6px ${PIN.shadowColor};
          cursor:pointer; transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        `;
        pinEl.onmouseenter = () => { pinEl.style.transform = 'scale(1.5)'; };
        pinEl.onmouseleave = () => { pinEl.style.transform = 'scale(1)'; };

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapInstanceRef.current!,
          position,
          content: pinEl,
          title: `${checkin.city}, ${checkin.country}`,
        });
        const listener = marker.addListener('click', () => setSelectedCheckIn(checkin));
        listenerRefs.current.push(listener);
        markersRef.current.push(marker);
      } else {
        // Classic Markers (no Map ID needed)
        const marker = new google.maps.Marker({
          map: mapInstanceRef.current!,
          position,
          title: `${checkin.city}, ${checkin.country}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: PIN.borderColor,
            strokeWeight: 2,
            scale: 7,
          },
        });
        const listener = marker.addListener('click', () => setSelectedCheckIn(checkin));
        listenerRefs.current.push(listener);
        markersRef.current.push(marker);
      }
    });

    // Cleanup when effect re-runs or unmounts
    return () => {
      listenerRefs.current.forEach((l) => l.remove());
      listenerRefs.current = [];
      markersRef.current.forEach((m) => { if (m instanceof google.maps.Marker) m.setMap(null); else m.map = null; });
      markersRef.current = [];
    };
  }, [checkins, mapLoaded]);

  // Listen for new checkins via typed pub/sub
  useEffect(() => {
    const unsubscribe = subscribe('checkin-added', () => loadCheckins());
    return unsubscribe;
  }, [loadCheckins]);

  // Error state
  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: THEME.bgPrimary, padding: '32px', textAlign: 'center' }}>
        <div>
          <p style={{ color: THEME.textPrimary, fontFamily: 'var(--font-jakarta)', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>Map unavailable</p>
          <p style={{ color: THEME.textSecondary, fontSize: '14px', fontFamily: 'var(--font-dm)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {/* Map — fills entire space, edge to edge */}
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Loading */}
      {!mapLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: THEME.bgPrimary }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', border: `3px solid rgba(6,214,160,0.15)`, borderTopColor: THEME.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: THEME.textTertiary, fontSize: '13px', fontFamily: 'var(--font-dm)' }}>Loading map...</p>
          </div>
        </div>
      )}

      {/* Title pill — centered at top */}
      {mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              padding: '8px 20px',
              borderRadius: '999px',
              background: GLASS.titlePillBg,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>🌍</span>
            <span
              style={{
                fontSize: '14px',
                fontFamily: 'var(--font-jakarta)',
                fontWeight: 700,
                color: THEME.textPrimary,
                letterSpacing: '-0.01em',
              }}
            >
              Santiago&apos;s World
            </span>
          </div>
        </div>
      )}

      {/* Check-in detail popup */}
      {selectedCheckIn && (
        <CheckInDetail checkin={selectedCheckIn} onClose={() => setSelectedCheckIn(null)} />
      )}
    </div>
  );
}
