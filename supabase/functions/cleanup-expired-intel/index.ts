/**
 * Supabase Edge Function: cleanup-expired-intel
 * 
 * Deletes expired contexts and person_cards, and queues Pinecone namespace deletions.
 * Scheduled to run daily via Supabase cron.
 * 
 * Requirements: 9.2
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface PersonCard {
  id: string;
  pinecone_namespace: string;
  user_id: string;
}

interface Context {
  id: string;
  user_id: string;
}

serve(async (req) => {
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find expired contexts
    const { data: expiredContexts, error: contextsError } = await supabase
      .from('contexts')
      .select('id, user_id')
      .lt('expires_at', new Date().toISOString())
      .returns<Context[]>();

    if (contextsError) {
      console.error('Failed to query expired contexts', { error: contextsError });
      throw contextsError;
    }

    if (!expiredContexts || expiredContexts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired intel to clean up', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredContexts.length} expired contexts to clean up`);

    const contextIds = expiredContexts.map(c => c.id);

    // Find all person_cards associated with expired contexts
    const { data: personCards, error: personCardsError } = await supabase
      .from('person_cards')
      .select('id, pinecone_namespace, user_id')
      .in('context_id', contextIds)
      .returns<PersonCard[]>();

    if (personCardsError) {
      console.error('Failed to query person cards for expired contexts', { error: personCardsError });
      throw personCardsError;
    }

    let queuedDeletions = 0;

    // Queue Pinecone namespace deletions for each person card
    if (personCards && personCards.length > 0) {
      const deletionQueueEntries = personCards.map(pc => ({
        pinecone_namespace: pc.pinecone_namespace,
        user_id: pc.user_id,
        status: 'pending',
        retry_count: 0,
        max_retries: 5,
      }));

      const { error: queueError } = await supabase
        .from('pinecone_deletion_queue')
        .insert(deletionQueueEntries);

      if (queueError) {
        console.error('Failed to queue Pinecone deletions', { error: queueError });
        throw queueError;
      }

      queuedDeletions = deletionQueueEntries.length;
      console.log(`Queued ${queuedDeletions} Pinecone namespace deletions`);
    }

    // Delete person_cards (will cascade from context deletion, but explicit for clarity)
    if (personCards && personCards.length > 0) {
      const { error: deletePersonCardsError } = await supabase
        .from('person_cards')
        .delete()
        .in('context_id', contextIds);

      if (deletePersonCardsError) {
        console.error('Failed to delete person cards', { error: deletePersonCardsError });
        throw deletePersonCardsError;
      }

      console.log(`Deleted ${personCards.length} person cards`);
    }

    // Delete expired contexts
    const { error: deleteContextsError } = await supabase
      .from('contexts')
      .delete()
      .in('id', contextIds);

    if (deleteContextsError) {
      console.error('Failed to delete expired contexts', { error: deleteContextsError });
      throw deleteContextsError;
    }

    console.log(`Deleted ${expiredContexts.length} expired contexts`);

    return new Response(
      JSON.stringify({
        message: 'Expired intel cleanup completed',
        contextsDeleted: expiredContexts.length,
        personCardsDeleted: personCards?.length || 0,
        pineconeNamespacesQueued: queuedDeletions,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error', { error });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
