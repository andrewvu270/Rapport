/**
 * Session Status Endpoint
 * Returns current session status for frontend polling during persona creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../src/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch session status
    const { data: session, error } = await supabase
      .from('sessions')
      .select('status, tavus_persona_status, session_type')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      console.error('Session not found:', sessionId, error);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: session.status,
      tavusPersonaStatus: session.tavus_persona_status,
      sessionType: session.session_type,
    });

  } catch (error) {
    console.error('Error fetching session status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
