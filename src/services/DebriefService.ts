/**
 * DebriefService
 * 
 * Generates structured feedback reports after practice sessions
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { claude } from '../lib/claude';
import { serialize, deserialize } from '../lib/serialization';
import { withRetry } from '../lib/retry';
import { createServiceClient } from '../lib/supabase-server';
import type { DebriefReport, Transcript } from '@/src/types';

export class DebriefService {
  /**
   * Generate a debrief report from a session transcript
   * 
   * Requirements:
   * - 6.1: Generate debrief within 30 seconds
   * - 6.2: Score across four dimensions (1-10 scale)
   * - 6.3: Identify up to 3 improvable moments
   * - 6.4: Produce exactly 3 actionable homework drills
   * - 6.5: Persist via Serialization Standard
   * - 6.6: On failure, insert pending debrief for retry
   * 
   * @param sessionId - The session ID to generate debrief for
   * @returns The generated debrief report
   */
  async generateDebrief(sessionId: string): Promise<DebriefReport> {
    const supabase = createServiceClient();

    // Read transcript from sessions row
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('transcript, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Failed to fetch session: ${sessionError?.message || 'Session not found'}`);
    }

    if (!session.transcript) {
      throw new Error('Session has no transcript');
    }

    const transcript = deserialize<Transcript>(
      typeof session.transcript === 'string' ? session.transcript : JSON.stringify(session.transcript),
      { documentType: 'Transcript', userId: session.user_id }
    );

    try {
      // Call Claude API with retry wrapper
      const debriefReport = await withRetry(async () => {
        return await this.callClaudeForDebrief(transcript, sessionId);
      });

      // Persist debrief report via Serialization Standard
      const serializedReport = serialize(debriefReport, {
        documentType: 'DebriefReport',
        userId: session.user_id,
      });

      const { error: insertError } = await supabase
        .from('debriefs')
        .insert({
          session_id: sessionId,
          user_id: session.user_id,
          report_data: serializedReport,
          pending: false,
          pending_retry_count: 0,
        });

      if (insertError) {
        console.error('Failed to persist debrief report', { error: insertError });
        throw new Error(`Failed to persist debrief: ${insertError.message}`);
      }

      return debriefReport;
    } catch (error) {
      // On Claude failure: insert debriefs row with pending: true, pending_retry_count: 0
      console.error('Failed to generate debrief, marking as pending', { error, sessionId });

      const { error: pendingError } = await supabase
        .from('debriefs')
        .insert({
          session_id: sessionId,
          user_id: session.user_id,
          report_data: serialize({}, { documentType: 'DebriefReport', userId: session.user_id }),
          pending: true,
          pending_retry_count: 0,
        });

      if (pendingError) {
        console.error('Failed to insert pending debrief', { error: pendingError });
      }

      throw error;
    }
  }

  /**
   * Call Claude API to generate debrief from transcript
   * 
   * @param transcript - The session transcript
   * @param sessionId - The session ID
   * @returns The generated debrief report
   */
  private async callClaudeForDebrief(
    transcript: Transcript,
    sessionId: string
  ): Promise<DebriefReport> {
    const prompt = this.buildDebriefPrompt(transcript);

    const response = await claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Claude API returned no text content');
    }

    const parsedResponse = JSON.parse(textContent.text);

    // Construct the debrief report
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
   * Build the debrief prompt for Claude
   * 
   * @param transcript - The session transcript
   * @returns The prompt string
   */
  private buildDebriefPrompt(transcript: Transcript): string {
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
}
