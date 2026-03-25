'use client';

import { type CheckIn } from '@/lib/db';
import { CONTINENT_COLORS } from '@/lib/geo';

const TAG_STYLES: Record<string, string> = {
  travel: 'bg-[#118ab2]/12 text-[#118ab2] border-[#118ab2]/15',
  work: 'bg-[#7b68ee]/12 text-[#7b68ee] border-[#7b68ee]/15',
  personal: 'bg-[#ef476f]/12 text-[#ef476f] border-[#ef476f]/15',
  event: 'bg-[#ff8c42]/12 text-[#ff8c42] border-[#ff8c42]/15',
  food: 'bg-[#06d6a0]/12 text-[#06d6a0] border-[#06d6a0]/15',
  gym: 'bg-[#ffd166]/12 text-[#ffd166] border-[#ffd166]/15',
};

interface Props {
  checkin: CheckIn;
  onClose: () => void;
}

export default function CheckInDetail({ checkin, onClose }: Props) {
  const color = CONTINENT_COLORS[checkin.continent] || CONTINENT_COLORS.Other;
  const date = new Date(checkin.created_at);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="absolute bottom-3 left-3 right-3 z-40 animate-slide-up-sheet">
      <div className="glass-strong rounded-2xl p-5">
        {/* Handle bar */}
        <div className="flex justify-center mb-4">
          <div className="w-8 h-1 rounded-full bg-white/10" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: `${color}15`, boxShadow: `0 0 20px ${color}10` }}
            >
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}66` }} />
            </div>
            <div>
              <h3 className="text-text-primary font-[family-name:var(--font-display)] font-bold text-[18px] leading-tight">
                {checkin.city}
              </h3>
              <p className="text-text-secondary text-[13px] mt-0.5 font-[family-name:var(--font-body)]">
                {checkin.country}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-secondary transition-colors p-2 -mr-2 -mt-1 rounded-xl hover:bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Date + address */}
        <div className="mb-3 space-y-1">
          <p className="text-text-tertiary text-[12px] font-[family-name:var(--font-body)]">
            {dateStr} · {timeStr}
          </p>
          {checkin.address && (
            <p className="text-text-tertiary text-[11px] font-[family-name:var(--font-body)]">{checkin.address}</p>
          )}
        </div>

        {/* Note */}
        {checkin.note && (
          <div className="bg-white/[0.03] rounded-xl p-3.5 mb-3 border border-white/[0.04]">
            <p className="text-text-secondary text-[13px] leading-relaxed italic font-[family-name:var(--font-body)]">
              &ldquo;{checkin.note}&rdquo;
            </p>
          </div>
        )}

        {/* Tags + Rating */}
        <div className="flex items-center gap-2 flex-wrap">
          {checkin.tags.map((tag) => (
            <span
              key={tag}
              className={`px-2.5 py-[5px] text-[10px] font-semibold rounded-full border ${TAG_STYLES[tag] || 'bg-white/5 text-text-secondary border-white/8'}`}
            >
              {tag}
            </span>
          ))}
          {checkin.rating && (
            <span className="text-[#ffd166] text-[13px] ml-auto tracking-wider">
              {'★'.repeat(checkin.rating)}
              <span className="text-white/8">{'★'.repeat(5 - checkin.rating)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { TAG_STYLES };
