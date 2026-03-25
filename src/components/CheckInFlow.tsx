'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { addCheckIn, type CheckIn } from '@/lib/db';
import { getCurrentPosition, reverseGeocode } from '@/lib/geo';

const TAG_OPTIONS = [
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'gym', label: 'Gym', emoji: '💪' },
  { id: 'personal', label: 'Personal', emoji: '👤' },
  { id: 'event', label: 'Event', emoji: '🎤' },
];

export default function CheckInFlow() {
  const [step, setStep] = useState<'idle' | 'locating' | 'form' | 'saving' | 'done' | 'error'>('idle');
  const [location, setLocation] = useState<{
    latitude: number; longitude: number; city: string; country: string; continent: string; address: string;
  } | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; angle: number; color: string }>>([]);
  const successRef = useRef<HTMLDivElement>(null);

  const handleCheckIn = async () => {
    setStep('locating');
    try {
      const pos = await getCurrentPosition();
      let geo;
      try { geo = await reverseGeocode(pos.latitude, pos.longitude); }
      catch { geo = { city: 'Unknown', country: 'Unknown', continent: 'Other', address: `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}` }; }
      setLocation({ latitude: pos.latitude, longitude: pos.longitude, ...geo });
      setStep('form');
    } catch (err) {
      let msg = 'Failed to get location';
      if (err && typeof err === 'object' && 'code' in err) {
        const g = err as GeolocationPositionError;
        if (g.code === 1) msg = 'Location access denied. Allow location in browser settings.';
        else if (g.code === 2) msg = 'Location unavailable. Enable Location Services in device settings.';
        else if (g.code === 3) msg = 'Location timed out. Try again.';
      } else if (err instanceof Error) msg = err.message;
      setErrorMsg(msg); setStep('error');
    }
  };

  const handleQuickSave = async () => {
    setStep('locating');
    try {
      const pos = await getCurrentPosition();
      let geo;
      try { geo = await reverseGeocode(pos.latitude, pos.longitude); }
      catch { geo = { city: 'Unknown', country: 'Unknown', continent: 'Other', address: `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}` }; }
      await saveCheckin(pos.latitude, pos.longitude, geo, '', [], null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to check in');
      setStep('error');
    }
  };

  const saveCheckin = async (
    lat: number, lng: number,
    geo: { city: string; country: string; continent: string; address: string },
    n: string, t: string[], r: number | null,
  ) => {
    const checkin: CheckIn = {
      id: uuidv4(), latitude: lat, longitude: lng,
      city: geo.city, country: geo.country, continent: geo.continent as CheckIn['continent'],
      address: geo.address, note: n, tags: t, rating: r, created_at: new Date().toISOString(),
    };
    await addCheckIn(checkin);
    window.dispatchEvent(new Event('checkin-added'));
    spawnParticles();
    setStep('done');
  };

  const handleSave = async () => {
    if (!location) return;
    setStep('saving');
    try {
      await saveCheckin(location.latitude, location.longitude, location, note, tags, rating);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save');
      setStep('error');
    }
  };

  const spawnParticles = () => {
    const colors = ['#06d6a0', '#118ab2', '#ffd166', '#ef476f', '#7b68ee', '#ff8c42'];
    setParticles(Array.from({ length: 16 }, (_, i) => ({
      id: i, x: 0, y: 0,
      angle: (360 / 16) * i,
      color: colors[i % colors.length],
    })));
  };

  useEffect(() => {
    if (particles.length > 0) {
      const t = setTimeout(() => setParticles([]), 1200);
      return () => clearTimeout(t);
    }
  }, [particles]);

  const reset = () => {
    setStep('idle'); setLocation(null); setNote(''); setTags([]); setRating(null); setErrorMsg('');
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  // ── IDLE ──
  if (step === 'idle') {
    return (
      <div
        className="page-transition"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '40px',
          padding: '32px',
          background: 'radial-gradient(ellipse at 50% 40%, rgba(6,214,160,0.06) 0%, rgba(17,138,178,0.03) 40%, #0a0a0f 70%)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '30px', fontFamily: 'var(--font-jakarta)', fontWeight: 800, color: '#f0f0f5', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Check In
          </h1>
          <p style={{ fontSize: '15px', fontFamily: 'var(--font-dm)', color: '#8888a0' }}>
            Drop a pin at your current location
          </p>
        </div>

        {/* Sonar button with 3 rings */}
        <div style={{ position: 'relative', width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Ring 1 */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              width: '180px', height: '180px', borderRadius: '50%',
              border: '1.5px solid rgba(6,214,160,0.3)',
              animation: 'sonar-ring 2.5s ease-out infinite',
            }} />
          </div>
          {/* Ring 2 */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              width: '180px', height: '180px', borderRadius: '50%',
              border: '1.5px solid rgba(6,214,160,0.2)',
              animation: 'sonar-ring 2.5s ease-out 0.7s infinite',
            }} />
          </div>
          {/* Ring 3 */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              width: '180px', height: '180px', borderRadius: '50%',
              border: '1.5px solid rgba(6,214,160,0.1)',
              animation: 'sonar-ring 2.5s ease-out 1.4s infinite',
            }} />
          </div>

          {/* Button */}
          <button
            onClick={handleCheckIn}
            style={{
              position: 'relative', zIndex: 10,
              width: '180px', height: '180px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #06d6a0, #118ab2)',
              color: 'white', fontFamily: 'var(--font-jakarta)', fontWeight: 700, fontSize: '20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
              border: 'none', cursor: 'pointer',
              boxShadow: 'inset 0 2px 20px rgba(255,255,255,0.15), 0 0 40px rgba(6,214,160,0.25), 0 8px 32px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
            onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            Check In
          </button>
        </div>

        <button
          onClick={handleQuickSave}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#555570', fontSize: '13px', fontFamily: 'var(--font-dm)',
            display: 'flex', alignItems: 'center', gap: '6px',
            minHeight: '44px', transition: 'color 0.2s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
          </svg>
          Quick mode
        </button>
      </div>
    );
  }

  // ── LOCATING / SAVING ──
  if (step === 'locating' || step === 'saving') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 bg-gradient-page">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 border-[2.5px] border-accent/12 rounded-full" />
          <div className="absolute inset-0 border-[2.5px] border-transparent border-t-accent rounded-full animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-text-primary font-[family-name:var(--font-display)] font-bold text-[17px] mb-1">
            {step === 'locating' ? 'Finding you...' : 'Saving...'}
          </p>
          <p className="text-text-tertiary text-[13px] font-[family-name:var(--font-body)]">
            {step === 'locating' ? 'Getting GPS coordinates' : 'Adding pin to your map'}
          </p>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (step === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 bg-gradient-page animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div className="text-center max-w-[300px]">
          <p className="text-text-primary font-[family-name:var(--font-display)] font-bold text-[18px] mb-1">Something went wrong</p>
          <p className="text-text-secondary text-[13px] font-[family-name:var(--font-body)]">{errorMsg}</p>
        </div>
        <button onClick={reset} className="glass rounded-xl px-8 py-3 text-text-primary text-[14px] font-medium min-h-[44px] active:scale-95 transition-transform">
          Try Again
        </button>
      </div>
    );
  }

  // ── DONE ──
  if (step === 'done') {
    return (
      <div ref={successRef} className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-gradient-page relative overflow-hidden">
        {/* Particle burst */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: '50%', top: '40%',
              backgroundColor: p.color,
              animation: `particle-burst 0.8s ease-out forwards`,
              transform: `translate(-50%,-50%) rotate(${p.angle}deg) translateY(-60px)`,
              opacity: 0,
              animationName: 'none',
            }}
            ref={(el) => {
              if (el) {
                el.animate([
                  { transform: `translate(-50%,-50%)`, opacity: 1 },
                  { transform: `translate(${Math.cos(p.angle * Math.PI / 180) * 80}px, ${Math.sin(p.angle * Math.PI / 180) * 80}px) scale(0)`, opacity: 0 },
                ], { duration: 800, easing: 'cubic-bezier(0,0,0.2,1)', fill: 'forwards', delay: p.id * 20 });
              }
            }}
          />
        ))}

        {/* Pin drop icon */}
        <div className="animate-pin-drop">
          <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path className="animate-check-draw" strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
        </div>

        <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.35s', opacity: 0 }}>
          <p className="text-text-primary font-[family-name:var(--font-display)] font-extrabold text-[22px] mb-1">Checked in!</p>
          <p className="text-text-secondary text-[14px] font-[family-name:var(--font-body)]">Pin added to your map</p>
        </div>

        <button
          onClick={reset}
          className="animate-fade-in-up mt-2 px-10 py-3.5 bg-gradient-to-r from-accent to-accent-secondary rounded-xl text-white font-[family-name:var(--font-display)] font-bold text-[15px] min-h-[44px] active:scale-95 transition-transform shadow-lg shadow-accent/15"
          style={{ animationDelay: '0.5s', opacity: 0 }}
        >
          Done
        </button>
      </div>
    );
  }

  // ── FORM (bottom sheet style) ──
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-page">
      <div className="animate-slide-up-sheet">
        <div className="max-w-md mx-auto px-5 pt-6 pb-32 space-y-6">
          {/* Location card */}
          <div className="glass rounded-2xl p-6 text-center">
            {/* Pin icon */}
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <p className="text-text-tertiary text-[11px] uppercase tracking-[0.15em] font-semibold font-[family-name:var(--font-body)] mb-2">You&apos;re in</p>
            <h2 className="text-[28px] font-[family-name:var(--font-display)] font-extrabold text-text-primary tracking-tight leading-tight">
              {location?.city}
            </h2>
            <p className="text-accent text-[16px] font-[family-name:var(--font-display)] font-semibold mt-1">{location?.country}</p>
            <p className="text-text-tertiary text-[11px] mt-3 leading-relaxed font-[family-name:var(--font-body)]">{location?.address}</p>
          </div>

          {/* Note */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.05s', opacity: 0 }}>
            <label className="block text-text-secondary text-[12px] font-semibold uppercase tracking-[0.1em] mb-2 font-[family-name:var(--font-body)]">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What are you doing here?"
              className="w-full glass rounded-xl p-4 text-text-primary text-[15px] placeholder:text-text-tertiary focus:outline-none focus:border-accent/30 resize-none h-[100px] font-[family-name:var(--font-body)] transition-all"
            />
          </div>

          {/* Tags */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
            <label className="block text-text-secondary text-[12px] font-semibold uppercase tracking-[0.1em] mb-3 font-[family-name:var(--font-body)]">
              Tags
            </label>
            <div className="flex flex-wrap gap-2.5">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium min-h-[44px] transition-all duration-200 active:scale-95 border font-[family-name:var(--font-body)] ${
                    tags.includes(tag.id)
                      ? 'bg-accent/15 text-accent border-accent/25 shadow-[0_0_12px_rgba(6,214,160,0.1)]'
                      : 'bg-transparent text-text-secondary border-white/8 hover:border-white/15'
                  }`}
                >
                  <span className="text-[14px]">{tag.emoji}</span>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
            <label className="block text-text-secondary text-[12px] font-semibold uppercase tracking-[0.1em] mb-3 font-[family-name:var(--font-body)]">
              Rate this spot
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(rating === star ? null : star)}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-[20px] min-h-[44px] min-w-[44px] transition-all duration-200 active:scale-90 border ${
                    rating && star <= rating
                      ? 'bg-[#ffd166]/12 text-[#ffd166] border-[#ffd166]/20'
                      : 'bg-transparent text-text-tertiary/40 border-white/6'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="pt-3 space-y-3 animate-fade-in-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
            <button
              onClick={handleSave}
              className="w-full py-4 bg-gradient-to-r from-accent to-accent-secondary rounded-xl text-white font-[family-name:var(--font-display)] font-bold text-[16px] min-h-[52px] active:scale-[0.98] transition-transform shadow-lg shadow-accent/15"
            >
              Save Check-In
            </button>
            <button
              onClick={reset}
              className="w-full py-3 text-text-tertiary text-[13px] font-[family-name:var(--font-body)] min-h-[44px] transition-colors hover:text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
