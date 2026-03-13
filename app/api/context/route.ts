import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';
import { IntelService } from '@/src/services/IntelService';
import { PrepService } from '@/src/services/PrepService';
import { retrieveIntel } from '@/src/services/intel/vectorStore';
import { embedChunks } from '@/src/services/intel/embedding';
import { serialize } from '@/src/lib/serialization';
import { ContextInput } from '@/src/types';

export const maxDuration = 60;

/**
 * GET /api/context
 * Returns all contexts for the authenticated user with person cards and session counts.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: contexts, error: contextsError } = await supabase
      .from('contexts')
      .select(`
        id,
        event_type,
        industry,
        user_role,
        user_goal,
        mode,
        created_at,
        expires_at,
        person_cards (
          id,
          participant_name,
          limited_research
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (contextsError) {
      return NextResponse.json({ error: 'Failed to fetch contexts' }, { status: 500 });
    }

    const enriched = await Promise.all((contexts || []).map(async (ctx: any) => {
      const personCardIds = (ctx.person_cards || []).map((pc: any) => pc.id);
      const sessionCounts: Record<string, number> = {};

      if (personCardIds.length > 0) {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('person_card_id')
          .in('person_card_id', personCardIds)
          .eq('user_id', user.id)
          .is('parent_session_id', null);

        (sessions || []).forEach((s: any) => {
          sessionCounts[s.person_card_id] = (sessionCounts[s.person_card_id] || 0) + 1;
        });
      }

      const isOpenNetworking = ctx.mode === 'open_networking';
      return {
        id: ctx.id,
        eventType: ctx.event_type,
        industry: ctx.industry,
        userRole: ctx.user_role,
        userGoal: ctx.user_goal,
        mode: ctx.mode,
        createdAt: ctx.created_at,
        expiresAt: ctx.expires_at,
        personCards: (ctx.person_cards || []).map((pc: any) => ({
          id: pc.id,
          participantName: pc.participant_name,
          limitedResearch: pc.limited_research,
          isArchetype: isOpenNetworking,
          sessionCount: sessionCounts[pc.id] || 0,
        })),
      };
    }));

    return NextResponse.json({ contexts: enriched });
  } catch (error) {
    console.error('Error in GET /api/context:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/context
 * Deletes all contexts for the authenticated user.
 */
