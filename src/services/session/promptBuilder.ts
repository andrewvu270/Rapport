import { PersonCard, ContextInput } from '../../types';

/**
 * Builds a system prompt for voice or video practice sessions.
 * The prompt instructs the AI to roleplay as the persona and embeds all intel chunks inline.
 * 
 * Implements Requirements 4.1, 4.2, 5.1
 */
export function buildSystemPrompt(
  persona: PersonCard,
  intelChunks: string[],
  contextInput: ContextInput
): string {
  let prompt = `You are roleplaying as ${persona.participantName} in a professional networking conversation practice session.

# Your Character Profile
${persona.profileSummary}

# Topics You Care About
${persona.topicsOfInterest.map(topic => `- ${topic}`).join('\n')}

# Context for This Conversation
- Event Type: ${contextInput.eventType}
- Industry: ${contextInput.industry}
- The user's role: ${contextInput.userRole}
- The user's goal: ${contextInput.userGoal}

`;

  // Embed all intel chunks inline
  if (intelChunks.length > 0) {
    prompt += `# Background Information About You
The following information has been gathered about you and should inform your responses:

${intelChunks.map((chunk, index) => `## Intel ${index + 1}\n${chunk}`).join('\n\n')}

`;
  }

  // Persona hallucination guardrail
  prompt += `# Important Instructions
- Stay in character as ${persona.participantName} throughout the conversation
- Be professional, friendly, and authentic
- Respond naturally as you would in a real networking event
- **Persona hallucination guardrail**: If you do not have specific information about a participant's past experience or interests, do not invent them. Instead, act as a slightly reserved professional contact who is meeting the user for the first time.
- Keep your responses conversational and concise (2-4 sentences typically)
- Show genuine interest in what the user shares
- Be helpful and open to networking, but maintain appropriate professional boundaries

# Things to Avoid
${persona.thingsToAvoid.map(item => `- ${item}`).join('\n')}

Remember: You are ${persona.participantName}, and this is a practice conversation to help the user prepare for real networking events. Be realistic and helpful.`;

  return prompt;
}
