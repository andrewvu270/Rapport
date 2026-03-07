/**
 * Supabase Edge Function: process-pinecone-deletions
 * 
 * Processes queued Pinecone namespace deletions.
 * Scheduled to run every 5 minutes via Supabase cron.
 * 
 * Requirements: 9.1, 9.2
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface PendingDeletion {
  id: string;
  pinecone_namespace: string;
  user_id: string | null;
  retry_count: number;
  max_retries: number;
}

/**
 * Delete a namespace from Pinecone
 */
async function deletePineconeNamespace(
  namespace: string,
  pineconeApiKey: string,
  pineconeEnvironment: string,
  pineconeIndex: string
): Promise<void> {
  const url = `https://${pineconeIndex}-${pineconeEnvironment}.svc.pinecone.io/vectors/delete`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': pineconeApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deleteAll: true,
      namespace: namespace,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinecone deletion failed: ${response.status} ${errorText}`);
  }
}

serve(async (req) => {
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
    const pineconeEnvironment = Deno.env.get('PINECONE_ENVIRONMENT');
    const pineconeIndex = Deno.env.get('PINECONE_INDEX');

    if (!supabaseUrl || !supabaseServiceKey || !pineconeApiKey || !pineconeEnvironment || !pineconeIndex) {
      throw new Error('Missing required environment variables');
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query pending deletions
    const { data: pendingDeletions, error: queryError } = await supabase
      .from('pinecone_deletion_queue')
      .select('id, pinecone_namespace, user_id, retry_count, max_retries')
      .eq('status', 'pending')
      .returns<PendingDeletion[]>();

    if (queryError) {
      console.error('Failed to query pending deletions', { error: queryError });
      throw queryError;
    }

    if (!pendingDeletions || pendingDeletions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending deletions to process', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingDeletions.length} pending deletions to process`);

    let successCount = 0;
    let failureCount = 0;
    let permanentFailureCount = 0;

    // Process each pending deletion
    for (const deletion of pendingDeletions) {
      try {
        // Check if we've exceeded max retries
        if (deletion.retry_count >= deletion.max_retries) {
          console.error('Deletion permanently failed after max retries', {
            deletionId: deletion.id,
            namespace: deletion.pinecone_namespace,
            retryCount: deletion.retry_count,
          });

          // Mark as failed for manual review
          await supabase
            .from('pinecone_deletion_queue')
            .update({
              status: 'failed',
              last_error: `Permanently failed after ${deletion.max_retries} retries`,
              processed_at: new Date().toISOString(),
            })
            .eq('id', deletion.id);

          permanentFailureCount++;
          continue;
        }

        // Attempt to delete the namespace
        await deletePineconeNamespace(
          deletion.pinecone_namespace,
          pineconeApiKey,
          pineconeEnvironment,
          pineconeIndex
        );

        // Mark as processed
        const { error: updateError } = await supabase
          .from('pinecone_deletion_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', deletion.id);

        if (updateError) {
          console.error('Failed to mark deletion as processed', {
            deletionId: deletion.id,
            error: updateError,
          });
          failureCount++;
        } else {
          console.log('Successfully deleted namespace', {
            deletionId: deletion.id,
            namespace: deletion.pinecone_namespace,
          });
          successCount++;
        }
      } catch (error) {
        console.error('Error processing deletion', {
          deletionId: deletion.id,
          namespace: deletion.pinecone_namespace,
          error,
        });

        // Increment retry count and update last error
        await supabase
          .from('pinecone_deletion_queue')
          .update({
            retry_count: deletion.retry_count + 1,
            last_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', deletion.id);

        failureCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Pinecone deletion job completed',
        total: pendingDeletions.length,
        success: successCount,
        failure: failureCount,
        permanentFailure: permanentFailureCount,
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
