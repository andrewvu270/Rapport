/**
 * GET /api/user/export
 * 
 * Exports all user data as JSON
 * Returns contexts, person_cards, sessions, and debriefs
 * 
 * Requirements: 9.3
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

    // Fetch all user data
    const [contextsResult, personCardsResult, sessionsResult, debriefsResult] = await Promise.all([
      supabase
        .from('contexts')
        .select('*')
        .eq('user_id', user.id),
      
      supabase
        .from('person_cards')
        .select('*')
        .eq('user_id', user.id),
      
      supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id),
      
      supabase
        .from('debriefs')
        .select('*')
        .eq('user_id', user.id),
    ]);

    // Check for errors
    if (contextsResult.error) {
      console.error('Failed to fetch contexts:', contextsResult.error);
      return NextResponse.json(
        { error: 'Failed to export data' },
        { status: 500 }
      );
    }

    if (personCardsResult.error) {
      console.error('Failed to fetch person_cards:', personCardsResult.error);
      return NextResponse.json(
        { error: 'Failed to export data' },
        { status: 500 }
      );
    }

    if (sessionsResult.error) {
      console.error('Failed to fetch sessions:', sessionsResult.error);
      return NextResponse.json(
        { error: 'Failed to export data' },
        { status: 500 }
      );
    }

    if (debriefsResult.error) {
      console.error('Failed to fetch debriefs:', debriefsResult.error);
      return NextResponse.json(
        { error: 'Failed to export data' },
        { status: 500 }
      );
    }

    // Build export object with top-level keys for each category
    const exportData = {
      contexts: contextsResult.data || [],
      personCards: personCardsResult.data || [],
      sessions: sessionsResult.data || [],
      debriefs: debriefsResult.data || [],
    };

    return NextResponse.json(exportData);

  } catch (error) {
    console.error('Error in GET /api/user/export:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
