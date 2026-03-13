/**
 * POST /api/session/[sessionId]/retry
 * 
 * Creates a new session using the same person_card_id, context_id, and session_type
 * as the original; sets parent_session_id to the original session
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';

/**
 * POST /api/session/[sessionId]/retry
 * Creates a new reserved session with the same person card, context, and type.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: original, error: sessionError } = await supabase
      .from('sessions')
      .select('person_card_id, context_id, session_type')
      .eq('id', params.sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !original) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: newSession, error: createError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        context_id: original.context_id,
        person_card_id: original.person_card_id,
        session_type: original.session_type,
        status: 'reserved',
        parent_session_id: params.sessionId,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError || !newSession) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: newSession.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
