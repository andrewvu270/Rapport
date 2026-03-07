'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DebriefScores } from '@/src/types';

/**
 * /history page - Session history and progress dashboard
 * 
 * Requirements: 7.4, 8.1, 8.3, 10.8
 * 
 * Components:
 * 1. Session list: Cards showing persona name, date, session type badge, overall score
 * 2. Retry sessions: Indented under parent with "Attempt #N" label
 * 3. Progress dashboard: Line chart showing score trends, bar chart for dimension averages
 * 4. Empty state: Friendly message with CTA to start first practice session
 */

interface SessionCard {
  id: string;
  participantName: string;
  sessionType: 'voice' | 'video';
  status: string;
  created_at: string;
  ended_at: string | null;
  retries: SessionCard[];
  overallScore?: number;
}

interface ProgressData {
  averageScores: DebriefScores;
  sessionCount: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch sessions
        const sessionsResponse = await fetch('/api/history');
        if (!sessionsResponse.ok) {
          throw new Error('Failed to fetch sessions');
        }
        const sessionsData = await sessionsResponse.json();

        // Fetch debriefs for each session to get scores
        const sessionsWithScores = await Promise.all(
          sessionsData.sessions.map(async (session: SessionCard) => {
            const debriefResponse = await fetch(`/api/debrief/${session.id}`);
            if (debriefResponse.ok) {
              const debriefData = await debriefResponse.json();
              if (debriefData.report && !debriefData.pending) {
                const scores = debriefData.report.scores;
                const overallScore = Math.round(
                  (scores.openers + scores.questionQuality + scores.responseRelevance + scores.closing) / 4
                );
                return { ...session, overallScore };
              }
            }
            return session;
          })
        );

        setSessions(sessionsWithScores);

        // Fetch progress data
        const progressResponse = await fetch('/api/history/progress');
        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          setProgress(progressData);
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getScoreColor = (score: number): string => {
    if (score < 4) return 'text-red-600';
    if (score <= 6) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score < 4) return 'bg-red-100';
    if (score <= 6) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderSessionCard = (session: SessionCard, attemptNumber?: number) => {
    const isRetry = attemptNumber !== undefined;

    return (
      <div
        key={session.id}
        className={`bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer ${
          isRetry ? 'ml-8 border-l-4 border-blue-300' : ''
        }`}
        onClick={() => router.push(`/debrief/${session.id}`)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {session.participantName}
              </h3>
              <span
                className={`ml-3 px-2 py-1 text-xs font-medium rounded ${
                  session.sessionType === 'voice'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {session.sessionType === 'voice' ? '🎤 Voice' : '📹 Video'}
              </span>
              {isRetry && (
                <span className="ml-2 px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                  Attempt #{attemptNumber}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {formatDate(session.created_at)}
            </p>
          </div>
          {session.overallScore !== undefined && (
            <div
              className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${getScoreBgColor(
                session.overallScore
              )}`}
            >
              <span className={`text-2xl font-bold ${getScoreColor(session.overallScore)}`}>
                {session.overallScore}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8 animate-pulse"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white shadow rounded-lg p-6 h-24 animate-pulse"></div>
              ))}
            </div>
            <div className="bg-white shadow rounded-lg p-6 h-64 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Session History</h1>
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <svg
              className="mx-auto h-24 w-24 text-gray-400 mb-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              No practice sessions yet
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start your first practice session to build confidence and improve your networking skills.
              Your session history and progress will appear here.
            </p>
            <button
              onClick={() => router.push('/prep')}
              className="bg-blue-600 text-white py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Start First Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Session History</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Session List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Sessions</h2>
            {sessions.map((session) => (
              <div key={session.id}>
                {renderSessionCard(session)}
                {session.retries && session.retries.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {session.retries.map((retry, index) =>
                      renderSessionCard(retry, index + 2)
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Progress Dashboard */}
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Progress Dashboard
              </h2>

              {progress && progress.sessionCount > 0 ? (
                <>
                  <p className="text-sm text-gray-600 mb-6">
                    Average scores for current billing period ({progress.sessionCount}{' '}
                    {progress.sessionCount === 1 ? 'session' : 'sessions'})
                  </p>

                  {/* Bar Chart */}
                  <div className="space-y-4">
                    {[
                      { key: 'openers', label: 'Openers', score: progress.averageScores.openers },
                      {
                        key: 'questionQuality',
                        label: 'Question Quality',
                        score: progress.averageScores.questionQuality,
                      },
                      {
                        key: 'responseRelevance',
                        label: 'Response Relevance',
                        score: progress.averageScores.responseRelevance,
                      },
                      { key: 'closing', label: 'Closing', score: progress.averageScores.closing },
                    ].map(({ key, label, score }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{label}</span>
                          <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                            {score.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              score < 4
                                ? 'bg-red-500'
                                : score <= 6
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${(score / 10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Overall Average */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-gray-900">Overall Average</span>
                      <span
                        className={`text-2xl font-bold ${getScoreColor(
                          (progress.averageScores.openers +
                            progress.averageScores.questionQuality +
                            progress.averageScores.responseRelevance +
                            progress.averageScores.closing) /
                            4
                        )}`}
                      >
                        {(
                          (progress.averageScores.openers +
                            progress.averageScores.questionQuality +
                            progress.averageScores.responseRelevance +
                            progress.averageScores.closing) /
                          4
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Complete more sessions to see your progress trends
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/prep')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  New Practice Session
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
