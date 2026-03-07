'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TalkingPointsCard, PersonCard } from '@/src/types';

/**
 * /prep/[contextId] page - Displays prep materials
 * 
 * Requirements: 1.1, 2.4, 9.4, 9.5
 * 
 * Shows:
 * - Talking Points Card with openers, follow-up questions, and lessons
 * - Person Cards for each identified participant
 * - Degraded mode banner when applicable
 */

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your prep materials...</p>
        </div>
      </div>
    );
  }

  if (error || !contextData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700">{error || 'Context not found'}</p>
        </div>
      </div>
    );
  }

  const { talkingPointsCard, personCards } = contextData;
  const isDegradedMode = talkingPointsCard?.degradedMode || false;

  // Handle starting a practice session
  const handleStartSession = async (personCardId: string, sessionType: 'voice' | 'video') => {
    setStartingSessionId(personCardId);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextId,
          personCardId,
          sessionType,
        }),
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Prep Materials
          </h1>
          <p className="text-gray-600">
            {contextData.eventType} • {contextData.industry}
          </p>
        </div>

        {/* Degraded Mode Banner */}
        {isDegradedMode && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Degraded Mode
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Personalized intel unavailable — prep generated from your
                  inputs only
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Talking Points Card */}
        {talkingPointsCard && (
          <div className="bg-white shadow rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Talking Points
            </h2>

            {/* Openers */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Openers
              </h3>
              <ul className="space-y-2">
                {talkingPointsCard.openers.map((opener, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{opener}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Follow-up Questions */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Follow-up Questions
              </h3>
              <ul className="space-y-2">
                {talkingPointsCard.followUpQuestions.map((question, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{question}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Lessons */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Key Lessons
              </h3>
              <ul className="space-y-2">
                {talkingPointsCard.lessons.map((lesson, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{lesson}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Person Cards */}
        {personCards.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">
              People to Meet
            </h2>

            {personCards.map((personCardData) => (
              <div
                key={personCardData.id}
                className="bg-white shadow rounded-lg p-8"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    {personCardData.participantName}
                  </h3>
                  {personCardData.limitedResearch && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Limited Research
                    </span>
                  )}
                </div>

                {/* Profile Summary */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Profile
                  </h4>
                  <p className="text-gray-700">
                    {personCardData.card.profileSummary}
                  </p>
                </div>

                {/* Icebreakers */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Icebreakers
                  </h4>
                  <ul className="space-y-2">
                    {personCardData.card.icebreakers.map((icebreaker, index) => (
                      <li key={index} className="flex items-start">
                        <span className="flex-shrink-0 text-blue-600 mr-2">
                          •
                        </span>
                        <span className="text-gray-700">{icebreaker}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Topics of Interest */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Topics of Interest
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {personCardData.card.topicsOfInterest.map((topic, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Things to Avoid */}
                {personCardData.card.thingsToAvoid.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Things to Avoid
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {personCardData.card.thingsToAvoid.map((thing, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-50 text-red-700"
                        >
                          {thing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Ask */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Suggested Ask
                  </h4>
                  <p className="text-gray-700 italic">
                    "{personCardData.card.suggestedAsk}"
                  </p>
                </div>

                {/* Practice Session Buttons */}
                <div className="pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Start Practice Session
                  </h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleStartSession(personCardData.id, 'voice')}
                      disabled={startingSessionId === personCardData.id}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {startingSessionId === personCardData.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                            />
                          </svg>
                          Voice Practice
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleStartSession(personCardData.id, 'video')}
                      disabled={startingSessionId === personCardData.id}
                      className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {startingSessionId === personCardData.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Video Practice
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Person Cards Message */}
        {personCards.length === 0 && (
          <div className="bg-white shadow rounded-lg p-8">
            <p className="text-gray-600 text-center">
              No specific people identified. Use the Talking Points above to
              guide your conversations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
