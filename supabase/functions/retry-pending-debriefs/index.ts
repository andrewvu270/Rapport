/**
 * Supabase Edge Function: retry-pending-debriefs
 * 
 * Retries generation of pending debrief reports that failed during initial creation.
 * Scheduled to run every 5 minutes via Supabase cron.
 * 
 * Requirements: 6.6
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Types
interface Transcript {
  turns: TranscriptTurn[];
  durationSeconds: number;
  sessionId: string;
}

interface TranscriptTurn {
  speaker: 'user' | 'persona';
  text: string;
  timestamp: string;
}

interface DebriefReport {
  sessionId: string;
  scores: {
    openers: number;
    questionQuality: number;
    responseRelevance: number;
    closing: number;
  };
  moments: Array<{
    turnIndex: number;
    userText: string;
    suggestion: string;
  }>;
  homework: string[];
  generatedAt: string;
}

interface PendingDebrief {
  id: string;
  session_id: string;
  user_id: string;
  pending_retry_count: number;
  pending_max_retries: number;
}

interface Session {
  transcript: any;
  user_id: string;
}

/**
 * Build the debrief prompt for Claude
 */
function buildDebriefPrompt(transcript: Transcript): string {
  const conversationText = transcript.turns
    .map((turn) => `${turn.speaker === 'user' ? 'User' : 'Persona'}: ${turn.text}`)
    .join('\n\n');

  return `You are an expert networking coach analyzing a practice conversation. Your task is to provide structured feedback.

Analyze the following conversation transcript and provide feedback in JSON format:

${conversationText}

Provide your analysis in the following JSON structure:

{
  "scores": {
    "openers": <number 1-10>,
    "questionQuality": <number 1-10>,
    "responseRelevance": <number 1-10>,
    "closing": <number 1-10>
  },
  "moments": [
    {
      "turnIndex": <number>,
      "userText": "<original user text>",
      "suggestion": "<suggested alternative response>"
    }
  ],
  "homework": [
    "<actionable drill 1>",
    "<actionable drill 2>",
    "<actionable drill 3>"
  ]
}

Scoring criteria (1-10 scale):
- openers: How well did the user start the conversation? Were they engaging and appropriate?
- questionQuality: How thoughtful and relevant were the user's questions?
- responseRelevance: How well did the user respond to the persona's statements?
- closing: How effectively did the user wrap up the conversation?

For "moments", identify up to 3 specific turns where the user could have responded more effectively. Include the turn index (0-based), the original user text, and a suggested alternative.

For "homework", provide exactly 3 actionable drills the user can practice before their next session.

Return ONLY the JSON object, no additional text.`;
}

/**
 * Call Claude API to generate debrief from transcript
 */
async function callClaudeForDebrief(
  transcript: Transcript,
  sessionId: string,
  anthropicApiKey: string
): Promise<DebriefReport> {
  const prompt = buildDebriefPrompt(transcript);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.content.find((c: any) => c.type === 'text');
  
  if (!textContent) {
    throw new Error('Claude API returned no text content');
  }

  const parsedResponse = JSON.parse(textContent.text);

  const debriefReport: DebriefReport = {
    sessionId,
    scores: {
      openers: parsedResponse.scores.openers,
      questionQuality: parsedResponse.scores.questionQuality,
      responseRelevance: parsedResponse.scores.responseRelevance,
      closing: parsedResponse.scores.closing,
    },
    moments: parsedResponse.moments || [],
    homework: parsedResponse.homework,
    generatedAt: new Date().toISOString(),
  };

  return debriefReport;
}

/**
 * Deserialize a JSON string to an object
 */
function deserialize<T>(json: string): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Deserialization failed', { error });
    throw error;
  }
}

/**
 * Serialize an object to a JSON string
 */
function serialize<T>(obj: T): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Serialization failed', { error });
    throw error;
  }
}

serve(async (req) => {
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !anthropicApiKey) {
      throw new Error('Missing required environment variables');
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query pending debriefs that haven't exceeded max retries
    // Note: We select pending_max_retries and filter in-memory since it's a column, not a function
    const { data: allPendingDebriefs, error: queryError } = await supabase
      .from('debriefs')
      .select('id, session_id, user_id, pending_retry_count, pending_max_retries')
      .eq('pending', true)
      .returns<PendingDebrief[]>();

    if (queryError) {
      console.error('Failed to query pending debriefs', { error: queryError });
      throw queryError;
    }

    // Filter to only include debriefs that haven't exceeded max retries
    const pendingDebriefs = allPendingDebriefs?.filter(
      (d) => d.pending_retry_count < d.pending_max_retries
    ) || [];

    if (queryError) {
      console.error('Failed to query pending debriefs', { error: queryError });
      throw queryError;
    }

    if (!pendingDebriefs || pendingDebriefs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending debriefs to retry', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingDebriefs.length} pending debriefs to retry`);

    let successCount = 0;
    let failureCount = 0;

    // Process each pending debrief
    for (const debrief of pendingDebriefs) {
      try {
        // Fetch session transcript
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('transcript, user_id')
          .eq('id', debrief.session_id)
          .single<Session>();

        if (sessionError || !session) {
          console.error('Failed to fetch session', { 
            sessionId: debrief.session_id, 
            error: sessionError 
          });
          
          // Increment retry count on failure
          await supabase
            .from('debriefs')
            .update({ pending_retry_count: debrief.pending_retry_count + 1 })
            .eq('id', debrief.id);
          
          failureCount++;
          continue;
        }

        if (!session.transcript) {
          console.error('Session has no transcript', { sessionId: debrief.session_id });
          
          // Increment retry count on failure
          await supabase
            .from('debriefs')
            .update({ pending_retry_count: debrief.pending_retry_count + 1 })
            .eq('id', debrief.id);
          
          failureCount++;
          continue;
        }

        // Deserialize transcript
        const transcript = deserialize<Transcript>(
          typeof session.transcript === 'string' 
            ? session.transcript 
            : JSON.stringify(session.transcript)
        );

        // Generate debrief report
        const debriefReport = await callClaudeForDebrief(
          transcript,
          debrief.session_id,
          anthropicApiKey
        );

        // Serialize and update debrief record
        const serializedReport = serialize(debriefReport);

        const { error: updateError } = await supabase
          .from('debriefs')
          .update({
            report_data: serializedReport,
            pending: false,
            pending_retry_count: debrief.pending_retry_count,
          })
          .eq('id', debrief.id);

        if (updateError) {
          console.error('Failed to update debrief', { 
            debriefId: debrief.id, 
            error: updateError 
          });
          
          // Increment retry count on failure
          await supabase
            .from('debriefs')
            .update({ pending_retry_count: debrief.pending_retry_count + 1 })
            .eq('id', debrief.id);
          
          failureCount++;
        } else {
          console.log('Successfully generated debrief', { 
            debriefId: debrief.id, 
            sessionId: debrief.session_id 
          });
          successCount++;
        }
      } catch (error) {
        console.error('Error processing pending debrief', { 
          debriefId: debrief.id, 
          error 
        });
        
        // Increment retry count on failure
        await supabase
          .from('debriefs')
          .update({ pending_retry_count: debrief.pending_retry_count + 1 })
          .eq('id', debrief.id);
        
        failureCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Pending debrief retry job completed',
        total: pendingDebriefs.length,
        success: successCount,
        failure: failureCount,
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
