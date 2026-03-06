/**
 * POST /api/session/[sessionId]/end
 * Ends session, saves transcript, reconciles minutes, triggers debrief
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { getSession, endSession } from '@/src/services/SessionService';
import { Transcript } from '@/src/types';

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

    const body = await request.json();
    const { transcript, durationSeconds, interrupted } = body;

    // Validate required fields
    if (!transcript || durationSeconds === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: transcript, durationSeconds' },
        { status: 400 }
      );
    }

    const sessionId = params.sessionId;

    // Verify session belongs to user
    const session = await getSession(sessionId, user.id);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // End the session
    await endSession({
      sessionId,
      transcript: transcript as Transcript,
      durationSeconds,
      interrupted: interrupted || false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to end session' },
      { status: 500 }
    );
  }
}
