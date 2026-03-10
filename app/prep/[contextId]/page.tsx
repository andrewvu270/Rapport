'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TalkingPointsCard, PersonCard } from '@/src/types';
import NavBar from '@/src/components/NavBar';

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

const sectionLabel = "text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3";

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
      <div className="min-h-screen bg-[#09090b]">
        <NavBar />
        <div className="py-10 px-4 max-w-4xl mx-auto space-y-3">
          <div className="h-5 animate-shimmer rounded w-40 mb-6" />
          {[1,2,3].map(i => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="h-4 animate-shimmer rounded w-32 mb-4" />
              <div className="space-y-2">
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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full">
          <h2 className="text-base font-semibold text-red-400 mb-3">Error</h2>
          <p className="text-sm text-zinc-400">{error || 'Context not found'}</p>
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
    <div className="min-h-screen bg-[#09090b]">
      <NavBar />
      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="animate-slide-up">
            <h1 className="text-xl font-semibold text-zinc-100 mb-1">Your Prep Materials</h1>
            <p className="text-sm text-zinc-500">
              {contextData.eventType}{contextData.industry ? ` · ${contextData.industry}` : ''}
            </p>
          </div>

          {/* Degraded Mode Banner */}
          {isDegradedMode && (
            <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 animate-fade-in">
              <span className="text-amber-400 mt-0.5 text-sm">⚠</span>
              <div>
                <p className="text-sm font-medium text-amber-300">Degraded Mode</p>
                <p className="text-xs text-amber-500/80 mt-0.5">Personalized intel unavailable — prep generated from your inputs only</p>
              </div>
            </div>
          )}

          {/* Key Lessons */}
          {talkingPointsCard && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-slide-up-1">
              <h2 className={sectionLabel}>Key Lessons</h2>
              <ul className="space-y-3">
                {talkingPointsCard.lessons.map((lesson, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-sm text-zinc-300 leading-relaxed">{lesson}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Person Cards */}
          {personCards.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100 animate-slide-up-2">People to Meet</h2>

              {personCards.map((personCardData, cardIdx) => (
                <div
                  key={personCardData.id}
                  className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-slide-up-${Math.min(cardIdx + 3, 7)}`}
                >
                  {/* Card Header */}
                  <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-400 text-sm font-semibold shrink-0">
                        {personCardData.participantName.charAt(0)}
                      </div>
                      <h3 className="text-base font-semibold text-zinc-100">
                        {personCardData.participantName}
                      </h3>
                    </div>
                    {personCardData.limitedResearch && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500">
                        Limited intel
                      </span>
                    )}
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Profile */}
                    <div>
                      <h4 className={sectionLabel}>Profile</h4>
                      <p className="text-sm text-zinc-300 leading-relaxed">{personCardData.card.profileSummary}</p>
                    </div>

                    {/* Icebreakers */}
                    <div>
                      <h4 className={sectionLabel}>Icebreakers</h4>
                      <ul className="space-y-2">
                        {personCardData.card.icebreakers.map((icebreaker, index) => (
                          <li key={index} className="flex items-start gap-2.5">
                            <span className="text-violet-400 mt-1 text-xs shrink-0">◆</span>
                            <span className="text-sm text-zinc-300 leading-relaxed">{icebreaker}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Openers */}
                    {personCardData.card.openers?.length > 0 && (
                      <div>
                        <h4 className={sectionLabel}>Openers</h4>
                        <ul className="space-y-2.5">
                          {personCardData.card.openers.map((opener, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <span className="w-5 h-5 bg-violet-500/15 border border-violet-500/25 text-violet-400 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                                {index + 1}
                              </span>
                              <span className="text-sm text-zinc-300 leading-relaxed">{opener}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Follow-up Questions */}
                    {personCardData.card.followUpQuestions?.length > 0 && (
                      <div>
                        <h4 className={sectionLabel}>Follow-up Questions</h4>
                        <ul className="space-y-2.5">
                          {personCardData.card.followUpQuestions.map((question, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <span className="w-5 h-5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                                {index + 1}
                              </span>
                              <span className="text-sm text-zinc-300 leading-relaxed">{question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Topics + Avoid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className={sectionLabel}>Topics of Interest</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {personCardData.card.topicsOfInterest.map((topic, index) => (
                            <span key={index} className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                      {personCardData.card.thingsToAvoid.length > 0 && (
                        <div>
                          <h4 className={sectionLabel}>Things to Avoid</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {personCardData.card.thingsToAvoid.map((thing, index) => (
                              <span key={index} className="text-xs px-2.5 py-1 rounded-full bg-red-500/8 border border-red-500/20 text-red-400">
                                {thing}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Suggested Ask */}
                    <div>
                      <h4 className={sectionLabel}>Suggested Ask</h4>
                      <p className="text-sm text-zinc-400 italic px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                        "{personCardData.card.suggestedAsk}"
                      </p>
                    </div>

                    {/* Practice Buttons */}
                    <div className="pt-2 border-t border-zinc-800">
                      <p className={sectionLabel + ' mb-3'}>Practice Session</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleStartSession(personCardData.id, 'voice')}
                          disabled={startingSessionId !== null}
                          className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-100 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          {startingSessionId === personCardData.id + 'voice' ? (
                            <><div className="w-4 h-4 border-2 border-zinc-400/30 border-t-zinc-300 rounded-full animate-spin" />Starting...</>
                          ) : (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>Voice Practice</>
                          )}
                        </button>
                        <button
                          onClick={() => handleStartSession(personCardData.id, 'video')}
                          disabled={startingSessionId !== null}
                          className="flex-1 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          {startingSessionId === personCardData.id + 'video' ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Starting...</>
                          ) : (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Video Practice</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {personCards.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center animate-fade-in">
              <p className="text-sm text-zinc-500">No specific people identified. Use the Key Lessons above to guide your conversations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
