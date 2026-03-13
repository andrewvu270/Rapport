import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { deserialize } from '@/src/lib/serialization';
import { TalkingPointsCard, PersonCard } from '@/src/types';

/**
 * GET /api/context/[contextId]
 * 
 * Fetches and deserializes context, talking points card, and all person cards
 * for the authenticated user.
 * 
 * Requirements: 3.5
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { contextId: string } }
) {
  try {
    const supabase = createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { contextId } = params;

    // Fetch context from Supabase
    const { data: context, error: contextError } = await supabase
      .from('contexts')
      .select('*')
      .eq('id', contextId)
      .eq('user_id', user.id)
      .single();

    if (contextError || !context) {
      return NextResponse.json(
        { error: 'Context not found' },
        { status: 404 }
      );
    }

    // Deserialize talking points card
    let talkingPointsCard: TalkingPointsCard | null = null;
    if (context.talking_points_card) {
      try {
        talkingPointsCard = deserialize<TalkingPointsCard>(
          context.talking_points_card,
          {
            documentType: 'TalkingPointsCard',
            userId: user.id,
          }
        );
      } catch (error) {
        console.error('Failed to deserialize talking points card:', error);
      }
    }

    // Fetch person cards from Supabase
    const { data: personCardRows, error: cardsError } = await supabase
      .from('person_cards')
      .select('*')
      .eq('context_id', contextId)
      .eq('user_id', user.id);

    if (cardsError) {
      console.error('Failed to fetch person cards:', cardsError);
      return NextResponse.json(
        { error: 'Failed to fetch person cards' },
        { status: 500 }
      );
    }

    // Deserialize person cards
    const personCards = (personCardRows || [])
      .map((row) => {
        try {
          const card = deserialize<PersonCard>(
            row.card_data,
            {
              documentType: 'PersonCard',
              userId: user.id,
            }
          );
          return {
            id: row.id,
            participantName: row.participant_name,
            card,
            limitedResearch: row.limited_research,
          };
        } catch (error) {
          console.error(`Failed to deserialize person card for ${row.participant_name}:`, error);
          return null;
        }
      })
      .filter((card) => card !== null);

    // Return context data
    return NextResponse.json({
      contextId: context.id,
      mode: context.mode,
      eventType: context.event_type,
      industry: context.industry,
      userRole: context.user_role,
      userGoal: context.user_goal,
      rawInput: context.raw_input,
      talkingPointsCard,
      personCards,
      createdAt: context.created_at,
      expiresAt: context.expires_at,
    });

  } catch (error) {
    console.error('Error in GET /api/context/[contextId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/context/[contextId]
 * Deletes a single context for the authenticated user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { contextId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cascade: delete child records first (sessions/debriefs/person_cards)
    const { data: pcs } = await supabase
      .from('person_cards')
      .select('id')
      .eq('context_id', params.contextId)
      .eq('user_id', user.id);

    const pcIds = (pcs || []).map((pc: any) => pc.id);
    if (pcIds.length > 0) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('id')
        .in('person_card_id', pcIds)
        .eq('user_id', user.id);
      const sessIds = (sess || []).map((s: any) => s.id);
      if (sessIds.length > 0) {
        await supabase.from('debriefs').delete().in('session_id', sessIds);
      }
      await supabase.from('sessions').delete().in('person_card_id', pcIds).eq('user_id', user.id);
      await supabase.from('person_cards').delete().in('id', pcIds).eq('user_id', user.id);
    }

    const { error } = await supabase
      .from('contexts')
      .delete()
      .eq('id', params.contextId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Supabase context delete error:', error);
      return NextResponse.json({ error: 'Failed to delete context' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/context/[contextId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
