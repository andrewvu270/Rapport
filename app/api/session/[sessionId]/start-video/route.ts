/**
 * POST /api/session/[sessionId]/start-video
 * 
 * Starts a Tavus video session after persona is ready
 * Should be called after polling confirms persona status is 'ready'
 * 
 * Requirements: 5.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { startTavusVideoSession } from '@/src/services/SessionService';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessionId = params.sessionId;

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session || session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Start the video session
    const sessionUrl = await startTavusVideoSession(sessionId);

    return NextResponse.json({ sessionUrl });
  } catch (error) {
    console.error('Error starting video session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start video session' },
      { status: 500 }
    );
  }
}
