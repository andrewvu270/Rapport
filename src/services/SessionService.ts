/**
 * SessionService
 * Orchestrates the complete session lifecycle:
 * - Reservation → prompt build → Vapi/Tavus start → transcript save → reconciliation → debrief trigger
 * 
 * Implements Requirements 4.1–4.6, 5.1–5.6
 */

import { createServiceClient } from '../lib/supabase-server';
import { Transcript, PersonCard, ContextInput } from '../types';
import { placeReservation, reconcileSession, releaseReservation } from './session/minuteReservation';
import { buildSystemPrompt } from './session/promptBuilder';
import { startVapiSession } from './session/vapiSession';
import { startTavusVideoSession as startTavusV2 } from './session/tavusSession';
import { DebriefService } from './DebriefService';

interface StartSessionParams {
  userId: string;
  contextId: string;
  personCardId: string;
  sessionType: 'voice' | 'video';
  persona: PersonCard;
  intelChunks: string[];
  contextInput: ContextInput;
}

interface StartSessionResult {
  sessionId: string;
  sessionUrl?: string;
  status: 'active' | 'preparing';
}

interface EndSessionParams {
  sessionId: string;
  transcript: Transcript;
  durationSeconds: number;
  interrupted?: boolean;
}

/**
 * Starts a new practice session (voice or video)
 * Places reservation, builds prompt, initiates Vapi or Tavus session
 */
export async function startSession(params: StartSessionParams): Promise<StartSessionResult> {
  const supabase = createServiceClient();
  const { userId, contextId, personCardId, sessionType, persona, intelChunks, contextInput } = params;

  // Create session record with 'reserved' status
  const { data: session, error: createError } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      context_id: contextId,
      person_card_id: personCardId,
      session_type: sessionType,
      status: 'reserved',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (createError || !session) {
    throw new Error(`Failed to create session: ${createError?.message}`);
  }

  const sessionId = session.id;

  try {
    // Place minute reservation
    await placeReservation(sessionId, userId, sessionType);

    // Build system prompt with persona and intel
    const systemPrompt = buildSystemPrompt(persona, intelChunks, contextInput);

    if (sessionType === 'voice') {
      // Start Vapi voice session
      const vapiCallId = await startVapiSession(systemPrompt);

      // Update session with Vapi call ID
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          vapi_call_id: vapiCallId,
          started_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        throw new Error(`Failed to update session with Vapi call ID: ${updateError.message}`);
      }

      return {
        sessionId,
        status: 'active',
      };
    } else {
      // Video session: synchronously create Tavus persona + conversation (v2 API)
      const { conversationId, conversationUrl, personaId } = await startTavusV2(
        persona,
        systemPrompt,
        contextInput
      );

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          tavus_persona_id: personaId,
          tavus_conversation_id: conversationId,
          tavus_persona_status: 'ready',
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        throw new Error(`Failed to update session with Tavus IDs: ${updateError.message}`);
      }

      return {
        sessionId,
        sessionUrl: conversationUrl,
        status: 'active',
      };
    }
  } catch (error) {
    // If anything fails, release the reservation
    await releaseReservation(sessionId, 0);
    throw error;
  }
}

/**
 * Returns the Tavus conversation URL for an active video session.
 * With the v2 synchronous API, the conversation is created during startSession.
 */
export async function startTavusVideoSession(sessionId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('tavus_conversation_id, status')
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    throw new Error(`Failed to fetch session: ${fetchError?.message}`);
  }

  if (!session.tavus_conversation_id) {
    throw new Error('No Tavus conversation found for this session');
  }

  // Conversation URL is not stored — this endpoint is deprecated in favor of start/route.ts
  // Return the Tavus conversation URL pattern
  return `https://tavus.daily.co/${session.tavus_conversation_id}`;
}

/**
 * Ends a practice session
 * Saves transcript, reconciles minutes, triggers debrief generation
 * 
 * **Idempotency check**: Returns immediately if session is already completed or interrupted
 * to prevent race conditions between client and webhook
 */
export async function endSession(params: EndSessionParams): Promise<void> {
  const supabase = createServiceClient();
  const { sessionId, transcript, durationSeconds, interrupted = false } = params;

  // IDEMPOTENCY CHECK: Check if session is already in a terminal state
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch session status: ${fetchError.message}`);
  }

  // If already completed or interrupted, return immediately without processing
  if (session.status === 'completed' || session.status === 'interrupted') {
    console.log(`Session ${sessionId} already in terminal state: ${session.status}. Skipping end processing.`);
    return;
  }

  // Save transcript to session
  const { error: transcriptError } = await supabase
    .from('sessions')
    .update({
      transcript: transcript,
    })
    .eq('id', sessionId);

  if (transcriptError) {
    throw new Error(`Failed to save transcript: ${transcriptError.message}`);
  }

  if (interrupted) {
    // Release reservation with elapsed time
    await releaseReservation(sessionId, durationSeconds);
  } else {
    // Reconcile session: set seconds_consumed, clear reservation, update user minutes
    await reconcileSession(sessionId, durationSeconds);

    // Trigger debrief generation
    const debriefService = new DebriefService();
    await debriefService.generateDebrief(sessionId);
  }
}

/**
 * Interrupts an in-progress session (e.g. user dropped, connection lost)
 * Saves partial transcript and releases the minute reservation.
 */
export async function interruptSession(
  sessionId: string,
  transcript: import('../types').Transcript,
  durationSeconds: number
): Promise<void> {
  return endSession({ sessionId, transcript, durationSeconds, interrupted: true });
}

/**
 * Gets session status and transcript
 */
export async function getSession(sessionId: string, userId: string) {
  const supabase = createServiceClient();

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch session: ${error.message}`);
  }

  return session;
}
