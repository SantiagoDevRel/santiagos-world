'use client';

import { useEffect, useState } from 'react';
import { getAllCheckIns, type CheckIn } from '@/lib/db';
import { CONTINENT_COLORS, RATING_COLOR } from '@/lib/constants';
import { subscribe } from '@/lib/events';
import { TAG_STYLES } from '@/components/CheckInDetail';

const CONTINENT_LIST = ['Europe', 'Africa', 'LATAM', 'Asia', 'North America', 'Oceania'];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function HistoryPage() {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    getAllCheckIns().then(setCheckins);
    const unsubscribe = subscribe('checkin-added', () => {
      getAllCheckIns().then(setCheckins);
    });
    return unsubscribe;
  }, []);

  const activeContinents: string[] = [...new Set(checkins.map((c) => c.continent))].sort();
  const filtered = filter === 'all' ? checkins : checkins.filter((c) => c.continent === filter);

  const totalCountries = new Set(checkins.map((c) => c.country)).size;
  const totalCities = new Set(checkins.map((c) => c.city)).size;

  // Empty state
  if (checkins.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-page page-transition">
        <span className="text-[56px] mb-5">🌍</span>
        <h2 className="text-[20px] font-[family-name:var(--font-display)] font-bold text-text-primary mb-2">
          No check-ins yet
        </h2>
        <p className="text-text-secondary text-[14px] font-[family-name:var(--font-body)] max-w-[240px]">
          Start exploring the world and your timeline will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-page page-transition">
      <div className="px-5 pt-5 pb-2">
        {/* Header */}
        <h1 className="text-[22px] font-[family-name:var(--font-display)] font-extrabold text-text-primary tracking-tight mb-5">
          History
        </h1>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <StatCard value={totalCountries} label="countries" />
          <StatCard value={totalCities} label="cities" />
          <StatCard value={checkins.length} label="check-ins" />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-5 px-5 scrollbar-none">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
          {CONTINENT_LIST.filter((c) => activeContinents.includes(c)).map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              <span
                className="w-[6px] h-[6px] rounded-full inline-block mr-1.5 shrink-0"
                style={{ backgroundColor: CONTINENT_COLORS[c] || '#666' }}
              />
              {c}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="px-5 pb-28 space-y-2.5">
        {filtered.map((checkin, i) => {
          const color = CONTINENT_COLORS[checkin.continent] || CONTINENT_COLORS.Other;
          return (
            <div
              key={checkin.id}
              className="glass rounded-2xl p-4 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s`, opacity: 0 }}
            >
              <div className="flex items-start gap-3.5">
                {/* Continent dot */}
                <div className="mt-1.5 shrink-0">
                  <div
                    className="w-[10px] h-[10px] rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}44` }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-text-primary font-[family-name:var(--font-display)] font-bold text-[15px] truncate">
                      {checkin.city}
                    </h3>
                    <span className="text-text-tertiary text-[11px] font-[family-name:var(--font-mono)] shrink-0">
                      {relativeTime(checkin.created_at)}
                    </span>
                  </div>
                  <p className="text-text-secondary text-[12px] font-[family-name:var(--font-body)] mt-0.5">{checkin.country}</p>

                  {checkin.note && (
                    <p className="text-text-secondary text-[12px] font-[family-name:var(--font-body)] italic mt-2 line-clamp-1 opacity-70">
                      &ldquo;{checkin.note}&rdquo;
                    </p>
                  )}

                  {(checkin.tags.length > 0 || checkin.rating) && (
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {checkin.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide rounded-full border ${TAG_STYLES[tag] || 'bg-white/5 text-text-secondary border-white/8'}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {checkin.rating && (
                        <span style={{ color: RATING_COLOR }} className="text-[11px] ml-auto">{'★'.repeat(checkin.rating)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="glass rounded-xl p-3.5 text-center">
      <div className="text-accent text-[22px] font-[family-name:var(--font-display)] font-extrabold leading-none mb-1">
        {value}
      </div>
      <div className="text-text-tertiary text-[10px] font-[family-name:var(--font-body)] uppercase tracking-[0.1em]">
        {label}
      </div>
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2.5 rounded-full text-[12px] font-medium whitespace-nowrap min-h-[40px] transition-all duration-200 active:scale-95 border font-[family-name:var(--font-body)] ${
        active
          ? 'bg-accent/12 text-accent border-accent/20'
          : 'bg-transparent text-text-secondary border-white/6 hover:border-white/12'
      }`}
    >
      {children}
    </button>
  );
}
