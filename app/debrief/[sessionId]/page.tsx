'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DebriefReport, Transcript } from '@/src/types';

/**
 * /debrief/[sessionId] page - Post-session feedback report
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1
 * 
 * Components:
 * 1. Score visualization: Four radial/gauge charts (1-10 scale, color-coded)
 * 2. Improvable moments: Expandable cards with original response, suggestion, and context
 * 3. Homework: Numbered list with checkboxes (localStorage persistence)
 * 4. Transcript viewer: Collapsible section with full conversation
 * 5. Action buttons: Retry, practice with different person, view all sessions
 * 6. Loading state: Skeleton UI while polling
 */

interface DebriefResponse {
  pending: boolean;
  report?: DebriefReport;
}

interface SessionData {
  id: string;
  transcript: Transcript;
  person_card_id: string;
  context_id: string;
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

  // Homework tracking (in-memory for now, localStorage in production)
  const [completedHomework, setCompletedHomework] = useState<Set<number>>(new Set());

  // Expandable sections state
  const [expandedMoments, setExpandedMoments] = useState<Set<number>>(new Set());
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);

  // Action button loading states
  const [isRetrying, setIsRetrying] = useState(false);

  // Poll for debrief report
  useEffect(() => {
    const fetchDebrief = async () => {
      try {
        const response = await fetch(`/api/debrief/${sessionId}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch debrief');
        }

        const data: DebriefResponse = await response.json();

        if (data.pending) {
          setIsPending(true);
          // Continue polling
        } else if (data.report) {
          setDebriefData(data.report);
          setIsPending(false);
          setIsLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchDebrief();

    // Poll every 3 seconds while pending
    const pollInterval = setInterval(() => {
      if (isPending) {
        fetchDebrief();
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [sessionId, isPending]);

  // Fetch session data for transcript
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }

        const data = await response.json();
        setSessionData(data);
      } catch (err) {
        console.error('Error fetching session:', err);
      }
    };

    fetchSession();
  }, [sessionId]);

  // Load completed homework from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`homework-${sessionId}`);
      if (stored) {
        setCompletedHomework(new Set(JSON.parse(stored)));
      }
    }
  }, [sessionId]);

  // Save completed homework to localStorage
  const toggleHomework = (index: number) => {
    const newCompleted = new Set(completedHomework);
    if (newCompleted.has(index)) {
      newCompleted.delete(index);
    } else {
      newCompleted.add(index);
    }
    setCompletedHomework(newCompleted);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`homework-${sessionId}`, JSON.stringify(Array.from(newCompleted)));
    }
  };

  // Toggle moment expansion
  const toggleMoment = (index: number) => {
    const newExpanded = new Set(expandedMoments);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMoments(newExpanded);
  };

  // Handle retry with same persona
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/session/${sessionId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to retry session');
      }

      const data = await response.json();
      router.push(`/session/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry session');
    } finally {
      setIsRetrying(false);
    }
  };

  // Get color for score
  const getScoreColor = (score: number): string => {
    if (score < 4) return 'text-red-600';
    if (score <= 6) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Loading state
  if (isLoading || isPending) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          </div>

          {/* Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-blue-800 font-medium">
                Generating your feedback...
              </p>
            </div>
          </div>

          {/* Score Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white shadow rounded-lg p-6">
                <div className="h-32 bg-gray-200 rounded-full w-32 mx-auto mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !debriefData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error || 'Debrief not found'}</p>
          <button
            onClick={() => router.push('/history')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View All Sessions
          </button>
        </div>
      </div>
    );
  }

  const { scores, moments, homework } = debriefData;
  const transcript = sessionData?.transcript;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Session Debrief
          </h1>
          <p className="text-gray-600">
            Here's your personalized feedback and areas for improvement
          </p>
        </div>

        {/* Score Visualization */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { key: 'openers', label: 'Openers', score: scores.openers },
            { key: 'questionQuality', label: 'Question Quality', score: scores.questionQuality },
            { key: 'responseRelevance', label: 'Response Relevance', score: scores.responseRelevance },
            { key: 'closing', label: 'Closing', score: scores.closing },
          ].map(({ key, label, score }) => (
            <div key={key} className="bg-white shadow rounded-lg p-6">
              {/* Radial Gauge */}
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={score < 4 ? '#dc2626' : score <= 6 ? '#ca8a04' : '#16a34a'}
                    strokeWidth="8"
                    strokeDasharray={`${(score / 10) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Score text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
                    {score}
                  </span>
                </div>
              </div>
              <h3 className="text-center text-sm font-semibold text-gray-700">
                {label}
              </h3>
            </div>
          ))}
        </div>

        {/* Improvable Moments Section */}
        {moments.length > 0 && (
          <div className="bg-white shadow rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Improvable Moments
            </h2>
            <div className="space-y-4">
              {moments.map((moment, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Header */}
                  <button
                    onClick={() => toggleMoment(index)}
                    className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                        {index + 1}
                      </span>
                      <span className="text-left font-medium text-gray-900">
                        Turn {moment.turnIndex + 1}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        expandedMoments.has(index) ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Content */}
                  {expandedMoments.has(index) && (
                    <div className="px-6 py-4 space-y-4">
                      {/* Original Response */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                          Your Response
                        </h4>
                        <p className="text-gray-700 bg-red-50 border border-red-200 rounded p-3">
                          {moment.userText}
                        </p>
                      </div>

                      {/* Suggested Alternative */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                          Suggested Alternative
                        </h4>
                        <p className="text-gray-700 bg-green-50 border border-green-200 rounded p-3">
                          {moment.suggestion}
                        </p>
                      </div>

                      {/* Turn Context */}
                      {transcript && transcript.turns[moment.turnIndex] && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                            Context
                          </h4>
                          <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
                            {/* Show previous turn if exists */}
                            {moment.turnIndex > 0 && transcript.turns[moment.turnIndex - 1] && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-600">
                                  {transcript.turns[moment.turnIndex - 1].speaker === 'user' ? 'You' : 'Persona'}:
                                </span>
                                <span className="text-gray-700 ml-2">
                                  {transcript.turns[moment.turnIndex - 1].text}
                                </span>
                              </div>
                            )}
                            {/* Current turn */}
                            <div className="text-sm">
                              <span className="font-medium text-gray-600">
                                {transcript.turns[moment.turnIndex].speaker === 'user' ? 'You' : 'Persona'}:
                              </span>
                              <span className="text-gray-700 ml-2">
                                {transcript.turns[moment.turnIndex].text}
                              </span>
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

        {/* Homework Section */}
        <div className="bg-white shadow rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Homework
          </h2>
          <p className="text-gray-600 mb-6">
            Complete these drills before your next session to improve your skills
          </p>
          <ol className="space-y-4">
            {homework.map((drill, index) => (
              <li key={index} className="flex items-start">
                <div className="flex items-center h-6 mr-4">
                  <input
                    type="checkbox"
                    checked={completedHomework.has(index)}
                    onChange={() => toggleHomework(index)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full inline-flex items-center justify-center text-sm font-medium mr-3">
                    {index + 1}
                  </span>
                  <span className={`text-gray-700 ${completedHomework.has(index) ? 'line-through text-gray-400' : ''}`}>
                    {drill}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Transcript Viewer */}
        {transcript && transcript.turns.length > 0 && (
          <div className="bg-white shadow rounded-lg p-8 mb-8">
            <button
              onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h2 className="text-2xl font-bold text-gray-900">
                Full Transcript
              </h2>
              <svg
                className={`w-6 h-6 text-gray-500 transition-transform ${
                  isTranscriptExpanded ? 'transform rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isTranscriptExpanded && (
              <div className="space-y-4 mt-6">
                {transcript.turns.map((turn, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      turn.speaker === 'user'
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-gray-900">
                        {turn.speaker === 'user' ? 'You' : 'Persona'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(turn.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{turn.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isRetrying ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Starting...
              </>
            ) : (
              <>
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry with Same Persona
              </>
            )}
          </button>

          <button
            onClick={() => router.push(`/prep/${sessionData?.context_id}`)}
            className="bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Practice with Different Person
          </button>

          <button
            onClick={() => router.push('/history')}
            className="bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            View All Sessions
          </button>
        </div>
      </div>
    </div>
  );
}
