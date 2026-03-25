// ── Theme colors ──
export const THEME = {
  bgPrimary: '#0a0a0f',
  bgSecondary: '#0d0d16',
  bgTertiary: '#16162a',
  bgHighway: '#1a1a30',
  water: '#080810',
  borderSubtle: '#1a1a2e',
  borderCountry: '#222240',
  textPrimary: '#f0f0f5',
  textSecondary: '#8888a0',
  textTertiary: '#555570',
  labelText: '#444460',
  accent: '#06d6a0',
  accentSecondary: '#118ab2',
  danger: '#ef476f',
} as const;

// ── Continent colors ──
export const CONTINENT_COLORS: Record<string, string> = {
  Europe: '#118ab2',           // ocean blue
  Africa: '#06d6a0',           // minty teal
  LATAM: '#ffd166',            // warm yellow
  Asia: '#ef476f',             // coral red
  'North America': '#7b68ee', // medium slate blue
  Oceania: '#ff8c42',          // tangerine
  Other: '#555570',            // muted gray
};

// ── Pin / marker colors ──
export const PIN = {
  borderColor: 'rgba(255,255,255,0.9)',
  glowAlpha: '55',
  shadowColor: 'rgba(0,0,0,0.5)',
} as const;

// ── Tag display colors (used in CheckInDetail & history) ──
export const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  travel:   { bg: '#118ab2', text: '#118ab2', border: '#118ab2' },
  work:     { bg: '#7b68ee', text: '#7b68ee', border: '#7b68ee' },
  personal: { bg: '#ef476f', text: '#ef476f', border: '#ef476f' },
  event:    { bg: '#ff8c42', text: '#ff8c42', border: '#ff8c42' },
  food:     { bg: '#06d6a0', text: '#06d6a0', border: '#06d6a0' },
  gym:      { bg: '#ffd166', text: '#ffd166', border: '#ffd166' },
};

// ── Rating star color ──
export const RATING_COLOR = '#ffd166';

// ── Particle burst palette ──
export const PARTICLE_COLORS = ['#06d6a0', '#118ab2', '#ffd166', '#ef476f', '#7b68ee', '#ff8c42'];

// ── Nav colors ──
export const NAV = {
  activeColor: '#06d6a0',
  inactiveColor: '#555570',
  bgOverlay: 'rgba(10, 10, 15, 0.85)',
} as const;

// ── Glass / overlay colors ──
export const GLASS = {
  titlePillBg: 'rgba(10, 10, 15, 0.8)',
} as const;
