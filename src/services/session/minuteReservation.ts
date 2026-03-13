import { createServiceClient } from '../../lib/supabase-server';

/**
 * Places a minute reservation on a session
 * Sets seconds_reserved on the session row in an atomic transaction
 * 
 * @param sessionId - The session ID
 * @param userId - The user ID
 * @param sessionType - 'voice' or 'video'
 * @returns The number of seconds reserved
 */
export async function placeReservation(
  sessionId: string,
  userId: string,
  _sessionType: 'voice' | 'video'
): Promise<number> {
  const supabase = createServiceClient();

  // For MVP, we reserve a fixed amount (e.g., 30 minutes = 1800 seconds)
  // In future with tier limits, this would check available balance first
  const secondsToReserve = 1800; // 30 minutes

  const { data, error } = await supabase
    .from('sessions')
    .update({
      seconds_reserved: secondsToReserve,
      status: 'active'
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('seconds_reserved')
    .single();

  if (error) {
    throw new Error(`Failed to place reservation: ${error.message}`);
  }

  return data.seconds_reserved;
}

/**
 * Reconciles a completed session
 * Sets seconds_consumed, clears seconds_reserved, updates user's minute counters
 * 
 * @param sessionId - The session ID
 * @param durationSeconds - Actual session duration in seconds
 */
export async function reconcileSession(
  sessionId: string,
  durationSeconds: number
): Promise<void> {
  const supabase = createServiceClient();

  // First, get the session to find user_id and session_type
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('user_id, session_type')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(`Failed to fetch session: ${sessionError?.message}`);
  }

  // Calculate minutes consumed (ceiling of seconds / 60)
  const minutesConsumed = Math.ceil(durationSeconds / 60);

  // Update session: set seconds_consumed, clear seconds_reserved, set status to completed
  const { error: updateSessionError } = await supabase
    .from('sessions')
    .update({
      seconds_consumed: durationSeconds,
      seconds_reserved: 0,
      status: 'completed',
      ended_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (updateSessionError) {
    throw new Error(`Failed to update session: ${updateSessionError.message}`);
  }

  // Update user's minute counter based on session type
  const columnToUpdate = session.session_type === 'voice' 
    ? 'voice_minutes_used' 
    : 'video_minutes_used';

  const { error: updateUserError } = await supabase.rpc(
    'increment_minutes_used',
    {
      p_user_id: session.user_id,
      p_column: columnToUpdate,
      p_minutes: minutesConsumed
    }
  );

  // If RPC doesn't exist, fall back to manual increment
  if (updateUserError) {
    // Fetch current value
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select(columnToUpdate)
      .eq('id', session.user_id)
      .single();

    if (fetchError || !userData) {
      throw new Error(`Failed to fetch user data: ${fetchError?.message}`);
    }

    const currentMinutes = (userData as Record<string, number>)[columnToUpdate] || 0;

    // Update with new value
    const { error: manualUpdateError } = await supabase
      .from('users')
      .update({ [columnToUpdate]: currentMinutes + minutesConsumed })
      .eq('id', session.user_id);

    if (manualUpdateError) {
      throw new Error(`Failed to update user minutes: ${manualUpdateError.message}`);
    }
  }
}

/**
 * Releases a reservation when a session is interrupted
 * Sets seconds_consumed to elapsed time, clears seconds_reserved
 * 
 * @param sessionId - The session ID
 * @param elapsedSeconds - Actual elapsed time before interruption
 */
export async function releaseReservation(
  sessionId: string,
  elapsedSeconds: number
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('sessions')
    .update({
      seconds_consumed: elapsedSeconds,
      seconds_reserved: 0,
      status: 'interrupted',
      ended_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to release reservation: ${error.message}`);
  }
}
