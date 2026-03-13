/**
 * GET /api/history
 * 
 * Returns all sessions for authenticated user ordered by created_at DESC
 * Groups retry sessions under their parent session
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';

export async function GET(_request: NextRequest) {
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

    // Fetch all sessions for the user, ordered by created_at DESC
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        context_id,
        person_card_id,
        session_type,
        status,
        seconds_consumed,
        parent_session_id,
        started_at,
        ended_at,
        created_at,
        person_cards (
          participant_name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Failed to fetch sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    // Group retry sessions under their parent
    const sessionMap = new Map();
    const rootSessions: any[] = [];

    // First pass: create map of all sessions
    sessions.forEach((session: any) => {
      sessionMap.set(session.id, {
        ...session,
        participantName: session.person_cards?.participant_name || 'Unknown',
        retries: [],
      });
      delete sessionMap.get(session.id).person_cards;
    });

    // Second pass: organize into hierarchy
    sessions.forEach((session: any) => {
      const sessionData = sessionMap.get(session.id);
      
      if (session.parent_session_id) {
        // This is a retry session - add it to parent's retries array
        const parent = sessionMap.get(session.parent_session_id);
        if (parent) {
          parent.retries.push(sessionData);
        } else {
          // Parent not found (shouldn't happen), treat as root
          rootSessions.push(sessionData);
        }
      } else {
        // This is a root session
        rootSessions.push(sessionData);
      }
    });

    return NextResponse.json({
      sessions: rootSessions,
    });

  } catch (error) {
    console.error('Error in GET /api/history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
