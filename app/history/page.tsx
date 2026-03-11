'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import type { Transition } from 'framer-motion';
import NavBar from '@/src/components/NavBar';
import { avatarColor } from '@/src/lib/avatarColor';

function SpotlightCard({ children, className = '', spotlightColor = 'rgba(245, 158, 11, 0.10)', onClick }: { children: React.ReactNode; className?: string; spotlightColor?: string; onClick?: () => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = e => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  return (
    <div ref={divRef} onMouseMove={handleMouseMove} onClick={onClick}
      onFocus={() => { setIsFocused(true); setOpacity(1); }}
      onBlur={() => { setIsFocused(false); setOpacity(0); }}
      onMouseEnter={() => setOpacity(1)} onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-500 rounded-[inherit]"
        style={{ opacity, background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)` }} />
      {children}
    </div>
  );
}

function BlurText({ text = '', delay = 120, className = '' }: { text?: string; delay?: number; className?: string }) {
  const elements = text.split(' ');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const defaultFrom = { filter: 'blur(10px)', opacity: 0, y: 20 };
  const defaultTo = [{ filter: 'blur(5px)', opacity: 0.5, y: -5 }, { filter: 'blur(0px)', opacity: 1, y: 0 }];
  const stepCount = defaultTo.length + 1;
  const totalDuration = 0.35 * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => i / (stepCount - 1));
  const buildKeyframes = (from: Record<string, string|number>, steps: Record<string, string|number>[]) => {
    const keys = new Set([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);
    const kf: Record<string, (string|number)[]> = {};
    keys.forEach(k => { kf[k] = [from[k], ...steps.map(s => s[k])]; });
    return kf;
  };
  return (
    <p ref={ref} className={`flex flex-wrap gap-x-[0.25em] ${className}`}>
      {elements.map((word, index) => (
        <motion.span key={index} initial={defaultFrom}
          animate={inView ? buildKeyframes(defaultFrom, defaultTo) : defaultFrom}
          transition={{ duration: totalDuration, times, delay: (index * delay) / 1000, ease: (t: number) => t } as Transition}
          style={{ display: 'inline-block', willChange: 'transform, filter, opacity' }}>
          {word}
        </motion.span>
      ))}
    </p>
  );
}

function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

interface PersonCardSummary {
  id: string;
  participantName: string;
  limitedResearch: boolean;
  isArchetype: boolean;
  sessionCount: number;
}

interface ContextSummary {
  id: string;
  eventType: string;
  industry: string;
  userRole: string;
  userGoal: string;
  createdAt: string;
  expiresAt: string;
  personCards: PersonCardSummary[];
}

export default function HistoryPage() {
  const router = useRouter();
  const [contexts, setContexts] = useState<ContextSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    fetch('/api/context', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => { setContexts(data.contexts || []); setIsLoading(false); })
      .catch((err) => { setError(err.message); setIsLoading(false); });
  }, []);

  const handleDeleteContext = async (contextId: string) => {
    if (!confirm('Delete this prep session?')) return;
    try {
      await fetch(`/api/context/${contextId}`, { method: 'DELETE' });
      setContexts(prev => prev.filter(c => c.id !== contextId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleClearLibrary = async () => {
    if (!confirm('Clear all prep sessions? This cannot be undone.')) return;
    setIsClearing(true);
    try {
      await fetch('/api/context', { method: 'DELETE' });
      setContexts([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear library');
    } finally {
      setIsClearing(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream">
        <NavBar />
        <div className="py-10 px-4 sm:px-6 max-w-3xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-ink/[0.08] rounded-2xl p-6">
              <div className="h-4 animate-shimmer rounded w-1/3 mb-3" />
              <div className="h-3 animate-shimmer rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream">
        <NavBar />
        <div className="py-12 px-4 flex items-center justify-center">
          <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 max-w-md w-full text-center">
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button onClick={() => location.reload()} className="text-sm text-ink font-semibold hover:text-ink/70 transition-colors">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (contexts.length === 0) {
    return (
      <div className="min-h-screen bg-cream">
        <NavBar />
        <div className="py-32 px-4 flex flex-col items-center text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-white border border-ink/[0.08] flex items-center justify-center text-2xl mb-6">
            🤝
          </div>
          <h2 className="text-xl font-extrabold text-ink mb-2">No prep sessions yet</h2>
          <p className="text-sm text-ink-muted mb-8 max-w-xs leading-relaxed">
            Start by telling us about your next networking event. We&apos;ll build person cards and talking points.
          </p>
          <button
            onClick={() => router.push('/prep')}
            className="bg-ink hover:bg-ink/80 text-cream py-2.5 px-6 rounded-lg text-sm font-bold transition-colors active:scale-[0.98]"
          >
            + New Prep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <NavBar />
      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 animate-slide-up flex items-end justify-between gap-4">
            <div>
              <BlurText text="Library" className="text-2xl font-extrabold tracking-tight text-ink" delay={100} />
              <p className="text-sm text-ink-muted mt-1">{contexts.length} prep session{contexts.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={handleClearLibrary}
              disabled={isClearing}
              className="shrink-0 text-xs text-ink-muted hover:text-red-500 font-medium transition-colors disabled:opacity-50 pb-0.5"
            >
              {isClearing ? 'Clearing...' : 'Clear all'}
            </button>
          </div>

          <div className="space-y-3">
            {contexts.map((ctx, i) => (
              <AnimatedCard key={ctx.id} index={i}>
              <SpotlightCard className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden shadow-[0_2px_0_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.05)] cursor-pointer hover:border-ink/[0.15] transition-colors"
                onClick={() => router.push(`/prep/${ctx.id}`)}>
              <div>
                {/* Context header */}
                <div className="px-5 py-4 border-b border-ink/[0.06] flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-ink truncate">
                      {ctx.eventType || 'Networking Event'}
                      {ctx.industry && <span className="text-ink-muted/50 font-normal"> · {ctx.industry}</span>}
                    </h2>
                    <p className="text-xs text-ink-muted mt-0.5 truncate">{ctx.userRole} · {ctx.userGoal}</p>
                    <p className="text-xs text-ink-muted/50 mt-1">Prepped {formatDate(ctx.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteContext(ctx.id); }}
                      className="text-ink-muted/40 hover:text-red-400 transition-colors"
                      title="Delete prep session"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Person cards */}
                {ctx.personCards.length === 0 ? (
                  <div className="px-5 py-3 text-xs text-ink-muted/50">No person cards generated.</div>
                ) : (
                  <div className="divide-y divide-ink/[0.04]">
                    {ctx.personCards.map((pc) => (
                      <div key={pc.id} className="px-5 py-3.5 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                          pc.isArchetype ? 'bg-ink/[0.06] text-ink' : avatarColor(pc.participantName)
                        }`}>
                          {pc.participantName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{pc.participantName}</p>
                          <p className="text-xs text-ink-muted/50">
                            {pc.sessionCount === 0 ? 'No practice yet' : `${pc.sessionCount} session${pc.sessionCount > 1 ? 's' : ''}`}
                            {pc.isArchetype ? ' · practice persona' : pc.limitedResearch ? ' · limited intel' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </SpotlightCard>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
