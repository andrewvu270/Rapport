/**
 * SessionService
 * Orchestrates session lifecycle: reservation → prompt build → Vapi/Tavus start → 
 * transcript save → reconciliation → debrief trigger
 */

import { createServiceClient } from '../lib/supabase-server';
import { Transcript } from '../types';
import { reconcileSession, releaseReservation } from './session/minuteReservation';

/**
 * Ends a session normally
 * Implements idempotency check to prevent race conditions between client and webhook
 * @param sessionId - The session ID
 * @param transcript - The full session transcript
 * @param durationSeconds - The actual session duration in seconds
 */
export async function endSession(
  sessionId: string,
  transcript: Transcript,
  durationSeconds: number
): Promise<void> {
  const supabase = createServiceClient();

  // Idempotency check: verify session is not already in a terminal state
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (fetchError) {
    console.error('Failed to fetch session for idempotency check:', fetchError);
    throw fetchError;
  }

  // If already completed or interrupted, return immediately to prevent double-processing
  if (session.status === 'completed' || session.status === 'interrupted') {
    console.log(`Session ${sessionId} already in terminal state: ${session.status}. Ignoring duplicate end request.`);
    return;
  }

  // Save transcript
  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      transcript,
      ended_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', sessionId);

  if (updateError) {
    console.error('Failed to save transcript:', updateError);
    throw updateError;
  }

  // Reconcile minutes
  await reconcileSession(sessionId, durationSeconds);

  // Trigger debrief generation (will be implemented in task 18)
  // await DebriefService.generateDebrief(sessionId);
}

/**
 * Handles session interruption (connection drop)
 * @param sessionId - The session ID
 * @param partialTranscript - Any transcript content collected before interruption
 * @param elapsedSeconds - Seconds elapsed before interruption
 */
export async function interruptSession(
  sessionId: string,
  partialTranscript: Transcript | null,
  elapsedSeconds: number
): Promise<void> {
  const supabase = createServiceClient();

  // Idempotency check
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (fetchError) {
    console.error('Failed to fetch session for idempotency check:', fetchError);
    throw fetchError;
  }

  if (session.status === 'completed' || session.status === 'interrupted') {
    console.log(`Session ${sessionId} already in terminal state: ${session.status}. Ignoring duplicate interrupt request.`);
    return;
  }

  // Save partial transcript if available
  const updateData: any = {
    status: 'interrupted',
    ended_at: new Date().toISOString(),
  };

  if (partialTranscript) {
    updateData.transcript = partialTranscript;
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', sessionId);

  if (updateError) {
    console.error('Failed to update interrupted session:', updateError);
    throw updateError;
  }

  // Release unused reservation
  await releaseReservation(sessionId, elapsedSeconds);
}
