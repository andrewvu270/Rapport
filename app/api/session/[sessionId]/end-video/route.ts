import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { endTavusConversation } from '@/src/services/session/tavusSession';

/**
 * POST /api/session/[sessionId]/end-video
 *
 * Signals Tavus to end the conversation.
 * Transcript + debrief are handled by the /webhooks/tavus handler
 * when Tavus fires application.transcription_ready.
 * Client polls /status until session reaches 'completed'.
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

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('tavus_conversation_id, status')
      .eq('id', params.sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed' || session.status === 'interrupted') {
      return NextResponse.json({ alreadyEnded: true });
    }

    if (session.tavus_conversation_id) {
      await endTavusConversation(session.tavus_conversation_id).catch(() => {});
    }

    return NextResponse.json({ pending: true });
  } catch (error) {
    console.error('[end-video] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
