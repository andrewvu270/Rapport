'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/src/components/NavBar';

interface PersonCardSummary {
  id: string;
  participantName: string;
  limitedResearch: boolean;
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

  useEffect(() => {
    fetch('/api/context')
      .then((r) => r.json())
      .then((data) => { setContexts(data.contexts || []); setIsLoading(false); })
      .catch((err) => { setError(err.message); setIsLoading(false); });
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <NavBar />
        <div className="py-10 px-4 sm:px-6 max-w-3xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
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
      <div className="min-h-screen bg-[#09090b]">
        <NavBar />
        <div className="py-12 px-4 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={() => location.reload()} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (contexts.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <NavBar />
        <div className="py-32 px-4 flex flex-col items-center text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl mb-6">
            🤝
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">No prep sessions yet</h2>
          <p className="text-sm text-zinc-500 mb-8 max-w-xs leading-relaxed">
            Start by telling us about your next networking event. We'll build person cards and talking points.
          </p>
          <button
            onClick={() => router.push('/prep')}
            className="bg-violet-500 hover:bg-violet-600 text-white py-2.5 px-6 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]"
          >
            + New Prep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      <NavBar />
      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8 animate-slide-up">
            <h1 className="text-xl font-semibold text-zinc-100">Prep Library</h1>
            <button
              onClick={() => router.push('/prep')}
              className="text-sm bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg font-medium transition-colors active:scale-[0.98]"
            >
              + New Prep
            </button>
          </div>

          <div className="space-y-3">
            {contexts.map((ctx, i) => (
              <div
                key={ctx.id}
                className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-slide-up-${Math.min(i + 1, 7)}`}
              >
                {/* Context header */}
                <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-zinc-100 truncate">
                      {ctx.eventType || 'Networking Event'}
                      {ctx.industry && <span className="text-zinc-500 font-normal"> · {ctx.industry}</span>}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{ctx.userRole} · {ctx.userGoal}</p>
                    <p className="text-xs text-zinc-700 mt-1">Prepped {formatDate(ctx.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/prep/${ctx.id}`)}
                    className="shrink-0 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors whitespace-nowrap"
                  >
                    View prep →
                  </button>
                </div>

                {/* Person cards */}
                {ctx.personCards.length === 0 ? (
                  <div className="px-5 py-3 text-xs text-zinc-600">No person cards generated.</div>
                ) : (
                  <div className="divide-y divide-zinc-800/60">
                    {ctx.personCards.map((pc) => (
                      <div key={pc.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-semibold shrink-0">
                            {pc.participantName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-200 truncate">{pc.participantName}</p>
                            <p className="text-xs text-zinc-600">
                              {pc.sessionCount === 0 ? 'No practice yet' : `${pc.sessionCount} session${pc.sessionCount > 1 ? 's' : ''}`}
                              {pc.limitedResearch ? ' · limited intel' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => router.push(`/prep/${ctx.id}`)}
                            className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-md px-3 py-1.5 transition-colors"
                          >
                            View card
                          </button>
                          <button
                            onClick={() => router.push(`/prep/${ctx.id}`)}
                            className="text-xs text-white bg-violet-500 hover:bg-violet-600 rounded-md px-3 py-1.5 font-medium transition-colors"
                          >
                            Practice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
