import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vapiCallId } = await request.json();
    if (!vapiCallId) {
      return NextResponse.json({ error: 'Missing vapiCallId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('sessions')
      .update({ vapi_call_id: vapiCallId })
      .eq('id', params.sessionId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update call ID' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
