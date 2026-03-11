'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/src/components/NavBar';

interface DashboardData {
  totalSessions: number;
  sessionsThisWeek: number;
  totalSeconds: number;
  usage: {
    secondsUsed: number;
    secondsLimit: number;
    tier: string;
  };
  avgScores: {
    openers: number;
    questionQuality: number;
    responseRelevance: number;
    closing: number;
  } | null;
  recentDebriefs: {
    sessionId: string;
    scores: { openers: number; questionQuality: number; responseRelevance: number; closing: number };
    startedAt: string;
    sessionType: string;
    personName: string | null;
  }[];
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function avgScore(scores: DashboardData['avgScores']) {
  if (!scores) return 0;
  return Math.round((scores.openers + scores.questionQuality + scores.responseRelevance + scores.closing) / 4 * 10) / 10;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value < 4 ? 'bg-red-400' : value <= 6 ? 'bg-amber' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-ink-muted w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-ink/[0.06] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink w-6 text-right">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const usagePct = data ? Math.min((data.usage.secondsUsed / data.usage.secondsLimit) * 100, 100) : 0;
  const usageColor = usagePct >= 90 ? 'bg-red-400' : usagePct >= 70 ? 'bg-amber' : 'bg-ink';

  return (
    <div className="min-h-screen bg-cream">
      <NavBar />
      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Header */}
          <div className="animate-slide-up">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Dashboard</h1>
            <p className="text-sm text-ink-muted mt-0.5">Your practice overview</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 animate-slide-up-1">
            {[
              { label: 'Total Sessions', value: isLoading ? '—' : String(data?.totalSessions ?? 0) },
              { label: 'This Week', value: isLoading ? '—' : String(data?.sessionsThisWeek ?? 0) },
              { label: 'Practice Time', value: isLoading ? '—' : fmt(data?.totalSeconds ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-ink/[0.08] rounded-2xl p-5 shadow-[0_2px_0_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.05)]">
                <p className="text-2xl font-extrabold text-ink">{value}</p>
                <p className="text-xs text-ink-muted mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Usage */}
          <div className="bg-white border border-ink/[0.08] rounded-2xl p-5 shadow-[0_2px_0_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.05)] animate-slide-up-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink">Monthly Usage</p>
                <span className="text-xs bg-ink/[0.06] text-ink-muted px-2 py-0.5 rounded-full font-medium capitalize">
                  {isLoading ? '—' : data?.usage.tier ?? 'free'} tier
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                {isLoading ? '—' : fmt(data?.usage.secondsUsed ?? 0)} / {isLoading ? '—' : fmt(data?.usage.secondsLimit ?? 0)}
              </p>
            </div>
            <div className="h-2 bg-ink/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full ${usageColor} rounded-full transition-all duration-700`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {usagePct >= 90 && (
              <p className="text-xs text-red-500 mt-2 font-medium">Almost at your monthly limit</p>
            )}
          </div>

          {/* Avg scores */}
          {(isLoading || data?.avgScores) && (
            <div className="bg-white border border-ink/[0.08] rounded-2xl p-5 shadow-[0_2px_0_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.05)] animate-slide-up-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-ink">Avg Performance</p>
                {data?.avgScores && (
                  <span className="text-lg font-extrabold text-ink">{avgScore(data.avgScores)}<span className="text-xs font-medium text-ink-muted">/10</span></span>
                )}
              </div>
              {isLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-3 animate-shimmer rounded w-full" />)}
                </div>
              ) : data?.avgScores ? (
                <div className="space-y-3">
                  <ScoreBar label="Openers" value={data.avgScores.openers} />
                  <ScoreBar label="Question Quality" value={data.avgScores.questionQuality} />
                  <ScoreBar label="Relevance" value={data.avgScores.responseRelevance} />
                  <ScoreBar label="Closing" value={data.avgScores.closing} />
                </div>
              ) : null}
            </div>
          )}

          {/* Recent debriefs */}
          <div className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden shadow-[0_2px_0_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.05)] animate-slide-up-4">
            <div className="px-5 py-4 border-b border-ink/[0.06] flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Recent Sessions</p>
              <button onClick={() => router.push('/history')} className="text-xs text-ink-muted hover:text-ink transition-colors font-medium">
                View library →
              </button>
            </div>
            {isLoading ? (
              <div className="divide-y divide-ink/[0.04]">
                {[1,2,3].map(i => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    <div className="w-8 h-8 animate-shimmer rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 animate-shimmer rounded w-32" />
                      <div className="h-3 animate-shimmer rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data?.recentDebriefs.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-ink-muted">No sessions yet.</p>
                <button onClick={() => router.push('/prep')} className="mt-3 text-sm font-semibold text-ink hover:text-ink/70 transition-colors">
                  Start your first prep →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-ink/[0.04]">
                {data?.recentDebriefs.map((d) => {
                  const overall = Math.round((d.scores.openers + d.scores.questionQuality + d.scores.responseRelevance + d.scores.closing) / 4 * 10) / 10;
                  const scoreColor = overall < 4 ? 'text-red-500' : overall <= 6 ? 'text-amber-600' : 'text-emerald-600';
                  return (
                    <button
                      key={d.sessionId}
                      onClick={() => router.push(`/debrief/${d.sessionId}`)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-ink/[0.02] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-ink/[0.05] flex items-center justify-center shrink-0">
                        {d.sessionType === 'voice' ? (
                          <svg className="w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{d.personName ?? 'Practice Session'}</p>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {new Date(d.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-base font-extrabold shrink-0 ${scoreColor}`}>{overall}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
