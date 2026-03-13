/**
 * Tavus Webhook Handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../src/lib/supabase-server';
import { endSession, interruptSession } from '../../../../src/services/SessionService';
import { Transcript, TranscriptTurn } from '../../../../src/types';

function convertTavusTranscript(
  tavusTranscript: any[],
  sessionId: string,
  durationSeconds: number
): Transcript {
  const turns: TranscriptTurn[] = tavusTranscript
    .filter((turn: any) => {
      const text: string = turn.content || turn.text || turn.message || '';
      // Filter out system prompt messages (persona setup context sent as first message)
      return !(text.includes('# Your Character Profile') || text.startsWith('You are roleplaying as'));
    })
    .map((turn: any) => ({
      speaker: turn.role === 'assistant' || turn.role === 'replica' || turn.role === 'persona' ? 'persona' : 'user',
      text: turn.content || turn.text || turn.message || '',
      timestamp: turn.timestamp || new Date().toISOString(),
    }));
  return { turns, durationSeconds, sessionId };
}

async function lookupSession(tavusConversationId: string) {
  const supabase = createServiceClient();
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('tavus_conversation_id', tavusConversationId)
    .single();
  if (error || !session) return null;
  return session;
}

export async function POST(request: NextRequest) {
  try {
    // Verify shared secret (appended to callback URL as ?secret=...)
    const secret = process.env.TAVUS_WEBHOOK_SECRET;
    if (secret) {
      const provided = request.nextUrl.searchParams.get('secret');
      if (provided !== secret) {
        console.warn('[Tavus webhook] Invalid or missing secret');
        return NextResponse.json({ message: 'OK' }, { status: 200 });
      }
    }

    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);
    console.log('[Tavus webhook] event:', payload.event_type || payload.type, 'keys:', Object.keys(payload));

    const eventType = payload.event_type || payload.type || payload.event;

    const tavusConversationId =
      payload.conversation_id ||
      payload.conversation?.conversation_id ||
      payload.conversation?.id;

    if (!tavusConversationId) {
      console.log('[Tavus webhook] No conversation ID, ignoring event:', eventType);
      return NextResponse.json({ message: 'No conversation ID' }, { status: 200 });
    }

    const session = await lookupSession(tavusConversationId);
    if (!session) {
      console.warn('[Tavus webhook] Session not found for conversationId:', tavusConversationId);
      return NextResponse.json({ message: 'OK' }, { status: 200 });
    }

    const sessionId = session.id;

    // application.transcription_ready — THIS is where Tavus sends the actual transcript
    // It fires after conversation.ended/application.ended with the finalized speech-to-text
    if (eventType === 'application.transcription_ready') {
      console.log('[Tavus webhook] transcription_ready for session:', sessionId);
      console.log('[Tavus webhook] properties keys:', payload.properties ? Object.keys(payload.properties) : 'none');

      // Tavus puts transcript data inside payload.properties
      const props = payload.properties || {};
      const tavusTranscript: any[] =
        props.transcript ||
        props.conversation?.transcript ||
        payload.transcript ||
        payload.conversation?.transcript ||
        payload.data?.transcript ||
        [];

      const durationSeconds =
        props.duration ||
        props.conversation?.duration ||
        payload.duration ||
        payload.conversation?.duration ||
        0;

      console.log('[Tavus webhook] transcript turns:', tavusTranscript.length, 'duration:', durationSeconds);

      // Always call endSession here — this overrides any empty-transcript completion
      // The idempotency check in endSession will block if already in terminal state,
      // so bypass it for transcript_ready by updating transcript directly then calling endSession
      const supabase = createServiceClient();

      if (session.status === 'completed' && tavusTranscript.length > 0) {
        // Session already marked complete (possibly with empty transcript) — update transcript and regenerate debrief
        console.log('[Tavus webhook] Session already completed, updating transcript and regenerating debrief');
        const transcript = convertTavusTranscript(tavusTranscript, sessionId, durationSeconds);
        await supabase.from('sessions').update({ transcript }).eq('id', sessionId);
        const { DebriefService } = await import('../../../../src/services/DebriefService');
        const debriefService = new DebriefService();
        await debriefService.generateDebrief(sessionId);
      } else if (session.status !== 'interrupted') {
        // Normal path: session is still active or completing
        const transcript = convertTavusTranscript(tavusTranscript, sessionId, durationSeconds);
        await endSession({ sessionId, transcript, durationSeconds });
      }

      return NextResponse.json({ message: 'Transcript processed' }, { status: 200 });
    }

    // Terminal state guard for all other events
    if (session.status === 'completed' || session.status === 'interrupted') {
      console.log(`[Tavus webhook] Session ${sessionId} already ${session.status}. Ignoring ${eventType}.`);
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    if (
      eventType === 'conversation.ended' ||
      eventType === 'conversation.completed' ||
      eventType === 'application.ended'
    ) {
      // Conversation ended — transcript arrives separately via application.transcription_ready
      // Only call endSession here if the payload actually includes a transcript
      const durationSeconds = payload.conversation?.duration || payload.duration || 0;
      const tavusTranscript = payload.conversation?.transcript || payload.transcript || [];

      if (tavusTranscript.length > 0) {
        console.log('[Tavus webhook] conversation.ended with transcript, ending session');
        const transcript = convertTavusTranscript(tavusTranscript, sessionId, durationSeconds);
        await endSession({ sessionId, transcript, durationSeconds });
      } else {
        // No transcript yet — application.transcription_ready will come and handle it
        console.log('[Tavus webhook] conversation.ended with empty transcript, waiting for transcription_ready');
      }

      return NextResponse.json({ message: 'Event received' }, { status: 200 });
    }

    if (eventType === 'conversation.failed' || eventType === 'conversation.disconnected') {
      const elapsedSeconds = payload.conversation?.duration || payload.duration || 0;
      const tavusTranscript = payload.conversation?.transcript || payload.transcript || [];
      const partialTranscript = tavusTranscript.length > 0
        ? convertTavusTranscript(tavusTranscript, sessionId, elapsedSeconds)
        : { turns: [], durationSeconds: elapsedSeconds, sessionId };
      await interruptSession(sessionId, partialTranscript, elapsedSeconds);
      return NextResponse.json({ message: 'Session interrupted' }, { status: 200 });
    }

    // system.shutdown, participant events, etc. — safely ignore
    console.log('[Tavus webhook] Ignoring event type:', eventType);
    return NextResponse.json({ message: 'Event received' }, { status: 200 });

  } catch (error) {
    console.error('[Tavus webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
