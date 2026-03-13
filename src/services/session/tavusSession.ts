/**
 * Tavus Video Session Service
 * Handles video practice sessions via Tavus CVI API (v2)
 */

import { PersonCard, ContextInput } from '../../types';
import { claude } from '../../lib/claude';

const TAVUS_BASE = 'https://tavusapi.com';

function tavusHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
  };
}

function pickReplicaId(gender?: 'male' | 'female'): string {
  const w = process.env.TAVUS_REPLICA_ID_W;
  const m = process.env.TAVUS_REPLICA_ID_M;
  if (gender === 'male' && m) return m;
  if (gender === 'female' && w) return w;
  const available = [w, m].filter(Boolean) as string[];
  if (available.length === 0) throw new Error('No TAVUS_REPLICA_ID configured');
  return available[Math.floor(Math.random() * available.length)];
}

async function buildGreeting(persona: PersonCard, contextInput: ContextInput): Promise<string> {
  const firstName = persona.participantName.split(' ')[0];
  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Write a single casual opening line that ${persona.participantName} would say when first meeting someone at a ${contextInput.eventType}.

About ${firstName}:
${persona.profileSummary}

Their interests: ${persona.topicsOfInterest.slice(0, 2).map(t => t.topic).join(', ')}

Rules:
- 1-2 sentences max, no more
- Casual and warm, like talking to a stranger at an event
- Reference something specific about who ${firstName} is or what they do — NOT generic small talk
- Do NOT start with just "Hi" or "Hey" alone — lead with something real, THEN introduce yourself by first name
- No questions yet — just the opener
- Return only the greeting text, nothing else`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) return text;
  } catch (err) {
    console.error('[Tavus] Failed to generate greeting, using fallback:', err);
  }

  // Fallback if Claude call fails
  return `Hey, I'm ${firstName}! Great energy here today — glad I made it out.`;
}

/**
 * Creates a Tavus persona then immediately starts a conversation.
 * Returns conversationId and conversationUrl synchronously (v2 API is not async).
 */
export async function startTavusVideoSession(
  persona: PersonCard,
  systemPrompt: string,
  contextInput: ContextInput
): Promise<{ conversationId: string; conversationUrl: string; personaId: string }> {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) throw new Error('TAVUS_API_KEY is not configured');

  // Generate greeting and create Tavus persona in parallel to save time
  const [greeting, personaRes] = await Promise.all([
    buildGreeting(persona, contextInput),
    fetch(`${TAVUS_BASE}/v2/personas`, {
      method: 'POST',
      headers: tavusHeaders(apiKey),
      body: JSON.stringify({
        persona_name: persona.participantName,
        system_prompt: systemPrompt,
      }),
    }),
  ]);

  if (!personaRes.ok) {
    const err = await personaRes.text();
    throw new Error(`Tavus persona creation failed: ${personaRes.status} - ${err}`);
  }

  const personaData = await personaRes.json();
  const personaId: string = personaData.persona_id;

  // Create conversation with replica
  const baseCallbackUrl = process.env.TAVUS_WEBHOOK_URL;
  const webhookSecret = process.env.TAVUS_WEBHOOK_SECRET;
  let callbackUrl = baseCallbackUrl;
  if (baseCallbackUrl && webhookSecret) {
    const url = new URL(baseCallbackUrl);
    url.searchParams.set('secret', webhookSecret);
    callbackUrl = url.toString();
  }
  const convBody: Record<string, unknown> = {
    replica_id: pickReplicaId(persona.replicaGender),
    persona_id: personaId,
    custom_greeting: greeting,
    max_call_duration: 300,
  };
  if (callbackUrl) {
    convBody.callback_url = callbackUrl;
  }

  const convRes = await fetch(`${TAVUS_BASE}/v2/conversations`, {
    method: 'POST',
    headers: tavusHeaders(apiKey),
    body: JSON.stringify(convBody),
  });

  if (!convRes.ok) {
    const err = await convRes.text();
    throw new Error(`Tavus conversation creation failed: ${convRes.status} - ${err}`);
  }

  const conv = await convRes.json();

  return {
    conversationId: conv.conversation_id,
    conversationUrl: conv.conversation_url,
    personaId,
  };
}

/**
 * Ends an active Tavus conversation.
 */
export async function endTavusConversation(conversationId: string): Promise<void> {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) throw new Error('TAVUS_API_KEY is not configured');

  await fetch(`${TAVUS_BASE}/v2/conversations/${conversationId}/end`, {
    method: 'POST',
    headers: tavusHeaders(apiKey),
  });
}
