'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAllCheckIns, type CheckIn } from '@/lib/db';
import { getCurrentPosition } from '@/lib/geo';
import { CONTINENT_COLORS } from '@/lib/geo';
import CheckInDetail from './CheckInDetail';

declare global {
  interface Window {
    google: typeof google;
  }
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
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
    if (window.google?.maps) { setMapLoaded(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) { existing.addEventListener('load', () => setMapLoaded(true)); return; }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setError('Failed to load Google Maps');
    document.head.appendChild(script);
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
        mapId: 'santiagos-world-map',
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0d0d16' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0d16' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#444460' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#16162a' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#16162a' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1a1a30' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080810' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
          { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#222240' }] },
        ],
      });
      loadCheckins();
    };
    initMap();
  }, [mapLoaded, loadCheckins]);

  // Place markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    checkins.forEach((checkin) => {
      const color = CONTINENT_COLORS[checkin.continent] || CONTINENT_COLORS.Other;
      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        width:14px; height:14px; border-radius:50%;
        background:${color}; border:2px solid rgba(255,255,255,0.9);
        box-shadow: 0 0 10px ${color}55, 0 2px 6px rgba(0,0,0,0.5);
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
      marker.addListener('click', () => setSelectedCheckIn(checkin));
      markersRef.current.push(marker);
    });
  }, [checkins, mapLoaded]);

  // Listen for new checkins
  useEffect(() => {
    const handler = () => loadCheckins();
    window.addEventListener('checkin-added', handler);
    return () => window.removeEventListener('checkin-added', handler);
  }, [loadCheckins]);

  // Error state
  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: '32px', textAlign: 'center' }}>
        <div>
          <p style={{ color: '#f0f0f5', fontFamily: 'var(--font-jakarta)', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>Map unavailable</p>
          <p style={{ color: '#8888a0', fontSize: '14px', fontFamily: 'var(--font-dm)' }}>{error}</p>
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
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(6,214,160,0.15)', borderTopColor: '#06d6a0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#555570', fontSize: '13px', fontFamily: 'var(--font-dm)' }}>Loading map...</p>
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
              background: 'rgba(10, 10, 15, 0.8)',
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
                color: '#f0f0f5',
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
