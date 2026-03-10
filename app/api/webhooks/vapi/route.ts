/**
 * Vapi Webhook Handler
 * Receives call end events and transcripts from Vapi
 * Validates webhook signature before processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../src/lib/supabase-server';
import { endSession, interruptSession } from '../../../../src/services/SessionService';
import { Transcript, TranscriptTurn } from '../../../../src/types';
import crypto from 'crypto';

/**
 * Validates Vapi webhook signature
 * @param payload - The raw request body
 * @param signature - The signature from the request header
 * @returns true if signature is valid
 */
function validateWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    console.error('VAPI_WEBHOOK_SECRET is not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Converts Vapi transcript format to our Transcript type
 */
function convertVapiTranscript(
  vapiTranscript: any[],
  sessionId: string,
  durationSeconds: number
): Transcript {
  const turns: TranscriptTurn[] = vapiTranscript.map((turn: any) => ({
    speaker: turn.role === 'assistant' ? 'persona' : 'user',
    text: turn.content || turn.text || '',
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
    // Read raw body for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get('x-vapi-signature');

    // Validate webhook signature
    if (!validateWebhookSignature(rawBody, signature)) {
      console.error('Invalid Vapi webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type || payload.event;

    // Extract session ID from metadata or call ID
    const vapiCallId = payload.call?.id || payload.callId;
    
    if (!vapiCallId) {
      console.error('No call ID in Vapi webhook payload');
      return NextResponse.json(
        { error: 'Missing call ID' },
        { status: 400 }
      );
    }

    // Look up session by vapi_call_id
    const supabase = createServiceClient();
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('vapi_call_id', vapiCallId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found for Vapi call ID:', vapiCallId, sessionError);
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
    if (eventType === 'call.ended' || eventType === 'end-of-call-report') {
      // Normal call end
      const durationSeconds = payload.call?.duration || payload.duration || 0;
      const vapiTranscript = payload.call?.transcript || payload.transcript || [];
      
      const transcript = convertVapiTranscript(vapiTranscript, sessionId, durationSeconds);
      
      await endSession({ sessionId, transcript, durationSeconds });

      return NextResponse.json({ message: 'Session ended successfully' }, { status: 200 });
    }
    else if (eventType === 'call.failed' || eventType === 'call.disconnected') {
      // Call drop/interruption
      const elapsedSeconds = payload.call?.duration || payload.duration || 0;
      const vapiTranscript = payload.call?.transcript || payload.transcript || [];

      const partialTranscript = vapiTranscript.length > 0
        ? convertVapiTranscript(vapiTranscript, sessionId, elapsedSeconds)
        : { turns: [], durationSeconds: elapsedSeconds, sessionId };

      await interruptSession(sessionId, partialTranscript, elapsedSeconds);
      
      return NextResponse.json({ message: 'Session interrupted' }, { status: 200 });
    }

    // Unknown event type - log and return success to avoid retries
    console.log('Unknown Vapi event type:', eventType);
    return NextResponse.json({ message: 'Event received' }, { status: 200 });

  } catch (error) {
    console.error('Error processing Vapi webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
