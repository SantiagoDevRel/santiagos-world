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
  }
}

/**
 * Promise-based singleton loader for the Google Maps script.
 * Handles three states: already loaded, loading in progress, not started.
 */
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  // Already loaded
  if (window.google?.maps) return Promise.resolve();

  // Loading in progress — reuse existing promise
  if (window.__googleMapsLoaderPromise) return window.__googleMapsLoaderPromise;

  // Not started — create & cache the promise
  window.__googleMapsLoaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      // Script tag exists but hasn't finished loading yet
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return window.__googleMapsLoaderPromise;
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const listenerRefs = useRef<google.maps.MapsEventListener[]>([]);
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

    loadGoogleMapsScript(apiKey)
      .then(() => setMapLoaded(true))
      .catch(() => setError('Failed to load Google Maps'));
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

      mapInstanceRef.current = new google.maps.Map(mapRef.current!, {
        center, zoom,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        styles: [
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
        ],
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
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    checkins.forEach((checkin) => {
      const color = CONTINENT_COLORS[checkin.continent] || CONTINENT_COLORS.Other;
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
        position: { lat: checkin.latitude, lng: checkin.longitude },
        content: pinEl,
        title: `${checkin.city}, ${checkin.country}`,
      });
      const listener = marker.addListener('click', () => setSelectedCheckIn(checkin));
      listenerRefs.current.push(listener);
      markersRef.current.push(marker);
    });

    // Cleanup when effect re-runs or unmounts
    return () => {
      listenerRefs.current.forEach((l) => l.remove());
      listenerRefs.current = [];
      markersRef.current.forEach((m) => (m.map = null));
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
