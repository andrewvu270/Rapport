/**
 * DELETE /api/user
 * 
 * Deletes user account and all associated data
 * Queues Pinecone namespace deletions for background processing
 * 
 * Requirements: 9.1, 9.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/src/lib/supabase-server';

export async function DELETE(_request: NextRequest) {
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

    // Fetch all Pinecone namespaces for this user before deletion
    const { data: personCards, error: personCardsError } = await supabase
      .from('person_cards')
      .select('pinecone_namespace')
      .eq('user_id', user.id);

    if (personCardsError) {
      console.error('Failed to fetch person cards for deletion:', personCardsError);
      return NextResponse.json(
        { error: 'Failed to prepare account deletion' },
        { status: 500 }
      );
    }

    const namespaces = personCards.map(pc => pc.pinecone_namespace);

    // Use service client to queue Pinecone deletions (bypasses RLS)
    const serviceClient = createServiceClient();

    if (namespaces.length > 0) {
      const deletionQueueEntries = namespaces.map(namespace => ({
        pinecone_namespace: namespace,
        user_id: user.id,
        status: 'pending',
        retry_count: 0,
        max_retries: 5,
      }));

      const { error: queueError } = await serviceClient
        .from('pinecone_deletion_queue')
        .insert(deletionQueueEntries);

      if (queueError) {
        console.error('Failed to queue Pinecone deletions:', queueError);
        return NextResponse.json(
          { error: 'Failed to queue vector deletions' },
          { status: 500 }
        );
      }
    }

    // Delete the Supabase auth user
    // This will cascade to all tables via on delete cascade
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Failed to delete user:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Account deleted successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
