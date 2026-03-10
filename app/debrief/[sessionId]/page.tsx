'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DebriefReport, Transcript } from '@/src/types';
import NavBar from '@/src/components/NavBar';

interface DebriefResponse { pending: boolean; report?: DebriefReport; }
interface SessionData { id: string; transcript: Transcript; person_card_id: string; context_id: string; }

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score < 4 ? '#ef4444' : score <= 6 ? '#f59e0b' : '#10b981';
  const circumference = 2 * Math.PI * 36;
  const filled = (score / 10) * circumference;

  return (
    <div className="flex flex-col items-center gap-3 animate-slide-up">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#27272a" strokeWidth="6" />
          <circle cx="40" cy="40" r="36" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-zinc-100">{score}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">{label}</p>
    </div>
  );
}

export default function DebriefPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [debriefData, setDebriefData] = useState<DebriefReport | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedHomework, setCompletedHomework] = useState<Set<number>>(new Set());
  const [expandedMoments, setExpandedMoments] = useState<Set<number>>(new Set());
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const fetchDebrief = async () => {
      try {
        const response = await fetch(`/api/debrief/${sessionId}`);
        if (!response.ok) { const d = await response.json(); throw new Error(d.error || 'Failed'); }
        const data: DebriefResponse = await response.json();
        if (data.pending) { setIsPending(true); }
        else if (data.report) { setDebriefData(data.report); setIsPending(false); setIsLoading(false); }
      } catch (err) { setError(err instanceof Error ? err.message : 'An error occurred'); setIsLoading(false); }
    };
    fetchDebrief();
    const poll = setInterval(() => { if (isPending) fetchDebrief(); }, 3000);
    return () => clearInterval(poll);
  }, [sessionId, isPending]);

  useEffect(() => {
    fetch(`/api/session/${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSessionData(d))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`homework-${sessionId}`);
      if (stored) setCompletedHomework(new Set(JSON.parse(stored)));
    }
  }, [sessionId]);

  const toggleHomework = (index: number) => {
    const next = new Set(completedHomework);
    next.has(index) ? next.delete(index) : next.add(index);
    setCompletedHomework(next);
    if (typeof window !== 'undefined') localStorage.setItem(`homework-${sessionId}`, JSON.stringify(Array.from(next)));
  };

  const toggleMoment = (index: number) => {
    const next = new Set(expandedMoments);
    next.has(index) ? next.delete(index) : next.add(index);
    setExpandedMoments(next);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/session/${sessionId}/retry`, { method: 'POST' });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || 'Failed'); }
      const data = await response.json();
      router.push(`/session/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry');
    } finally { setIsRetrying(false); }
  };

  // Loading state
  if (isLoading || isPending) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <NavBar />
        <div className="py-10 px-4 max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="h-5 animate-shimmer rounded w-32 mb-3" />
            <div className="h-3 animate-shimmer rounded w-48" />
          </div>
          <div className="bg-zinc-900 border border-violet-500/20 rounded-xl p-6 mb-6 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm text-violet-300 font-medium">Analyzing your conversation and generating feedback...</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="w-20 h-20 animate-shimmer rounded-full mx-auto mb-3" />
                <div className="h-3 animate-shimmer rounded w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !debriefData) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full">
          <h2 className="text-base font-semibold text-red-400 mb-3">Error</h2>
          <p className="text-sm text-zinc-400 mb-6">{error || 'Debrief not found'}</p>
          <button onClick={() => router.push('/history')} className="w-full bg-violet-500 hover:bg-violet-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            View All Sessions
          </button>
        </div>
      </div>
    );
  }

  const { scores, moments, homework } = debriefData;
  const transcript = sessionData?.transcript;

  return (
    <div className="min-h-screen bg-[#09090b]">
      <NavBar />
      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="animate-slide-up">
            <h1 className="text-xl font-semibold text-zinc-100 mb-1">Session Debrief</h1>
            <p className="text-sm text-zinc-500">Your personalized feedback and areas to improve</p>
          </div>

          {/* Score Cards */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 animate-slide-up-1">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-8">Performance Scores</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <ScoreRing score={scores.openers} label="Openers" />
              <ScoreRing score={scores.questionQuality} label="Question Quality" />
              <ScoreRing score={scores.responseRelevance} label="Relevance" />
              <ScoreRing score={scores.closing} label="Closing" />
            </div>
          </div>

          {/* Improvable Moments */}
          {moments.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-slide-up-2">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-100">Improvable Moments</h2>
              </div>
              <div className="divide-y divide-zinc-800">
                {moments.map((moment, index) => (
                  <div key={index}>
                    <button onClick={() => toggleMoment(index)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/40 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-sm text-zinc-300">Turn {moment.turnIndex + 1}</span>
                      </div>
                      <svg className={`w-4 h-4 text-zinc-600 transition-transform ${expandedMoments.has(index) ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedMoments.has(index) && (
                      <div className="px-6 pb-5 space-y-3 animate-fade-in">
                        <div>
                          <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-2">Your Response</p>
                          <div className="px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-lg text-sm text-zinc-300 leading-relaxed">
                            {moment.userText}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-2">Suggested Alternative</p>
                          <div className="px-4 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg text-sm text-zinc-300 leading-relaxed">
                            {moment.suggestion}
                          </div>
                        </div>
                        {transcript?.turns[moment.turnIndex] && (
                          <div>
                            <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-2">Context</p>
                            <div className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg space-y-2">
                              {moment.turnIndex > 0 && transcript.turns[moment.turnIndex - 1] && (
                                <div className="text-sm">
                                  <span className="text-zinc-500 font-medium">
                                    {transcript.turns[moment.turnIndex - 1].speaker === 'user' ? 'You' : 'Persona'}:{' '}
                                  </span>
                                  <span className="text-zinc-400">{transcript.turns[moment.turnIndex - 1].text}</span>
                                </div>
                              )}
                              <div className="text-sm">
                                <span className="text-zinc-500 font-medium">
                                  {transcript.turns[moment.turnIndex].speaker === 'user' ? 'You' : 'Persona'}:{' '}
                                </span>
                                <span className="text-zinc-400">{transcript.turns[moment.turnIndex].text}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Homework */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-slide-up-3">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">Homework</h2>
              <p className="text-xs text-zinc-500">Complete these before your next session</p>
            </div>
            <ol className="space-y-3">
              {homework.map((drill, index) => (
                <li key={index} className="flex items-start gap-3">
                  <button
                    onClick={() => toggleHomework(index)}
                    className={`mt-0.5 w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      completedHomework.has(index)
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-zinc-700 hover:border-zinc-500 bg-transparent'
                    }`}
                  >
                    {completedHomework.has(index) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="w-5 h-5 bg-zinc-800 text-zinc-500 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className={`text-sm leading-relaxed transition-colors ${completedHomework.has(index) ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                      {drill}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Transcript */}
          {transcript && transcript.turns.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-slide-up-4">
              <button onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/40 transition-colors">
                <span className="text-sm font-semibold text-zinc-100">Full Transcript</span>
                <svg className={`w-4 h-4 text-zinc-600 transition-transform ${isTranscriptExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isTranscriptExpanded && (
                <div className="px-6 pb-5 space-y-2 animate-fade-in border-t border-zinc-800 pt-4">
                  {transcript.turns.map((turn, index) => (
                    <div key={index} className={`px-4 py-3 rounded-lg text-sm ${
                      turn.speaker === 'user'
                        ? 'bg-violet-500/8 border border-violet-500/15 ml-8'
                        : 'bg-zinc-800 border border-zinc-700 mr-8'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-zinc-500">
                          {turn.speaker === 'user' ? 'You' : 'Persona'}
                        </span>
                        <span className="text-xs text-zinc-700">{new Date(turn.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{turn.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-slide-up-5">
            <button onClick={handleRetry} disabled={isRetrying}
              className="bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
              {isRetrying ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Starting...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Retry Same Persona</>
              )}
            </button>
            <button onClick={() => router.push(`/prep/${sessionData?.context_id}`)}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 py-3 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Different Person
            </button>
            <button onClick={() => router.push('/history')}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 py-3 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              All Sessions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
