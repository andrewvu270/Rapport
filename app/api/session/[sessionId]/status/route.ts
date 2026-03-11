/**
 * GET /api/session/[sessionId]/status
 *
 * Polls for session status. For active video sessions, checks Tavus API
 * directly to detect when conversation has ended (webhook fallback).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { endSession } from '@/src/services/SessionService';
import { Transcript } from '@/src/types';

const TAVUS_ENDED_STATUSES = ['ended', 'completed', 'error', 'failed'];

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

    const sessionId = params.sessionId;

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status, tavus_persona_status, session_type, tavus_conversation_id, started_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // For active video sessions, check Tavus API directly as webhook fallback
    if (session.status === 'active' && session.session_type === 'video' && session.tavus_conversation_id) {
      const apiKey = process.env.TAVUS_API_KEY;
      if (apiKey) {
        try {
          const tavusRes = await fetch(`https://tavusapi.com/v2/conversations/${session.tavus_conversation_id}`, {
            headers: { 'x-api-key': apiKey },
          });
          if (tavusRes.ok) {
            const conv = await tavusRes.json();
            const convStatus: string = conv.status ?? conv.conversation_status ?? '';
            console.log('[status] Tavus conv status:', convStatus, JSON.stringify(conv).slice(0, 200));
            if (TAVUS_ENDED_STATUSES.includes(convStatus.toLowerCase())) {
              const durationSeconds = session.started_at
                ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
                : 0;
              const tavusTranscript: { role: string; content: string }[] = conv.transcript ?? [];
              const transcript: Transcript = {
                turns: tavusTranscript.map(t => ({
                  speaker: t.role === 'assistant' || t.role === 'persona' ? 'persona' : 'user',
                  text: t.content ?? '',
                  timestamp: new Date().toISOString(),
                })),
                durationSeconds,
                sessionId,
              };
              await endSession({ sessionId, transcript, durationSeconds });
              return NextResponse.json({ sessionId, status: 'completed', sessionType: session.session_type });
            }
          }
        } catch (err) {
          console.error('[status] Tavus API check failed:', err);
        }
      }
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
