/**
 * GET /api/session/[sessionId]/status
 *
 * Returns current session status from the database.
 * Debrief generation is handled by /end-video (fire-and-forget background job).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status, tavus_persona_status, session_type')
      .eq('id', params.sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      tavusPersonaStatus: session.tavus_persona_status,
      sessionType: session.session_type,
    });
  } catch (error) {
    console.error('Error fetching session status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch session status' },
      { status: 500 }
    );
  }
}
