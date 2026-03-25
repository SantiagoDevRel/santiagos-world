'use client';

import { useState } from 'react';

const SUGGESTIONS = [
  { emoji: '🍕', text: 'Best food nearby' },
  { emoji: '☕', text: 'Coworking spots' },
  { emoji: '🏋️', text: 'Gyms around me' },
];

export default function ChatPage() {
  const [input, setInput] = useState('');

  return (
    <div className="flex-1 flex flex-col bg-gradient-page page-transition">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent-secondary flex items-center justify-center shrink-0 shadow-lg shadow-accent/15">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-[17px] font-[family-name:var(--font-display)] font-bold text-text-primary">
              AI City Guide
            </h1>
            <p className="text-[11px] text-accent/60 font-[family-name:var(--font-body)] font-medium">
              Powered by Claude
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {/* Welcome message */}
        <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.1s' }}>
          <div className="flex gap-3 max-w-[88%]">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0 mt-1">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <div className="glass rounded-2xl rounded-tl-lg px-4 py-3.5">
              <p className="text-text-primary/85 text-[14px] leading-[1.65] font-[family-name:var(--font-body)]">
                Hey Santiago 👋 I&apos;m your AI city guide. Check in somewhere and ask me anything about your location.
              </p>
            </div>
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2 pl-11 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.3s' }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              disabled
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/8 text-text-secondary text-[13px] font-[family-name:var(--font-body)] min-h-[40px] hover:border-accent/20 hover:text-accent transition-all disabled:opacity-60"
            >
              <span>{s.emoji}</span>
              {s.text}
            </button>
          ))}
        </div>

        {/* Coming soon */}
        <div className="flex justify-center pt-6 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.5s' }}>
          <div className="glass-subtle rounded-full px-5 py-2.5 flex items-center gap-2.5">
            <div className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse" />
            <span className="text-text-tertiary text-[11px] font-semibold uppercase tracking-wider font-[family-name:var(--font-body)]">
              Coming in Phase 3
            </span>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-3 pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 glass rounded-full px-5 py-3 flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled
              className="w-full bg-transparent text-text-primary text-[14px] placeholder:text-text-tertiary focus:outline-none disabled:opacity-40 font-[family-name:var(--font-body)]"
            />
          </div>
          <button
            disabled
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gradient-to-br from-accent to-accent-secondary flex items-center justify-center shrink-0 opacity-35 shadow-lg shadow-accent/10"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
