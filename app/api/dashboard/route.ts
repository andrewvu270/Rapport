import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { deserialize } from '@/src/lib/serialization';
import type { DebriefReport } from '@/src/types';

const FREE_TIER_SECONDS = 60 * 60; // 60 min/month

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all completed sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_type, started_at, duration_seconds, person_card_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false });

    const allSessions = sessions ?? [];

    // Usage this month
    const monthSessions = allSessions.filter(s => s.started_at >= monthStart);
    const secondsUsedThisMonth = monthSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);

    // Sessions this week
    const sessionsThisWeek = allSessions.filter(s => s.started_at >= weekStart).length;

    // Total practice time
    const totalSeconds = allSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);

    // Fetch recent debriefs (last 5)
    const recentSessionIds = allSessions.slice(0, 5).map(s => s.id);
    let recentDebriefs: { sessionId: string; scores: DebriefReport['scores']; startedAt: string; sessionType: string; personName: string | null }[] = [];

    if (recentSessionIds.length > 0) {
      const { data: debriefRows } = await supabase
        .from('debriefs')
        .select('session_id, report_data')
        .in('session_id', recentSessionIds)
        .eq('pending', false);

      // Fetch person card names for recent sessions
      const personCardIds = [...new Set(allSessions.slice(0, 5).map(s => s.person_card_id).filter(Boolean))];
      const { data: personCards } = personCardIds.length > 0
        ? await supabase.from('person_cards').select('id, card_data').in('id', personCardIds)
        : { data: [] };

      const personNameMap: Record<string, string> = {};
      for (const pc of (personCards ?? [])) {
        const card = pc.card_data as { participantName?: string } | null;
        if (card?.participantName) personNameMap[pc.id] = card.participantName;
      }

      for (const row of (debriefRows ?? [])) {
        try {
          const report = deserialize<DebriefReport>(row.report_data, { documentType: 'DebriefReport', userId: user.id });
          const session = allSessions.find(s => s.id === row.session_id);
          recentDebriefs.push({
            sessionId: row.session_id,
            scores: report.scores,
            startedAt: session?.started_at ?? '',
            sessionType: session?.session_type ?? 'voice',
            personName: session?.person_card_id ? (personNameMap[session.person_card_id] ?? null) : null,
          });
        } catch { /* skip malformed */ }
      }

      // Sort by date desc
      recentDebriefs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    }

    // Avg scores across all debriefs
    let avgScores = null;
    if (recentDebriefs.length > 0) {
      const n = recentDebriefs.length;
      avgScores = {
        openers: Math.round(recentDebriefs.reduce((s, d) => s + d.scores.openers, 0) / n * 10) / 10,
        questionQuality: Math.round(recentDebriefs.reduce((s, d) => s + d.scores.questionQuality, 0) / n * 10) / 10,
        responseRelevance: Math.round(recentDebriefs.reduce((s, d) => s + d.scores.responseRelevance, 0) / n * 10) / 10,
        closing: Math.round(recentDebriefs.reduce((s, d) => s + d.scores.closing, 0) / n * 10) / 10,
      };
    }

    return NextResponse.json({
      totalSessions: allSessions.length,
      sessionsThisWeek,
      totalSeconds,
      usage: {
        secondsUsed: secondsUsedThisMonth,
        secondsLimit: FREE_TIER_SECONDS,
        tier: 'free',
      },
      avgScores,
      recentDebriefs: recentDebriefs.slice(0, 3),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
