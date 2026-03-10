'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PersonCard } from '@/src/types';

/**
 * /session/[sessionId] page - Active practice session
 * 
 * Requirements: 4.1, 5.2, 10.8
 * 
 * UX Flow:
 * 1. Pre-session: Disclaimer + Person Card summary + Start button
 * 2. Connecting: Loading spinner with status messages
 * 3. Timeout error: Error message with retry/fallback options
 * 4. Active: Voice controls or video iframe with elapsed time
 * 5. Post-session: Completion message with auto-redirect
 */

type SessionStatus = 'reserved' | 'preparing' | 'active' | 'completed' | 'interrupted';
type TavusPersonaStatus = 'creating' | 'ready' | 'failed' | null;

interface SessionData {
  id: string;
  status: SessionStatus;
  session_type: 'voice' | 'video';
  person_card_id: string;
  context_id: string;
  tavus_persona_status: TavusPersonaStatus;
  tavus_conversation_id?: string;
  started_at?: string;
}

interface PersonCardData {
  id: string;
  participantName: string;
  card: PersonCard;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  // Session state
  const [session, setSession] = useState<SessionData | null>(null);
  const [personCard, setPersonCard] = useState<PersonCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-session state
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Active session state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  // Timeout tracking
  const [preparingStartTime, setPreparingStartTime] = useState<number | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch session');
        }

        const data = await response.json();
        setSession(data);

        // Fetch person card
        const personCardResponse = await fetch(`/api/context/${data.context_id}`);
        if (personCardResponse.ok) {
          const contextData = await personCardResponse.json();
          const card = contextData.personCards.find(
            (pc: PersonCardData) => pc.id === data.person_card_id
          );
          if (card) {
            setPersonCard(card);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  // Poll for completion while video session is active (webhook sets status to 'completed')
  useEffect(() => {
    if (session?.status === 'active' && session.session_type === 'video') {
      const pollCompletion = async () => {
        try {
          const response = await fetch(`/api/session/${sessionId}/status`);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'completed' || data.status === 'interrupted') {
              setSession(prev => prev ? { ...prev, status: data.status } : null);
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          }
        } catch (err) {
          console.error('Error polling session completion:', err);
        }
      };

      pollingRef.current = setInterval(pollCompletion, 3000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [session?.status, session?.session_type, sessionId]);

  // Poll for status when preparing (video sessions)
  useEffect(() => {
    if (session?.status === 'preparing' && session.session_type === 'video') {
      if (!preparingStartTime) {
        setPreparingStartTime(Date.now());
      }

      const pollStatus = async () => {
        try {
          const response = await fetch(`/api/session/${sessionId}/status`);
          if (response.ok) {
            const data = await response.json();
            
            // Check for timeout (60 seconds)
            if (preparingStartTime && Date.now() - preparingStartTime > 60000) {
              setHasTimedOut(true);
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              return;
            }

            // Update session status
            setSession(prev => prev ? { ...prev, ...data } : null);

            // If persona is ready, start the video session
            if (data.tavusPersonaStatus === 'ready' && data.status === 'preparing') {
              // Call endpoint to start video session
              const startResponse = await fetch(`/api/session/${sessionId}/start-video`, {
                method: 'POST',
              });
              
              if (startResponse.ok) {
                const startData = await startResponse.json();
                setSessionUrl(startData.sessionUrl);
                setSession(prev => prev ? { ...prev, status: 'active' } : null);
              }
            }

            // If persona failed, show error
            if (data.tavusPersonaStatus === 'failed') {
              setError('Failed to create video avatar. Please try again.');
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      };

      // Poll every 2 seconds
      pollingRef.current = setInterval(pollStatus, 2000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [session?.status, session?.session_type, sessionId, preparingStartTime]);

  // Start elapsed time counter when session becomes active
  useEffect(() => {
    if (session?.status === 'active' && session.started_at) {
      const startTime = new Date(session.started_at).getTime();
      
      const updateElapsed = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedSeconds(elapsed);
      };

      // Update immediately
      updateElapsed();

      // Update every second
      timerRef.current = setInterval(updateElapsed, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [session?.status, session?.started_at]);

  // Auto-redirect after session completion
  useEffect(() => {
    if (session?.status === 'completed') {
      const timeout = setTimeout(() => {
        router.push(`/debrief/${sessionId}`);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [session?.status, sessionId, router]);

  // Format elapsed time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle start practice
  const handleStartPractice = async () => {
    if (!disclaimerAccepted) return;

    setIsStarting(true);
    try {
      const response = await fetch(`/api/session/${sessionId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start session');
      }

      const data = await response.json();

      // Update session status
      setSession(prev => prev ? { ...prev, status: data.status } : null);

      // For video sessions the conversation URL comes back immediately
      if (data.sessionUrl) {
        setSessionUrl(data.sessionUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  // Handle end session
  const handleEndSession = async () => {
    if (isEnding) return;

    setIsEnding(true);
    try {
      const response = await fetch(`/api/session/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: elapsedSeconds,
          transcript: {
            turns: [],
            durationSeconds: elapsedSeconds,
            sessionId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      setSession(prev => prev ? { ...prev, status: 'completed' } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session');
    } finally {
      setIsEnding(false);
    }
  };

  // Handle retry (for timeout)
  const handleRetry = () => {
    setHasTimedOut(false);
    setPreparingStartTime(Date.now());
    // Restart polling
    if (session?.status === 'preparing') {
      window.location.reload();
    }
  };

  // Handle fallback to voice
  const handleFallbackToVoice = async () => {
    try {
      // Create a new voice session with the same person card
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextId: session?.context_id,
          personCardId: session?.person_card_id,
          sessionType: 'voice',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/session/${data.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create voice session');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session || !personCard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error || 'Session not found'}</p>
          <button
            onClick={() => router.push('/prep')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Prep
          </button>
        </div>
      </div>
    );
  }

  // Timeout error state
  if (hasTimedOut) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">Timeout</h2>
          <p className="text-gray-700 mb-6">
            Video avatar preparation is taking longer than expected. Please try again or switch to voice mode.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry Video Session
            </button>
            <button
              onClick={handleFallbackToVoice}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Switch to Voice Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Post-session state
  if (session.status === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <svg
              className="h-16 w-16 text-green-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Session Complete
          </h2>
          <p className="text-gray-600 mb-4">
            Redirecting to your debrief...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Pre-session state
  if (session.status === 'reserved') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Persona Simulation Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-yellow-900 mb-3">
              Persona Simulation Disclaimer
            </h2>
            <p className="text-sm text-yellow-800 mb-4">
              This AI persona is a simulated practice partner for skill development, 
              not an impersonation of a real individual. The system does not claim to 
              represent the actual views or behavior of any named person. This tool is 
              intended for practicing conversations with professional contacts such as 
              recruiters, hiring managers, and industry peers.
            </p>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-yellow-900">
                I understand and agree to these terms
              </span>
            </label>
          </div>

          {/* Person Card Summary */}
          <div className="bg-white shadow rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Practice Session
            </h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {personCard.participantName}
              </h3>
              <p className="text-gray-600 mb-4">
                {personCard.card.profileSummary}
              </p>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="font-medium">Session Type:</span>
                  <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {session.session_type === 'voice' ? 'Voice' : 'Video'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Quick Tips
              </h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {personCard.card.icebreakers.slice(0, 2).map((tip, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartPractice}
            disabled={!disclaimerAccepted || isStarting}
            className={`w-full py-4 px-6 rounded-lg text-lg font-semibold transition-colors ${
              disclaimerAccepted && !isStarting
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isStarting ? 'Starting...' : 'Start Practice'}
          </button>
        </div>
      </div>
    );
  }

  // Connecting state
  if (session.status === 'preparing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Connecting to {personCard.participantName}...
          </h2>
          {session.session_type === 'video' && (
            <p className="text-gray-600">
              Preparing video avatar...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Active session state — video
  if (session.status === 'active' && session.session_type === 'video') {
    return (
      <div className="fixed inset-0 bg-black">
        {sessionUrl ? (
          <iframe
            src={sessionUrl}
            className="w-full h-full"
            allow="camera; microphone; fullscreen"
            title="Video Session"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white">Loading video session...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active session state — voice
  if (session.status === 'active' && session.session_type === 'voice') {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">{personCard.participantName}</h1>
              <p className="text-sm text-gray-400">Voice Session</p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-white">{formatTime(elapsedSeconds)}</div>
                <div className="text-xs text-gray-400">Elapsed</div>
              </div>
              <button
                onClick={handleEndSession}
                disabled={isEnding}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isEnding ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="mb-8">
              <div className="w-32 h-32 bg-blue-600 rounded-full mx-auto flex items-center justify-center">
                <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Voice Session Active</h2>
            <p className="text-gray-400">Speak naturally with {personCard.participantName}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
