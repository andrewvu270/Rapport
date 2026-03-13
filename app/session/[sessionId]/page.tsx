'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PersonCard } from '@/src/types';
import NavBar from '@/src/components/NavBar';
import { avatarColor } from '@/src/lib/avatarColor';

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

/**
 * /session/[sessionId] page - Active practice session
 *
 * UX Flow:
 * 1. Pre-session: Disclaimer + Person Card summary + Start button
 * 2. Connecting: Loading spinner with status messages
 * 3. Timeout error: Error message with retry/fallback options
 * 4. Active: Voice controls (SDK) or video iframe with elapsed time
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

  const [session, setSession] = useState<SessionData | null>(null);
  const [personCard, setPersonCard] = useState<PersonCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [timeLimitReached, setTimeLimitReached] = useState(false);

  const [preparingStartTime, setPreparingStartTime] = useState<number | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Voice SDK state
  const [assistantConfig, setAssistantConfig] = useState<object | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const elapsedRef = useRef(0);
  const vapiRef = useRef<any>(null);

  // Video (Daily.co call object) state
  const [aiVideoTrack, setAiVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [aiAudioTrack, setAiAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [isAIVideoSpeaking, setIsAIVideoSpeaking] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const dailyRef = useRef<any>(null);
  const aiVideoRef = useRef<HTMLVideoElement>(null);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const isEndingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

        const personCardResponse = await fetch(`/api/context/${data.context_id}`);
        if (personCardResponse.ok) {
          const contextData = await personCardResponse.json();
          const card = contextData.personCards.find(
            (pc: PersonCardData) => pc.id === data.person_card_id
          );
          if (card) setPersonCard(card);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  // Initialize Vapi SDK for voice sessions
  useEffect(() => {
    if (session?.status !== 'active' || session.session_type !== 'voice' || !assistantConfig) return;

    let vapi: any;

    const initVapi = async () => {
      const VapiClass = (await import('@vapi-ai/web')).default;
      vapi = new VapiClass(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
      vapiRef.current = vapi;

      vapi.on('call-start', async () => {
        const callId = vapi.call?.id;
        if (callId) {
          await fetch(`/api/session/${sessionId}/call-id`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vapiCallId: callId }),
          }).catch(() => {});
        }
      });

      vapi.on('call-end', async () => {
        try {
          // Map role→speaker so the debrief LLM knows who said what
          const turns = transcriptRef.current.map(t => ({
            speaker: t.role === 'assistant' ? 'persona' : 'user',
            text: t.text,
            timestamp: new Date().toISOString(),
          }));
          await fetch(`/api/session/${sessionId}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: { turns, durationSeconds: elapsedRef.current, sessionId },
              durationSeconds: elapsedRef.current,
            }),
          });
        } catch (err) {
          console.error('Failed to save session:', err);
        }
        setSession(prev => prev ? { ...prev, status: 'completed' } : null);
      });

      vapi.on('speech-start', () => setIsAISpeaking(true));
      vapi.on('speech-end', () => setIsAISpeaking(false));

      vapi.on('volume-level', (level: number) => setVolumeLevel(level));

      vapi.on('message', (msg: any) => {
        if (msg.type === 'transcript' && msg.transcriptType === 'final') {
          setTranscript(prev => [...prev, { role: msg.role, text: msg.transcript }]);
        }
      });

      vapi.on('error', (err: any) => {
        console.error('Vapi error:', err);
        setError('Voice call error. Please try again.');
      });

      vapi.start(assistantConfig);
    };

    initVapi();

    return () => {
      if (vapi) vapi.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.session_type, assistantConfig]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { elapsedRef.current = elapsedSeconds; }, [elapsedSeconds]);

  // Attach AI video track to element
  useEffect(() => {
    if (aiVideoTrack && aiVideoRef.current) {
      aiVideoRef.current.srcObject = new MediaStream([aiVideoTrack]);
    }
  }, [aiVideoTrack]);

  // Attach local video track to element
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
    }
  }, [localVideoTrack]);

  // Attach AI audio track to <audio> element for playback
  useEffect(() => {
    if (aiAudioTrack && aiAudioRef.current) {
      aiAudioRef.current.srcObject = new MediaStream([aiAudioTrack]);
      aiAudioRef.current.play().catch(err => console.warn('[Audio] autoplay blocked:', err));
    }
  }, [aiAudioTrack]);

  // Initialize Daily.co call object for video sessions
  useEffect(() => {
    if (session?.status !== 'active' || session.session_type !== 'video' || !sessionUrl) return;

    let daily: any;
    const initDaily = async () => {
      const DailyIframe = (await import('@daily-co/daily-js')).default;
      daily = DailyIframe.createCallObject();
      dailyRef.current = daily;

      daily.on('participant-joined', (evt: any) => {
        const p = evt.participant;
        if (!p.local) {
          // AI joined — grab existing tracks
          const vt = p.tracks?.video?.persistentTrack;
          if (vt) setAiVideoTrack(vt);
          const at = p.tracks?.audio?.persistentTrack;
          if (at) setAiAudioTrack(at);
        }
      });

      daily.on('track-started', (evt: any) => {
        const { participant, track } = evt;
        if (!participant.local && track.kind === 'video') setAiVideoTrack(track);
        if (!participant.local && track.kind === 'audio') setAiAudioTrack(track);
        if (participant.local && track.kind === 'video') setLocalVideoTrack(track);
      });

      daily.on('track-stopped', (evt: any) => {
        const { participant, track } = evt;
        if (!participant.local && track.kind === 'video') setAiVideoTrack(null);
        if (!participant.local && track.kind === 'audio') setAiAudioTrack(null);
        if (participant.local && track.kind === 'video') setLocalVideoTrack(null);
      });

      daily.on('participant-updated', (evt: any) => {
        const p = evt.participant;
        if (!p.local) {
          // Detect AI speaking via audio activity
          setIsAIVideoSpeaking(!!p.audio);
        }
      });

      daily.on('left-meeting', () => {
        // no-op: end is always triggered explicitly via handleEndVideoSession
      });

      daily.on('error', (err: any) => {
        console.error('Daily error:', err);
      });

      // Trigger browser permission prompt, then immediately release the stream
      // so Daily can exclusively own the camera/mic without conflicts
      try {
        const permStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        permStream.getTracks().forEach(t => t.stop());
      } catch {
        try {
          const permStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          permStream.getTracks().forEach(t => t.stop());
        } catch { /* ignore */ }
      }

      await daily.join({ url: sessionUrl });
    };

    initDaily();

    return () => {
      if (daily) daily.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.session_type, sessionUrl]);

  // (postMessage listener no longer needed — Daily SDK handles left-meeting)
  useEffect(() => {
    if (session?.status !== 'active' || session.session_type !== 'video') return;
    // no-op: kept for future use
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.session_type]);

  useEffect(() => {
    if (session?.status === 'active' && session.session_type === 'video') {
      const pollCompletion = async () => {
        try {
          const response = await fetch(`/api/session/${sessionId}/status`);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'completed' || data.status === 'interrupted') {
              setSession(prev => prev ? { ...prev, status: data.status } : null);
              if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            }
          }
        } catch (err) { console.error('Error polling session completion:', err); }
      };
      pollingRef.current = setInterval(pollCompletion, 3000);
      return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    }
  }, [session?.status, session?.session_type, sessionId]);

  useEffect(() => {
    if (session?.status === 'preparing' && session.session_type === 'video') {
      if (!preparingStartTime) setPreparingStartTime(Date.now());

      const pollStatus = async () => {
        try {
          const response = await fetch(`/api/session/${sessionId}/status`);
          if (response.ok) {
            const data = await response.json();
            if (preparingStartTime && Date.now() - preparingStartTime > 60000) {
              setHasTimedOut(true);
              if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
              return;
            }
            setSession(prev => prev ? { ...prev, ...data } : null);
            if (data.tavusPersonaStatus === 'ready' && data.status === 'preparing') {
              const startResponse = await fetch(`/api/session/${sessionId}/start-video`, { method: 'POST' });
              if (startResponse.ok) {
                const startData = await startResponse.json();
                setSessionUrl(startData.sessionUrl);
                setSession(prev => prev ? { ...prev, status: 'active' } : null);
              }
            }
            if (data.tavusPersonaStatus === 'failed') {
              setError('Failed to create video avatar. Please try again.');
              if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            }
          }
        } catch (err) { console.error('Error polling status:', err); }
      };
      pollingRef.current = setInterval(pollStatus, 2000);
      return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    }
  }, [session?.status, session?.session_type, sessionId, preparingStartTime]);

  useEffect(() => {
    if (session?.status === 'active' && session.started_at) {
      const startTime = new Date(session.started_at).getTime();
      const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
      return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
    }
  }, [session?.status, session?.started_at]);

  const SESSION_LIMIT = 300; // 5 minutes

  useEffect(() => {
    if (session?.status !== 'active' || elapsedSeconds < SESSION_LIMIT) return;
    if (timeLimitReached) return;
    setTimeLimitReached(true);
    if (session.session_type === 'voice') {
      handleEndVoiceSession();
    } else {
      handleEndVideoSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds, session?.status, session?.session_type, timeLimitReached]);

  useEffect(() => {
    if (session?.status === 'completed') {
      const timeout = setTimeout(() => router.push(`/debrief/${sessionId}`), 2000);
      return () => clearTimeout(timeout);
    }
  }, [session?.status, sessionId, router]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartPractice = async () => {
    if (!disclaimerAccepted) return;
    // Unlock AudioContext synchronously inside the click handler.
    // This MUST happen before any await — the browser only counts it as a
    // user-gesture activation if it runs in the same synchronous turn.
    try { new (window.AudioContext || (window as any).webkitAudioContext)().resume(); } catch { /* ignore */ }
    setIsStarting(true);
    try {
      const response = await fetch(`/api/session/${sessionId}/start`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start session');
      }
      const data = await response.json();
      setSession(prev => prev ? { ...prev, status: data.status } : null);
      if (data.assistantConfig) {
        setAssistantConfig(data.assistantConfig);
      } else if (data.sessionUrl) {
        setSessionUrl(data.sessionUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndVoiceSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    if (vapiRef.current) {
      vapiRef.current.stop();
      // call-end event will fire and set status to completed
    } else {
      setSession(prev => prev ? { ...prev, status: 'completed' } : null);
    }
  };

  const handleEndVideoSession = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);
    try {
      // Leave the Daily room first (stops video/audio)
      const daily = dailyRef.current;
      if (daily) {
        dailyRef.current = null;
        await daily.leave();
        daily.destroy();
      }
      // Signal Tavus to end — transcript arrives via webhook (application.transcription_ready)
      // Status polling (every 3s) will detect 'completed' and redirect to debrief
      await fetch(`/api/session/${sessionId}/end-video`, { method: 'POST' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session');
      setIsEnding(false);
      isEndingRef.current = false;
    }
  };

  const handleVideoToggleMute = () => {
    if (!dailyRef.current) return;
    const newMuted = !isVideoMuted;
    dailyRef.current.setLocalAudio(!newMuted);
    setIsVideoMuted(newMuted);
  };

  const handleVideoToggleCam = () => {
    if (!dailyRef.current) return;
    const newOff = !isCamOff;
    dailyRef.current.setLocalVideo(!newOff);
    setIsCamOff(newOff);
  };

  const handleToggleMute = () => {
    if (!vapiRef.current) return;
    const newMuted = !isMuted;
    vapiRef.current.setMuted(newMuted);
    setIsMuted(newMuted);
  };

  const handleRetry = () => {
    setHasTimedOut(false);
    setPreparingStartTime(Date.now());
    if (session?.status === 'preparing') window.location.reload();
  };

  const handleFallbackToVoice = async () => {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId: session?.context_id, personCardId: session?.person_card_id, sessionType: 'voice' }),
      });
      if (response.ok) {
        const data = await response.json();
        router.push(`/session/${data.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create voice session');
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !session || !personCard) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 max-w-md w-full shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold text-red-500 mb-1">Something went wrong</p>
          <p className="text-sm text-ink-muted mb-6">{error || 'Session not found'}</p>
          <button
            onClick={() => router.push('/history')}
            className="w-full bg-ink hover:bg-ink/80 text-cream py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // ── Timeout ──────────────────────────────────────────────────────────────
  if (hasTimedOut) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 max-w-md w-full shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="w-10 h-10 rounded-full bg-amber/10 flex items-center justify-center mb-4">
            <span className="text-amber text-lg">⏱</span>
          </div>
          <h2 className="text-base font-bold text-ink mb-1">Taking longer than expected</h2>
          <p className="text-sm text-ink-muted mb-6">Video avatar preparation is delayed. You can retry or switch to voice.</p>
          <div className="space-y-2.5">
            <button onClick={handleRetry} className="w-full bg-ink hover:bg-ink/80 text-cream py-2.5 rounded-xl text-sm font-bold transition-colors">
              Retry Video
            </button>
            <button onClick={handleFallbackToVoice} className="w-full bg-cream hover:bg-ink/[0.04] border border-ink/[0.12] text-ink py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Switch to Voice
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Post-session ─────────────────────────────────────────────────────────
  if (session.status === 'completed') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-10 max-w-sm w-full text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center mx-auto mb-5">
            <svg className="w-5 h-5 text-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-ink mb-1">Session Complete</h2>
          <p className="text-sm text-ink-muted mb-6">Generating your debrief report...</p>
          <div className="w-6 h-6 border-2 border-ink/20 border-t-ink rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // ── Pre-session ──────────────────────────────────────────────────────────
  if (session.status === 'reserved') {
    const isVoice = session.session_type === 'voice';
    return (
      <div className="min-h-screen bg-cream">
        <NavBar />
        <div className="py-10 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto space-y-4 animate-slide-up">

            {/* Person card summary */}
            <SpotlightCard className="bg-white border border-ink/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.06)]">
            <div>
              <div className={`h-1 w-full ${personCard.card.isArchetype ? 'bg-ink/20' : 'bg-amber'}`} />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold ring-2 ${
                    personCard.card.isArchetype ? 'bg-ink/[0.06] text-ink ring-ink/10' : avatarColor(personCard.participantName)
                  }`}>
                    {personCard.participantName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink">{personCard.participantName}</h2>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-muted mt-0.5">
                      {isVoice ? (
                        <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>Voice Practice</>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Video Practice</>
                      )}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-ink-muted leading-relaxed mb-5">{personCard.card.profileSummary}</p>

                {personCard.card.icebreakers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2.5">Try these openers</p>
                    <ul className="space-y-2">
                      {personCard.card.icebreakers.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="text-amber mt-0.5 text-xs shrink-0 leading-5">◆</span>
                          <span className="text-sm text-ink leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            </SpotlightCard>

            {/* Disclaimer */}
            <label className="flex items-start gap-3 px-4 py-3.5 bg-white border border-ink/[0.08] rounded-xl cursor-pointer hover:bg-ink/[0.02] transition-colors">
              <div className="mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-ink/20 text-ink focus:ring-0 focus:ring-offset-0"
                />
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                I understand this AI persona is a <span className="font-semibold text-ink">simulated practice partner</span> for skill development, not an impersonation of a real person. Views expressed do not represent any named individual.
              </p>
            </label>

            {/* Start button */}
            <button
              onClick={handleStartPractice}
              disabled={!disclaimerAccepted || isStarting}
              className="w-full bg-ink hover:bg-ink/80 disabled:opacity-40 disabled:cursor-not-allowed text-cream py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] shadow-[0_2px_0_rgba(0,0,0,0.2)] flex items-center justify-center gap-2"
            >
              {isStarting ? (
                <><div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />Starting...</>
              ) : (
                <>Start Practice</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preparing / Connecting ───────────────────────────────────────────────
  if (session.status === 'preparing') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-14 h-14 border-2 border-ink/10 border-t-ink rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-base font-bold text-ink mb-1">
            Connecting to {personCard.participantName}
          </h2>
          <p className="text-sm text-ink-muted">
            {session.session_type === 'video' ? 'Preparing video avatar...' : 'Starting voice session...'}
          </p>
        </div>
      </div>
    );
  }

  // ── Active — Video (Custom Daily.co UI) ─────────────────────────────────
  if (session.status === 'active' && session.session_type === 'video') {
    return (
      // fixed inset-0 guarantees true fullscreen regardless of body/html styles
      <div className="fixed inset-0 bg-black overflow-hidden" style={{ zIndex: 9999 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={aiAudioRef} autoPlay hidden />

        {/* AI video — always rendered, hidden until track arrives */}
        <video
          ref={aiVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${aiVideoTrack ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Loading state — shown until AI video track arrives */}
        {!aiVideoTrack && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#111]">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-4xl font-bold text-white">
                {personCard.participantName.charAt(0)}
              </div>
              <span className="absolute inset-[-6px] rounded-full border border-white/20 animate-ping" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-white font-semibold">{personCard.participantName}</p>
              <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                Connecting…
              </div>
            </div>
          </div>
        )}

        {/* Top bar — always visible over video */}
        <div className="absolute top-0 inset-x-0 px-5 pt-4 pb-8 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold text-white">
              {personCard.participantName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{personCard.participantName}</p>
              <p className="text-[11px] text-white/50">Video Practice</p>
            </div>
          </div>
          {elapsedSeconds >= SESSION_LIMIT - 60 && !timeLimitReached && (
            <span className="text-[11px] font-semibold text-amber-400 animate-pulse">
              {SESSION_LIMIT - elapsedSeconds}s left
            </span>
          )}
        </div>

        {/* Speaking indicator */}
        {aiVideoTrack && isAIVideoSpeaking && (
          <div className="absolute bottom-28 inset-x-0 flex justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white/90">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {personCard.participantName.split(' ')[0]} is speaking
            </div>
          </div>
        )}

        {/* Local cam PiP — bottom-right, above controls */}
        <div className="absolute bottom-24 right-4 w-36 h-24 rounded-xl overflow-hidden bg-white/5 shadow-2xl ring-1 ring-white/10">
          {localVideoTrack && !isCamOff ? (
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Controls — floating bar at bottom */}
        <div className="absolute bottom-0 inset-x-0 pt-8 pb-6 flex items-center justify-center gap-5 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          <button
            onClick={handleVideoToggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isVideoMuted ? 'bg-red-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
            }`}
            title={isVideoMuted ? 'Unmute' : 'Mute'}
          >
            {isVideoMuted ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </button>

          <button
            onClick={handleEndVideoSession}
            disabled={isEnding}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white flex items-center justify-center transition-colors shadow-[0_4px_20px_rgba(239,68,68,0.5)]"
            title="End call"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>

          <button
            onClick={handleVideoToggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isCamOff ? 'bg-red-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
            }`}
            title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isCamOff ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
        </div>

        {/* Ending overlay */}
        {isEnding && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-5">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-white mb-1">{timeLimitReached ? "Time's up!" : 'Ending session…'}</p>
              <p className="text-xs text-white/40">{timeLimitReached ? 'Free sessions are limited to 5 minutes. Generating your debrief…' : 'Generating your debrief report'}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Active — Voice (SDK) ─────────────────────────────────────────────────
  if (session.status === 'active' && session.session_type === 'voice') {
    const color = personCard.card.isArchetype ? 'bg-ink/[0.06] text-ink ring-ink/10' : avatarColor(personCard.participantName);
    const BARS = [0.4, 0.7, 1, 0.65, 0.45];

    return (
      <div className="min-h-screen bg-cream flex flex-col">
        {/* Top bar */}
        <div className="px-5 py-3 bg-white border-b border-ink/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ${color}`}>
              {personCard.participantName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-ink leading-tight">{personCard.participantName}</p>
              <p className="text-xs text-ink-muted">Voice Practice</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {elapsedSeconds >= SESSION_LIMIT - 60 && !timeLimitReached && (
              <span className="text-xs font-semibold text-amber-500 animate-pulse">
                {SESSION_LIMIT - elapsedSeconds}s left
              </span>
            )}
            <p className={`text-base font-mono font-bold tabular-nums ${elapsedSeconds >= SESSION_LIMIT - 60 ? 'text-amber-500' : 'text-ink'}`}>
              {formatTime(elapsedSeconds)}
            </p>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex overflow-hidden">

          {/* Voice UI — center */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-10">

            {/* Avatar with waveform */}
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                {isAISpeaking && (
                  <span className="absolute inset-[-6px] rounded-full bg-amber/20 animate-ping" />
                )}
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold ring-4 transition-all duration-300 ${color} ${isAISpeaking ? 'scale-105' : ''}`}>
                  {personCard.participantName.charAt(0)}
                </div>
              </div>

              {/* Waveform bars */}
              <div className="flex items-center gap-1 h-8">
                {BARS.map((maxH, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-amber origin-bottom"
                    style={{
                      height: isAISpeaking ? `${maxH * 32}px` : '6px',
                      animation: isAISpeaking ? `wave-bar ${0.6 + i * 0.1}s ease-in-out ${i * 0.08}s infinite` : 'none',
                      transition: 'height 0.2s ease',
                    }}
                  />
                ))}
              </div>

              <p className="text-sm font-medium text-ink-muted">
                {isAISpeaking ? `${personCard.participantName} is speaking…` : 'Listening'}
              </p>
            </div>

            {/* User volume indicator */}
            <div className="h-7 flex items-center justify-center">
              {volumeLevel > 0.05 && (
                <div className="flex items-center gap-2 text-xs text-ink-muted bg-white border border-ink/[0.08] rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  You&apos;re speaking
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-5">
              <button
                onClick={handleToggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  isMuted
                    ? 'bg-red-100 text-red-500 ring-2 ring-red-200'
                    : 'bg-white border border-ink/[0.12] text-ink hover:bg-ink/[0.04] shadow-sm'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              <button
                onClick={handleEndVoiceSession}
                disabled={isEnding}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white flex items-center justify-center transition-colors shadow-[0_4px_16px_rgba(239,68,68,0.35)]"
                title="End call"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Transcript — right panel (hidden on mobile) */}
          <div className="hidden sm:flex w-72 border-l border-ink/[0.06] bg-white flex-col">
            <div className="px-4 py-3 border-b border-ink/[0.06] shrink-0">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Transcript</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {transcript.length === 0 ? (
                <p className="text-xs text-ink-muted/40 mt-1">Transcript will appear here…</p>
              ) : (
                transcript.map((t, i) => (
                  <div key={i} className={`flex gap-2 ${t.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <p className={`text-xs leading-relaxed rounded-xl px-3 py-2 max-w-[90%] ${
                      t.role === 'user'
                        ? 'bg-ink text-cream'
                        : 'bg-ink/[0.04] text-ink'
                    }`}>{t.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

        </div>

        {/* Ending overlay */}
        {isEnding && (
          <div className="fixed inset-0 bg-cream/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-ink/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-ink animate-spin" />
              <div className="absolute inset-2 rounded-full bg-white border border-ink/[0.08] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-amber animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-ink mb-1">{timeLimitReached ? "Time's up!" : 'Ending session…'}</p>
              <p className="text-xs text-ink-muted">{timeLimitReached ? 'Free sessions are limited to 5 minutes. Generating your debrief…' : 'Generating your debrief report'}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
