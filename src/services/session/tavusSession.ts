/**
 * Tavus Video Session Service
 * Handles video practice sessions via Tavus CVI API
 */

interface TavusPersonaResponse {
  persona_id: string;
  status: 'creating' | 'ready' | 'failed';
}

interface TavusConversationResponse {
  conversation_id: string;
  conversation_url: string;
}

/**
 * Creates a Tavus persona with the given system prompt and intel chunks
 * Initiates async persona creation
 * @param systemPrompt - The AI persona system prompt
 * @param intelChunks - Array of intel text chunks to inject into persona knowledge base
 * @returns Object with personaId and status 'creating'
 */
export async function createTavusPersona(
  systemPrompt: string,
  intelChunks: string[]
): Promise<{ personaId: string; status: 'creating' }> {
  const apiKey = process.env.TAVUS_API_KEY;
  
  if (!apiKey) {
    throw new Error('TAVUS_API_KEY is not configured');
  }

  const response = await fetch('https://api.tavus.io/v1/personas', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_prompt: systemPrompt,
      knowledge_base: intelChunks.join('\n\n'),
      replica_id: process.env.TAVUS_REPLICA_ID || 'default',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavus API error: ${response.status} - ${errorText}`);
  }

  const data: TavusPersonaResponse = await response.json();
  
  return {
    personaId: data.persona_id,
    status: 'creating',
  };
}

/**
 * Checks the status of a Tavus persona creation
 * @param personaId - The persona ID to check
 * @returns Object with current status
 */
export async function checkPersonaStatus(
  personaId: string
): Promise<{ status: 'creating' | 'ready' | 'failed' }> {
  const apiKey = process.env.TAVUS_API_KEY;
  
  if (!apiKey) {
    throw new Error('TAVUS_API_KEY is not configured');
  }

  const response = await fetch(`https://api.tavus.io/v1/personas/${personaId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavus API error: ${response.status} - ${errorText}`);
  }

  const data: TavusPersonaResponse = await response.json();
  
  return {
    status: data.status,
  };
}

/**
 * Starts a Tavus CVI session with a ready persona
 * Should only be called when persona status is 'ready'
 * @param personaId - The ready persona ID
 * @returns Object with conversationId and sessionUrl
 */
export async function startTavusSession(
  personaId: string
): Promise<{ conversationId: string; sessionUrl: string }> {
  const apiKey = process.env.TAVUS_API_KEY;
  
  if (!apiKey) {
    throw new Error('TAVUS_API_KEY is not configured');
  }

  const response = await fetch('https://api.tavus.io/v1/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      persona_id: personaId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavus API error: ${response.status} - ${errorText}`);
  }

  const data: TavusConversationResponse = await response.json();
  
  return {
    conversationId: data.conversation_id,
    sessionUrl: data.conversation_url,
  };
}
