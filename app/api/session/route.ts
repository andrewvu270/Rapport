/**
 * POST /api/session
 * Starts a new practice session (voice or video)
 * Places reservation, returns sessionId and sessionUrl (for video)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { startSession } from '@/src/services/SessionService';
import { PersonCard, ContextInput } from '@/src/types';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { contextId, personCardId, sessionType } = body;

    // Validate required fields
    if (!contextId || !personCardId || !sessionType) {
      return NextResponse.json(
        { error: 'Missing required fields: contextId, personCardId, sessionType' },
        { status: 400 }
      );
    }

    if (sessionType !== 'voice' && sessionType !== 'video') {
      return NextResponse.json(
        { error: 'Invalid sessionType. Must be "voice" or "video"' },
        { status: 400 }
      );
    }

    // Fetch the person card
    const { data: personCardRow, error: personCardError } = await supabase
      .from('person_cards')
      .select('card_data, context_id')
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

    // Create a reserved session (not started yet - user must acknowledge disclaimer first)
    const { data: session, error: createError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        context_id: contextId,
        person_card_id: personCardId,
        session_type: sessionType,
        status: 'reserved',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError || !session) {
      return NextResponse.json(
        { error: `Failed to create session: ${createError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      status: 'reserved',
    });
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start session' },
      { status: 500 }
    );
  }
}
