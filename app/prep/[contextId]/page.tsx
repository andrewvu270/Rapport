'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { TalkingPointsCard, PersonCard } from '@/src/types';
import NavBar from '@/src/components/NavBar';
import { avatarColor } from '@/src/lib/avatarColor';

interface PastSession {
  id: string;
  session_type: 'voice' | 'video';
  started_at: string;
  duration_seconds: number | null;
}

function SpotlightCard({ children, className = '', spotlightColor = 'rgba(245, 158, 11, 0.10)' }: { children: React.ReactNode; className?: string; spotlightColor?: string }) {
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
    <div ref={divRef} onMouseMove={handleMouseMove}
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

interface PersonCardData {
  id: string;
  participantName: string;
  card: PersonCard;
  limitedResearch: boolean;
}

interface ContextData {
  contextId: string;
  mode: string;
  eventType: string;
  industry: string;
  userRole: string;
  userGoal: string;
  talkingPointsCard: TalkingPointsCard | null;
  personCards: PersonCardData[];
  createdAt: string;
  expiresAt: string;
}

type Tab = 'intel' | 'playbook' | 'practice';

const sectionLabel = "text-xs font-medium text-ink-muted uppercase tracking-wider mb-3";

function PersonCardTabs({
  personCardData,
  startingSessionId,
  onStartSession,
}: {
  personCardData: PersonCardData;
  startingSessionId: string | null;
  onStartSession: (id: string, type: 'voice' | 'video') => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('intel');
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const { card } = personCardData;
  const isArchetype = card.isArchetype;

  const loadSessions = useCallback(async () => {
    if (sessionsLoaded) return;
    const res = await fetch(`/api/session?personCardId=${personCardData.id}`);
    if (res.ok) {
      const data = await res.json();
      setPastSessions(data.sessions ?? []);
    }
    setSessionsLoaded(true);
  }, [personCardData.id, sessionsLoaded]);

  useEffect(() => {
    if (tab === 'practice') loadSessions();
  }, [tab, loadSessions]);

  return (
    <SpotlightCard className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.06)]">
    <div>
      {/* Accent bar */}
      <div className={`h-1 w-full ${isArchetype ? 'bg-ink/20' : 'bg-amber'}`} />

      {/* Header */}
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0 ring-2 ${
              isArchetype ? 'bg-ink/[0.06] text-ink ring-ink/10' : avatarColor(personCardData.participantName)
            }`}>
              {personCardData.participantName.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-bold text-ink leading-tight">{personCardData.participantName}</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                {isArchetype ? 'Practice Persona' : personCardData.limitedResearch ? 'Limited intel' : 'Researched'}
              </p>
            </div>
          </div>

        </div>

        {/* Profile teaser */}
        <p className="mt-3 text-sm text-ink-muted leading-relaxed line-clamp-2">{card.profileSummary}</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-ink/[0.06]">
        {(['intel', 'playbook', 'practice'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors relative ${
              tab === t ? 'text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t}
            {tab === t && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-ink rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {tab === 'intel' && (
          <div className="space-y-5">
            <div>
              <h4 className={sectionLabel}>Profile</h4>
              <p className="text-sm text-ink leading-relaxed">{card.profileSummary}</p>
            </div>

            {card.topicsOfInterest.length > 0 && (
              <div>
                <h4 className={sectionLabel}>Connection Points</h4>
                <div className="space-y-2.5">
                  {card.topicsOfInterest.map((t, i) => (
                    <div key={i} className="rounded-xl border border-ink/[0.07] bg-ink/[0.02] px-3.5 py-2.5">
                      <p className="text-xs font-semibold text-ink mb-1">{t.topic}</p>
                      <p className="text-xs text-ink-muted leading-relaxed italic">&ldquo;{t.hook}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {card.thingsToAvoid.length > 0 && (
              <div>
                <h4 className={sectionLabel}>Avoid</h4>
                <div className="space-y-2">
                  {card.thingsToAvoid.map((t, i) => (
                    <div key={i} className="rounded-xl border border-red-100 bg-red-50/50 px-3.5 py-2.5">
                      <p className="text-xs font-semibold text-red-600 mb-0.5">{t.topic}</p>
                      <p className="text-xs text-red-400 leading-relaxed">{t.why}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'playbook' && (
          <div className="space-y-5">
            {card.icebreakers.length > 0 && (
              <div>
                <h4 className={sectionLabel}>Icebreakers</h4>
                <ul className="space-y-2">
                  {card.icebreakers.map((text, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-amber mt-0.5 text-xs shrink-0 leading-5">◆</span>
                      <span className="text-sm text-ink leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {card.openers?.length > 0 && (
              <div>
                <h4 className={sectionLabel}>Openers</h4>
                <ul className="space-y-2">
                  {card.openers.map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 bg-amber/10 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm text-ink leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {card.followUpQuestions?.length > 0 && (
              <div>
                <h4 className={sectionLabel}>Follow-up Questions</h4>
                <ul className="space-y-2">
                  {card.followUpQuestions.map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 bg-ink/[0.05] border border-ink/[0.08] text-ink-muted rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm text-ink leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-1">
              <h4 className={sectionLabel}>Suggested Ask</h4>
              <p className="text-sm text-ink italic px-4 py-3 bg-amber/[0.04] border border-amber/20 rounded-xl leading-relaxed">
                &ldquo;{card.suggestedAsk}&rdquo;
              </p>
            </div>
          </div>
        )}

        {tab === 'practice' && (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted leading-relaxed">
              An AI will role-play as <span className="font-semibold text-ink">{personCardData.participantName}</span>. After the session you&apos;ll get a score on rapport and goal pursuit.
            </p>
            <button
              onClick={() => onStartSession(personCardData.id, 'voice')}
              disabled={startingSessionId !== null}
              className="w-full bg-cream hover:bg-ink/[0.04] border border-ink/[0.12] disabled:opacity-50 disabled:cursor-not-allowed text-ink py-3.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              {startingSessionId === personCardData.id + 'voice' ? (
                <><div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />Starting...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>Voice Practice</>
              )}
            </button>
            <button
              onClick={() => onStartSession(personCardData.id, 'video')}
              disabled={startingSessionId !== null}
              className="w-full bg-ink hover:bg-ink/80 disabled:opacity-50 disabled:cursor-not-allowed text-cream py-3.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2.5 active:scale-[0.98] shadow-[0_2px_0_rgba(0,0,0,0.2)]"
            >
              {startingSessionId === personCardData.id + 'video' ? (
                <><div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />Starting...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Video Practice</>
              )}
            </button>

            {pastSessions.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">Past Sessions</p>
                <div className="space-y-1.5">
                  {pastSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/debrief/${s.id}`)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-ink/[0.08] hover:border-ink/[0.15] hover:bg-ink/[0.02] transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-ink-muted/50">
                          {s.session_type === 'voice' ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          )}
                        </span>
                        <span className="text-xs text-ink">
                          {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {s.duration_seconds && (
                          <span className="text-xs text-ink-muted/50">{Math.floor(s.duration_seconds / 60)}m {s.duration_seconds % 60}s</span>
                        )}
                      </div>
                      <span className="text-xs text-ink-muted/40">View debrief →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </SpotlightCard>
  );
}

