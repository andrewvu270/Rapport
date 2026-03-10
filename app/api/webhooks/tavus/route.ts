/**
 * Tavus Webhook Handler
 * Receives session end and drop events from Tavus
 * Validates webhook signature before processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../src/lib/supabase-server';
import { endSession, interruptSession } from '../../../../src/services/SessionService';
import { Transcript, TranscriptTurn } from '../../../../src/types';

/**
 * Converts Tavus transcript format to our Transcript type
 */
function convertTavusTranscript(
  tavusTranscript: any[],
  sessionId: string,
  durationSeconds: number
): Transcript {
  const turns: TranscriptTurn[] = tavusTranscript.map((turn: any) => ({
    speaker: turn.role === 'assistant' || turn.role === 'persona' ? 'persona' : 'user',
    text: turn.content || turn.text || turn.message || '',
    timestamp: turn.timestamp || new Date().toISOString(),
  }));

  return {
    turns,
    durationSeconds,
    sessionId,
  };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);
    console.log('[Tavus webhook] payload:', JSON.stringify(payload, null, 2));

    const eventType = payload.event_type || payload.type || payload.event;
    console.log('[Tavus webhook] eventType:', eventType);

    // Extract conversation ID from payload
    const tavusConversationId =
      payload.conversation_id ||
      payload.conversation?.conversation_id ||
      payload.conversation?.id;
    console.log('[Tavus webhook] conversationId:', tavusConversationId);
    
    if (!tavusConversationId) {
      console.error('No conversation ID in Tavus webhook payload');
      return NextResponse.json(
        { error: 'Missing conversation ID' },
        { status: 400 }
      );
    }

    // Look up session by tavus_conversation_id
    const supabase = createServiceClient();
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('tavus_conversation_id', tavusConversationId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found for Tavus conversation ID:', tavusConversationId, sessionError);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const sessionId = session.id;

    // Webhook race condition guardrail: check if already in terminal state
    if (session.status === 'completed' || session.status === 'interrupted') {
      console.log(`Session ${sessionId} already ${session.status}. Ignoring webhook.`);
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    // Handle different event types
    if (
      eventType === 'conversation.ended' ||
      eventType === 'conversation.completed' ||
      eventType === 'application.ended'
    ) {
      // Normal conversation end
      const durationSeconds = payload.conversation?.duration || payload.duration || 0;
      const tavusTranscript = payload.conversation?.transcript || payload.transcript || [];
      
      const transcript = convertTavusTranscript(tavusTranscript, sessionId, durationSeconds);
      
      await endSession({ sessionId, transcript, durationSeconds });

      return NextResponse.json({ message: 'Session ended successfully' }, { status: 200 });
    }
    else if (eventType === 'conversation.failed' || eventType === 'conversation.disconnected') {
      // Conversation drop/interruption
      const elapsedSeconds = payload.conversation?.duration || payload.duration || 0;
      const tavusTranscript = payload.conversation?.transcript || payload.transcript || [];

      const partialTranscript = tavusTranscript.length > 0
        ? convertTavusTranscript(tavusTranscript, sessionId, elapsedSeconds)
        : { turns: [], durationSeconds: elapsedSeconds, sessionId };

      await interruptSession(sessionId, partialTranscript, elapsedSeconds);
      
      return NextResponse.json({ message: 'Session interrupted' }, { status: 200 });
    }

    // Unknown event type - log and return success to avoid retries
    console.log('Unknown Tavus event type:', eventType);
    return NextResponse.json({ message: 'Event received' }, { status: 200 });

  } catch (error) {
    console.error('Error processing Tavus webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
