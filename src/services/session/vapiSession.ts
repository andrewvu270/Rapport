/**
 * Vapi Voice Session Service
 * Handles voice practice sessions via Vapi API
 */

interface VapiCallResponse {
  id: string;
  status: string;
  webCallUrl?: string;
}

/**
 * Starts a Vapi web call with the given system prompt.
 * Returns the call ID and the webCallUrl (Daily.co URL) for embedding.
 */
export async function startVapiSession(systemPrompt: string): Promise<{ callId: string; webCallUrl: string }> {
  const apiKey = process.env.VAPI_API_KEY;

  if (!apiKey) {
    throw new Error('VAPI_API_KEY is not configured');
  }

  const response = await fetch('https://api.vapi.ai/call/web', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistant: {
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: 'EXAVITQu4vr4xnSDxMaL', // "Sarah" — clear, natural
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vapi API error: ${response.status} - ${errorText}`);
  }

  const data: VapiCallResponse = await response.json();

  if (!data.webCallUrl) {
    throw new Error('Vapi did not return a webCallUrl for this web call');
  }

  return { callId: data.id, webCallUrl: data.webCallUrl };
}
