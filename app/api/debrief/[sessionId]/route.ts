/**
 * GET /api/debrief/[sessionId]
 * 
 * Returns debrief report (or { pending: true } if not yet generated)
 * 
 * Requirements: 6.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { deserialize } from '@/src/lib/serialization';
import type { DebriefReport } from '@/src/types';

export async function GET(
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

    const { sessionId } = params;

    // Fetch debrief from Supabase
    const { data: debrief, error: debriefError } = await supabase
      .from('debriefs')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (debriefError) {
      if (debriefError.code === 'PGRST116') {
        // No debrief found yet
        return NextResponse.json(
          { pending: true },
          { status: 200 }
        );
      }
      
      console.error('Failed to fetch debrief:', debriefError);
      return NextResponse.json(
        { error: 'Failed to fetch debrief' },
        { status: 500 }
      );
    }

    // If debrief is pending, return pending status
    if (debrief.pending) {
      return NextResponse.json(
        { pending: true },
        { status: 200 }
      );
    }

    // Deserialize debrief report
    try {
      const debriefReport = deserialize<DebriefReport>(
        debrief.report_data,
        {
          documentType: 'DebriefReport',
          userId: user.id,
        }
      );

      return NextResponse.json({
        pending: false,
        report: debriefReport,
      });
    } catch (error) {
      console.error('Failed to deserialize debrief report:', error);
      return NextResponse.json(
        { error: 'Failed to deserialize debrief report' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in GET /api/debrief/[sessionId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