export default function PrepResultsPage() {
  const params = useParams();
  const router = useRouter();
  const contextId = params.contextId as string;

  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchContextData = async () => {
      try {
        const response = await fetch(`/api/context/${contextId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch context');
        }
        const data = await response.json();
        setContextData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    fetchContextData();
  }, [contextId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream">
        <NavBar />
        <div className="py-10 px-4 max-w-3xl mx-auto space-y-3">
          <div className="h-6 animate-shimmer rounded-lg w-48 mb-6" />
          {[1, 2].map(i => (
            <div key={i} className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden">
              <div className="h-1 bg-ink/10" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full animate-shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 animate-shimmer rounded w-32" />
                    <div className="h-3 animate-shimmer rounded w-20" />
                  </div>
                </div>
                <div className="h-3 animate-shimmer rounded w-full" />
                <div className="h-3 animate-shimmer rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !contextData) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 max-w-md w-full">
          <h2 className="text-base font-semibold text-red-500 mb-2">Error</h2>
          <p className="text-sm text-ink-muted">{error || 'Context not found'}</p>
        </div>
      </div>
    );
  }

  const { talkingPointsCard, personCards } = contextData;
  const isDegradedMode = talkingPointsCard?.degradedMode || false;

  const handleStartSession = async (personCardId: string, sessionType: 'voice' | 'video') => {
    setStartingSessionId(personCardId + sessionType);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId, personCardId, sessionType }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }
      const data = await response.json();
      router.push(`/session/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStartingSessionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <NavBar />
      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Header */}
          <div className="animate-slide-up">
            <BlurText text="Your Prep Materials" className="text-2xl font-extrabold tracking-tight text-ink mb-1" delay={100} />
            <p className="text-sm text-ink-muted">
              {contextData.eventType}{contextData.industry ? ` · ${contextData.industry}` : ''}
            </p>
          </div>

          {/* Degraded Mode Banner */}
          {isDegradedMode && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-fade-in">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-semibold text-amber-700">Degraded Mode</p>
                <p className="text-xs text-amber-600/70 mt-0.5">Personalized intel unavailable — prep generated from your inputs only</p>
              </div>
            </div>
          )}

          {/* Key Lessons */}
          {talkingPointsCard && (
            <div className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.06)] animate-slide-up-1">
              <div className="h-1 bg-ink/10" />
              <div className="p-5">
                <h2 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-4">Key Lessons</h2>
                <ul className="space-y-3">
                  {talkingPointsCard.lessons.map((lesson, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 bg-ink text-cream rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm text-ink leading-relaxed">{lesson}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Person Cards */}
          {personCards.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-ink-muted uppercase tracking-wider animate-slide-up-2">
                {personCards.some(pc => pc.card.isArchetype) ? 'Practice Personas' : 'People to Meet'}
              </h2>
              {personCards.map((pc, i) => (
                <div key={pc.id} className={`animate-slide-up-${Math.min(i + 3, 7)}`}>
                  <PersonCardTabs
                    personCardData={pc}
                    startingSessionId={startingSessionId}
                    onStartSession={handleStartSession}
                  />
                </div>
              ))}
            </div>
          )}

          {personCards.length === 0 && (
            <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 text-center animate-fade-in">
              <p className="text-sm text-ink-muted">No specific people identified. Use the Key Lessons above to guide your conversations.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
