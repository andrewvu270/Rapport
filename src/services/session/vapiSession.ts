/**
 * Vapi Voice Session Service
 * Handles voice practice sessions via Vapi API
 */

interface VapiCallResponse {
  id: string;
  status: string;
}

/**
 * Starts a Vapi voice call with the given system prompt
 * @param systemPrompt - The AI persona system prompt
 * @returns The Vapi call ID
 */
export async function startVapiSession(systemPrompt: string): Promise<string> {
  const apiKey = process.env.VAPI_API_KEY;
  
  if (!apiKey) {
    throw new Error('VAPI_API_KEY is not configured');
  }

  const response = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistant: {
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
          ],
        },
        voice: {
          provider: 'elevenlabs',
          voiceId: 'default',
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vapi API error: ${response.status} - ${errorText}`);
  }

  const data: VapiCallResponse = await response.json();
  return data.id;
}
