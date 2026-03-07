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
import { startSession } from '@/src/services/SessionService';
import { PersonCard, ContextInput } from '@/src/types';

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

    const { sessionId: originalSessionId } = params;

    // Fetch the original session
    const { data: originalSession, error: sessionError } = await supabase
      .from('sessions')
      .select('context_id, person_card_id, session_type, user_id')
      .eq('id', originalSessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !originalSession) {
      return NextResponse.json(
        { error: 'Original session not found' },
        { status: 404 }
      );
    }

    const { context_id: contextId, person_card_id: personCardId, session_type: sessionType } = originalSession;

    // Fetch the person card
    const { data: personCardRow, error: personCardError } = await supabase
      .from('person_cards')
      .select('card_data')
      .eq('id', personCardId)
      .eq('user_id', user.id)
      .single();

    if (personCardError || !personCardRow) {
      return NextResponse.json(
        { error: 'Person card not found' },
        { status: 404 }
      );
    }

    const persona: PersonCard = personCardRow.card_data as PersonCard;

    // Fetch the context to get contextInput
    const { data: contextRow, error: contextError } = await supabase
      .from('contexts')
      .select('raw_input')
      .eq('id', contextId)
      .eq('user_id', user.id)
      .single();

    if (contextError || !contextRow) {
      return NextResponse.json(
        { error: 'Context not found' },
        { status: 404 }
      );
    }

    const contextInput: ContextInput = contextRow.raw_input as ContextInput;

    // Retrieve intel chunks from Pinecone for this person
    // For now, we'll use empty array - intel retrieval will be wired in when vectorStore is integrated
    const intelChunks: string[] = [];
    // TODO: Retrieve from Pinecone using namespace from person_cards.pinecone_namespace

    // Start the new session
    const result = await startSession({
      userId: user.id,
      contextId,
      personCardId,
      sessionType,
      persona,
      intelChunks,
      contextInput,
    });

    // Update the new session to link it to the original session
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        parent_session_id: originalSessionId,
      })
      .eq('id', result.sessionId);

    if (updateError) {
      console.error('Failed to set parent_session_id:', updateError);
      // Don't fail the request - the session was created successfully
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error retrying session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry session' },
      { status: 500 }
    );
  }
}
