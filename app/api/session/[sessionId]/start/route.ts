/**
 * POST /api/session/[sessionId]/start
 * 
 * Starts a reserved session after user acknowledges disclaimer
 * Initiates Vapi call (voice) or Tavus persona creation (video)
 * 
 * Requirements: 4.1, 5.1, 10.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { PersonCard, ContextInput } from '@/src/types';
import { deserialize } from '@/src/lib/serialization';
import { placeReservation } from '@/src/services/session/minuteReservation';
import { buildSystemPrompt } from '@/src/services/session/promptBuilder';
import { startVapiSession } from '@/src/services/session/vapiSession';
import { startTavusVideoSession } from '@/src/services/session/tavusSession';

export async function POST(
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

    const sessionId = params.sessionId;

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify session is in reserved status
    if (session.status !== 'reserved') {
      return NextResponse.json(
        { error: `Session cannot be started. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    // Fetch person card
    const { data: personCardRow, error: personCardError } = await supabase
      .from('person_cards')
      .select('card_data')
      .eq('id', session.person_card_id)
      .single();

    if (personCardError || !personCardRow) {
      return NextResponse.json(
        { error: 'Person card not found' },
        { status: 404 }
      );
    }

    const persona: PersonCard = deserialize<PersonCard>(personCardRow.card_data);

    // Fetch context
    const { data: contextRow, error: contextError } = await supabase
      .from('contexts')
      .select('raw_input')
      .eq('id', session.context_id)
      .single();

    if (contextError || !contextRow) {
      return NextResponse.json(
        { error: 'Context not found' },
        { status: 404 }
      );
    }

    const contextInput: ContextInput = contextRow.raw_input as ContextInput;

    // Retrieve intel chunks from Pinecone
    // For now, we'll use empty array - intel retrieval will be wired in when vectorStore is integrated
    const intelChunks: string[] = [];
    // TODO: Retrieve from Pinecone using namespace from person_cards.pinecone_namespace

    try {
      // Place minute reservation
      await placeReservation(sessionId, user.id, session.session_type);

      // Build system prompt
      const systemPrompt = buildSystemPrompt(persona, intelChunks, contextInput);

      if (session.session_type === 'voice') {
        // Start Vapi voice session
        const vapiCallId = await startVapiSession(systemPrompt);

        // Update session with Vapi call ID and set to active
        const { error: updateError } = await supabase
          .from('sessions')
          .update({
            vapi_call_id: vapiCallId,
            status: 'active',
            started_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (updateError) {
          throw new Error(`Failed to update session: ${updateError.message}`);
        }

        return NextResponse.json({
          sessionId,
          status: 'active',
        });
      } else {
        // Video session: create Tavus persona + conversation synchronously (v2 API)
        const { conversationId, conversationUrl, personaId } = await startTavusVideoSession(
          persona,
          systemPrompt,
          contextInput
        );

        const { error: updateError } = await supabase
          .from('sessions')
          .update({
            tavus_persona_id: personaId,
            tavus_conversation_id: conversationId,
            tavus_persona_status: 'ready',
            status: 'active',
            started_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (updateError) {
          throw new Error(`Failed to update session: ${updateError.message}`);
        }

        return NextResponse.json({
          sessionId,
          status: 'active',
          sessionUrl: conversationUrl,
        });
      }
    } catch (error) {
      // If anything fails, release the reservation if it was placed
      // Note: releaseReservation handles the case where no reservation exists
      const { releaseReservation } = await import('@/src/services/session/minuteReservation');
      await releaseReservation(sessionId, 0);
      throw error;
    }
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start session' },
      { status: 500 }
    );
  }
}
