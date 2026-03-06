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
import { createTavusPersona, startTavusSession } from './session/tavusSession';

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
      // Video session: create Tavus persona (async)
      const { personaId } = await createTavusPersona(systemPrompt, intelChunks);

      // Update session with persona ID and status
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          tavus_persona_id: personaId,
          tavus_persona_status: 'creating',
          status: 'preparing',
        })
        .eq('id', sessionId);

      if (updateError) {
        throw new Error(`Failed to update session with Tavus persona ID: ${updateError.message}`);
      }

      return {
        sessionId,
        status: 'preparing',
      };
    }
  } catch (error) {
    // If anything fails, release the reservation
    await releaseReservation(sessionId, 0);
    throw error;
  }
}

/**
 * Starts a Tavus video session after persona is ready
 * Should be called after polling confirms persona status is 'ready'
 */
export async function startTavusVideoSession(sessionId: string): Promise<string> {
  const supabase = createServiceClient();

  // Get the persona ID from the session
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('tavus_persona_id, tavus_persona_status')
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    throw new Error(`Failed to fetch session: ${fetchError?.message}`);
  }

  if (session.tavus_persona_status !== 'ready') {
    throw new Error(`Persona is not ready. Current status: ${session.tavus_persona_status}`);
  }

  // Start the Tavus conversation
  const { conversationId, sessionUrl } = await startTavusSession(session.tavus_persona_id);

  // Update session with conversation ID and set status to active
  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      tavus_conversation_id: conversationId,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (updateError) {
    throw new Error(`Failed to update session with conversation ID: ${updateError.message}`);
  }

  return sessionUrl;
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

    // Trigger debrief generation (will be implemented in task 18)
    // For now, we'll just log that debrief should be triggered
    console.log(`Debrief generation should be triggered for session ${sessionId}`);
    // TODO: Call DebriefService.generateDebrief(sessionId) when implemented
  }
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
