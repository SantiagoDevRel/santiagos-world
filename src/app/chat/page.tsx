'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllCheckIns } from '@/lib/db';
import type { CheckIn } from '@/lib/db';

const SUGGESTIONS = [
  { emoji: '\u{1F355}', text: 'Best food nearby' },
  { emoji: '\u{2615}', text: 'Coworking spots' },
  { emoji: '\u{1F3CB}\u{FE0F}', text: 'Gyms around me' },
  { emoji: '\u{1F30D}', text: 'Where have I been?' },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface LocationInfo {
  lat: number;
  lng: number;
  city: string;
  country: string;
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [locationStatus, setLocationStatus] = useState<string>('Getting location...');
  const [streamingContent, setStreamingContent] = useState('');
  const [messageUsage, setMessageUsage] = useState<Record<string, { input_tokens: number; output_tokens: number; total_cost_usd: number }>>({});
  const [totalSessionCost, setTotalSessionCost] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingContent, scrollToBottom]);

  // Load data on mount (no chat history — fresh start every time)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      // Load all check-ins (these persist forever)
      const allCheckins = await getAllCheckIns();
      setCheckins(allCheckins);

      // Get current GPS location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
              const data = await res.json();
              setLocation({
                lat: latitude,
                lng: longitude,
                city: data.city || 'Unknown',
                country: data.country || 'Unknown',
              });
              setLocationStatus(`\u{1F4CD} ${data.city}, ${data.country}`);
            } catch {
              setLocation({ lat: latitude, lng: longitude, city: 'Unknown', country: 'Unknown' });
              setLocationStatus('\u{1F4CD} Location found');
            }
          },
          () => {
            setLocationStatus('\u{26A0}\u{FE0F} Location unavailable');
            fetch('https://ipapi.co/json/')
              .then((r) => r.json())
              .then((data) => {
                if (data.latitude) {
                  setLocation({
                    lat: data.latitude,
                    lng: data.longitude,
                    city: data.city || 'Unknown',
                    country: data.country_name || 'Unknown',
                  });
                  setLocationStatus(`\u{1F4CD} ${data.city}, ${data.country_name} (approx)`);
                }
              })
              .catch(() => {});
          },
          { enableHighAccuracy: false, timeout: 10000 }
        );
      } else {
        setLocationStatus('\u{26A0}\u{FE0F} Geolocation not supported');
      }
    }

    init();
  }, []);

  // Reset chat to fresh state
  const handleNewSearch = () => {
    setMessages([]);
    setMessageUsage({});
    setTotalSessionCost(0);
    setInput('');
    inputRef.current?.focus();
  };

  // Send message with streaming
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(false);
    setStreamingContent('');
    setToolStatus(null);

    try {
      // Only send last 4 messages for context (2 exchanges)
      const allMsgs = [...messages, userMessage];
      const recentHistory = allMsgs.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: recentHistory.slice(0, -1),
          location,
          checkinHistory: checkins,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || 'Chat request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';
      let usageData: { input_tokens: number; output_tokens: number; total_cost_usd: number } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text_delta') {
              if (!isStreaming) setIsStreaming(true);
              setToolStatus(null);
              accumulatedText += event.text;
              setStreamingContent(accumulatedText);
            } else if (event.type === 'tool_status') {
              setToolStatus(event.message);
            } else if (event.type === 'error') {
              accumulatedText = event.message;
              setStreamingContent(accumulatedText);
            } else if (event.type === 'done') {
              if (event.usage) usageData = event.usage;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (accumulatedText) {
        const msgId = crypto.randomUUID();
        const assistantMessage: ChatMessage = {
          id: msgId,
          role: 'assistant',
          content: accumulatedText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (usageData) {
          setMessageUsage((prev) => ({ ...prev, [msgId]: usageData! }));
          setTotalSessionCost((prev) => prev + usageData!.total_cost_usd);
        }
      }
    } catch (error) {
      const errText = error instanceof Error ? error.message : 'Something went wrong';
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I ran into an issue: ${errText}. Try again?`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingContent('');
      setToolStatus(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Format message content with basic markdown
  const formatContent = (content: string) => {
    const text = content;
    return text
      .split('\n')
      .map((line) => {
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        line = line.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
        line = line.replace(/`([^`]+)`/g, '<code class="bg-white/5 px-1.5 py-0.5 rounded text-accent/80 text-[13px]">$1</code>');
        // Markdown links first (before bare URLs)
        line = line.replace(
          /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener" class="text-accent underline underline-offset-2 hover:text-accent/80">$1</a>'
        );
        // Bare URLs
        line = line.replace(
          /(?<!\(|"|'|href=)(https?:\/\/[^\s<)\]"']+)/g,
          '<a href="$1" target="_blank" rel="noopener" class="text-accent underline underline-offset-2 hover:text-accent/80 break-all text-[12px]">\u{1F5FA}\u{FE0F} Open in Google Maps</a>'
        );
        if (line.startsWith('- ') || line.startsWith('\u{2022} ')) {
          return `<div class="flex gap-2 ml-1 mb-1"><span class="text-accent shrink-0">\u{2022}</span><span>${line.slice(2)}</span></div>`;
        }
        const numbered = line.match(/^(\d+)\.\s(.*)/);
        if (numbered) {
          return `<div class="flex gap-2 ml-1 mb-1"><span class="text-accent shrink-0 font-semibold">${numbered[1]}.</span><span>${numbered[2]}</span></div>`;
        }
        if (line.trim() === '') return '<div class="h-2"></div>';
        return `<span>${line}</span><br/>`;
      })
      .join('');
  };

  // Show "new search" hint after 6 messages (3 exchanges)
  const showResetHint = messages.length >= 6 && !isLoading;

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
          <div className="flex-1">
            <h1 className="text-[17px] font-[family-name:var(--font-display)] font-bold text-text-primary">
              AI City Guide
            </h1>
            <p className="text-[11px] text-accent/60 font-[family-name:var(--font-body)] font-medium">
              {locationStatus}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalSessionCost > 0 && (
              <span className="text-[10px] font-[family-name:var(--font-mono)]" style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
                ${totalSessionCost.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {/* Welcome message if no history */}
        {messages.length === 0 && !isLoading && (
          <>
            <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.1s' }}>
              <div className="flex gap-3 max-w-[88%]">
                <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <div className="glass rounded-2xl rounded-tl-lg px-4 py-3.5">
                  <p className="text-text-primary/85 text-[14px] leading-[1.65] font-[family-name:var(--font-body)]">
                    Hey Santiago! 👋 What are you looking for?
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pl-11 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0.3s' }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(`${s.emoji} ${s.text}`)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/8 text-text-secondary text-[13px] font-[family-name:var(--font-body)] min-h-[40px] hover:border-accent/20 hover:text-accent transition-all active:scale-95"
                >
                  <span>{s.emoji}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Chat messages */}
        {messages.map((msg) => {
          return (
            <div key={msg.id}>
              <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0 mt-1">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3.5 text-[14px] leading-[1.65] font-[family-name:var(--font-body)] ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-accent/20 to-accent-secondary/15 text-text-primary rounded-tr-lg border border-accent/10'
                      : 'glass rounded-tl-lg text-text-primary/85'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>

              {/* Cost tracker */}
              {msg.role === 'assistant' && messageUsage[msg.id] && (
                <div className="ml-11 mt-1 text-[11px] font-[family-name:var(--font-mono)]" style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
                  ⚡ {messageUsage[msg.id].input_tokens.toLocaleString()} in · {messageUsage[msg.id].output_tokens.toLocaleString()} out · ${messageUsage[msg.id].total_cost_usd.toFixed(4)}
                </div>
              )}

            </div>
          );
        })}

        {/* Streaming assistant message */}
        {isLoading && streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0 mt-1">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <div className="max-w-[85%] glass rounded-2xl rounded-tl-lg px-4 py-3.5 text-[14px] leading-[1.65] font-[family-name:var(--font-body)] text-text-primary/85">
              <div dangerouslySetInnerHTML={{ __html: formatContent(streamingContent) }} />
              <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
            </div>
          </div>
        )}

        {/* Tool status indicator */}
        {isLoading && toolStatus && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0 mt-1">
              <svg className="w-4 h-4 text-accent animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <div className="glass rounded-2xl rounded-tl-lg px-4 py-3 text-[13px] text-accent/70 font-[family-name:var(--font-body)]">
              {toolStatus}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && !streamingContent && !toolStatus && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0 mt-1">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <div className="glass rounded-2xl rounded-tl-lg px-4 py-3.5">
              <div className="flex items-center gap-2 text-[13px] text-text-tertiary font-[family-name:var(--font-body)]">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="ml-1">Santiago&apos;s Guide is thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Reset hint after 6 messages */}
        {showResetHint && (
          <div className="text-center py-2">
            <span className="text-[12px] text-text-tertiary/50 font-[family-name:var(--font-body)]">
              💡 Found what you need? Tap{' '}
              <button
                onClick={handleNewSearch}
                className="text-accent hover:text-accent/80 underline underline-offset-2"
              >
                🔄 New search
              </button>
              {' '}to start fresh
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="px-4 pb-3 pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-2">
          {/* New Search button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewSearch}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shrink-0 border border-white/8 hover:border-accent/30 text-text-tertiary hover:text-accent transition-all active:scale-90"
              title="New search"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          )}
          <div className="flex-1 glass rounded-full px-5 py-3 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="w-full bg-transparent text-text-primary text-[14px] placeholder:text-text-tertiary focus:outline-none disabled:opacity-40 font-[family-name:var(--font-body)]"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shrink-0 shadow-lg transition-all active:scale-90 ${
              input.trim() && !isLoading
                ? 'bg-gradient-to-br from-accent to-accent-secondary shadow-accent/20 hover:shadow-accent/30'
                : 'bg-bg-tertiary opacity-35'
            }`}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
