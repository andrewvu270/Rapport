/**
 * GET /api/history/progress
 * 
 * Computes per-dimension average scores across all debriefs in the current billing period
 * Uses billing_period_start from the user row to determine the current period
 * 
 * Requirements: 7.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { DebriefReport } from '@/src/types';

export async function GET(request: NextRequest) {
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

    // Fetch user's billing_period_start
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('billing_period_start')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Failed to fetch user data:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    const billingPeriodStart = new Date(userData.billing_period_start);

    // Fetch all debriefs for sessions created on or after billing_period_start
    const { data: debriefs, error: debriefsError } = await supabase
      .from('debriefs')
      .select(`
        report_data,
        created_at,
        sessions!inner (
          created_at
        )
      `)
      .eq('user_id', user.id)
      .eq('pending', false)
      .gte('sessions.created_at', billingPeriodStart.toISOString());

    if (debriefsError) {
      console.error('Failed to fetch debriefs:', debriefsError);
      return NextResponse.json(
        { error: 'Failed to fetch debriefs' },
        { status: 500 }
      );
    }

    // If no debriefs, return zeros
    if (!debriefs || debriefs.length === 0) {
      return NextResponse.json({
        averageScores: {
          openers: 0,
          questionQuality: 0,
          responseRelevance: 0,
          closing: 0,
        },
        sessionCount: 0,
      });
    }

    // Compute average scores per dimension
    let totalOpeners = 0;
    let totalQuestionQuality = 0;
    let totalResponseRelevance = 0;
    let totalClosing = 0;

    debriefs.forEach((debrief: any) => {
      const report = debrief.report_data as DebriefReport;
      totalOpeners += report.scores.openers;
      totalQuestionQuality += report.scores.questionQuality;
      totalResponseRelevance += report.scores.responseRelevance;
      totalClosing += report.scores.closing;
    });

    const count = debriefs.length;

    return NextResponse.json({
      averageScores: {
        openers: Math.round((totalOpeners / count) * 100) / 100,
        questionQuality: Math.round((totalQuestionQuality / count) * 100) / 100,
        responseRelevance: Math.round((totalResponseRelevance / count) * 100) / 100,
        closing: Math.round((totalClosing / count) * 100) / 100,
      },
      sessionCount: count,
    });

  } catch (error) {
    console.error('Error in GET /api/history/progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