export async function DELETE(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cascade: delete child records first
    const { data: pcs } = await supabase
      .from('person_cards')
      .select('id')
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
      .eq('user_id', user.id);

    if (error) {
      console.error('Supabase bulk delete error:', error);
      return NextResponse.json({ error: 'Failed to clear library' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/context:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/context
 *
 * Creates a new context, gathers intel, generates prep materials.
 * Validates consent and rejects if not given.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.5, 10.4
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { contextInput, consentGiven, unknownMode } = body as {
      contextInput: ContextInput;
      consentGiven: boolean;
      unknownMode?: boolean;
    };

    // Validate required context input fields (Requirement 1.1)
    if (
      !contextInput.eventType ||
      !contextInput.industry ||
      !contextInput.userRole ||
      !contextInput.userGoal
    ) {
      return NextResponse.json(
        { error: 'Missing required context fields' },
        { status: 400 }
      );
    }

    // In unknown mode, targetPeopleDescription is optional
    if (!unknownMode && !contextInput.targetPeopleDescription) {
      return NextResponse.json(
        { error: 'Missing required context fields' },
        { status: 400 }
      );
    }

    // Generate context ID
    const contextId = crypto.randomUUID();

    // Calculate expiration date (90 days from now - Data Retention Period)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const prepService = new PrepService();

    // --- UNKNOWN MODE: generate archetypal personas, skip intel ---
    if (unknownMode) {
      const archetypeCards = await prepService.generateArchetypes(contextInput);

      const talkingPointsCard = await prepService.generateTalkingPointsCard(
        contextInput, [], [], true
      );

      const { error: contextError } = await supabase
        .from('contexts')
        .insert({
          id: contextId,
          user_id: user.id,
          mode: 'open_networking',
          event_type: contextInput.eventType,
          industry: contextInput.industry,
          user_role: contextInput.userRole,
          user_goal: contextInput.userGoal,
          raw_input: contextInput,
          talking_points_card: serialize(talkingPointsCard, {
            documentType: 'TalkingPointsCard',
            userId: user.id,
          }),
          expires_at: expiresAt.toISOString(),
        });

      if (contextError) {
        console.error('Failed to insert context:', contextError);
        return NextResponse.json({ error: 'Failed to save context' }, { status: 500 });
      }

      for (const card of archetypeCards) {
        await supabase.from('person_cards').insert({
          context_id: contextId,
          user_id: user.id,
          participant_name: card.participantName,
          card_data: serialize(card, { documentType: 'PersonCard', userId: user.id }),
          pinecone_namespace: null,
          limited_research: false,
        });
      }

      return NextResponse.json({ contextId, degradedMode: false, unknownMode: true });
    }

    // --- KNOWN MODE: gather intel, generate real person cards ---

    // Step 1: Gather intel
    const intelService = new IntelService();
    const { participants, degradedMode } = await intelService.gatherIntel(
      contextInput,
      consentGiven,
      user.id,
      contextId
    );

    // Step 2: Generate Talking Points Card

    // Retrieve intel chunks for talking points (aggregate from all participants)
    // eslint-disable-next-line prefer-const
    let talkingPointsIntelChunks: string[] = [];
    if (!degradedMode && participants.length > 0) {
      try {
        // Create a query embedding from the context
        const queryText = `${contextInput.eventType} ${contextInput.industry} ${contextInput.userGoal}`;
        const [queryEmbedding] = await embedChunks([queryText]);

        // Retrieve from each participant's namespace
        for (const participant of participants) {
          const namespace = `${user.id}/${contextId}/${participant.name}`;
          const chunks = await retrieveIntel(namespace, queryEmbedding, 5);
          talkingPointsIntelChunks.push(...chunks);
        }
      } catch (error) {
        console.warn('Failed to retrieve intel chunks for talking points:', error);
      }
    }

    const talkingPointsCard = await prepService.generateTalkingPointsCard(
      contextInput,
      participants,
      talkingPointsIntelChunks,
      degradedMode
    );

    // Step 3: Generate Person Cards for each participant (in parallel)
    const personCards = await Promise.all(participants.map(async (participant) => {
      let personIntelChunks: string[] = [];

      if (!degradedMode) {
        try {
          const queryText = `${participant.name} ${participant.role || ''} ${participant.company || ''}`;
          const [queryEmbedding] = await embedChunks([queryText]);
          const namespace = `${user.id}/${contextId}/${participant.name}`;
          personIntelChunks = await retrieveIntel(namespace, queryEmbedding, 5);
        } catch (error) {
          console.warn(`Failed to retrieve intel chunks for ${participant.name}:`, error);
        }
      }

      const personCard = await prepService.generatePersonCard(
        participant,
        contextInput,
        personIntelChunks,
        degradedMode
      );

      return {
        participant,
        card: personCard,
        namespace: `${user.id}/${contextId}/${participant.name}`,
      };
    }));

    // Step 4: Persist context to Supabase
    const { error: contextError } = await supabase
      .from('contexts')
      .insert({
        id: contextId,
        user_id: user.id,
        mode: 'professional_networking',
        event_type: contextInput.eventType,
        industry: contextInput.industry,
        user_role: contextInput.userRole,
        user_goal: contextInput.userGoal,
        raw_input: contextInput,
        talking_points_card: serialize(talkingPointsCard, {
          documentType: 'TalkingPointsCard',
          userId: user.id,
        }),
        expires_at: expiresAt.toISOString(),
      });

    if (contextError) {
      console.error('Failed to insert context:', contextError);
      return NextResponse.json(
        { error: 'Failed to save context' },
        { status: 500 }
      );
    }

    // Step 5: Persist Person Cards to Supabase
    for (const { participant, card, namespace } of personCards) {
      const { error: cardError } = await supabase
        .from('person_cards')
        .insert({
          context_id: contextId,
          user_id: user.id,
          participant_name: participant.name,
          card_data: serialize(card, {
            documentType: 'PersonCard',
            userId: user.id,
          }),
          pinecone_namespace: namespace,
          limited_research: card.limitedResearch,
        });

      if (cardError) {
        console.error(`Failed to insert person card for ${participant.name}:`, cardError);
        // Continue with other cards even if one fails
      }
    }

    // Return context ID
    return NextResponse.json({
      contextId,
      degradedMode,
    });

  } catch (error) {
    console.error('Error in POST /api/context:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
