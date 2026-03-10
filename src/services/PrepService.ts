import { claude } from '../lib/claude';
import { withRetry } from '../lib/retry';
import {
  ContextInput,
  ExtractedParticipant,
  TalkingPointsCard,
  PersonCard,
} from '../types';

/**
 * PrepService generates Talking Points Cards and Person Cards using Claude API.
 * Implements Requirements 3.1, 3.2, 3.3, 3.4
 */
export class PrepService {
  /**
   * Generates a Talking Points Card (event-level key lessons only).
   */
  async generateTalkingPointsCard(
    contextInput: ContextInput,
    participants: ExtractedParticipant[],
    intelChunks: string[],
    degradedMode: boolean
  ): Promise<TalkingPointsCard> {
    const prompt = this.buildTalkingPointsPrompt(
      contextInput,
      participants,
      intelChunks,
      degradedMode
    );

    const card = await withRetry(async () => {
      const response = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const jsonMatch = content.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : content.text;
      return JSON.parse(jsonText) as Omit<TalkingPointsCard, 'generatedAt' | 'degradedMode'>;
    });

    return {
      ...card,
      generatedAt: new Date().toISOString(),
      degradedMode,
    };
  }

  /**
   * Generates a Person Card for a specific participant, including
   * openers and follow-up questions tailored to that person.
   */
  async generatePersonCard(
    participant: ExtractedParticipant,
    contextInput: ContextInput,
    intelChunks: string[],
    degradedMode: boolean
  ): Promise<PersonCard> {
    const limitedResearch = intelChunks.length === 0;

    const prompt = this.buildPersonCardPrompt(
      participant,
      contextInput,
      intelChunks,
      limitedResearch
    );

    const card = await withRetry(async () => {
      const response = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const jsonMatch = content.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : content.text;
      return JSON.parse(jsonText) as Omit<PersonCard, 'generatedAt' | 'limitedResearch'>;
    });

    return {
      ...card,
      limitedResearch,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Builds the prompt for generating event-level key lessons.
   */
  private buildTalkingPointsPrompt(
    contextInput: ContextInput,
    participants: ExtractedParticipant[],
    intelChunks: string[],
    degradedMode: boolean
  ): string {
    let prompt = `You are an expert networking coach. Generate 3 key lessons or mindset reminders for a user preparing for a ${contextInput.eventType}.

Context:
- Industry: ${contextInput.industry}
- User Role: ${contextInput.userRole}
- User Goal: ${contextInput.userGoal}
- Target People: ${contextInput.targetPeopleDescription}
`;

    if (participants.length > 0) {
      prompt += `\nParticipants:\n`;
      participants.forEach(p => {
        prompt += `- ${p.name}${p.role ? ` (${p.role})` : ''}${p.company ? ` at ${p.company}` : ''}\n`;
      });
    }

    if (degradedMode) {
      prompt += `\nNote: Limited intel available. Base recommendations on the context provided above.\n`;
    } else if (intelChunks.length > 0) {
      prompt += `\nRetrieved Intel:\n${intelChunks.join('\n\n')}\n`;
    }

    prompt += `
These lessons should be actionable reminders — things the user should keep in mind across ALL conversations at this event (not specific to any one person).

Return ONLY valid JSON in this exact format:
{
  "lessons": ["lesson1", "lesson2", "lesson3"]
}`;

    return prompt;
  }

  /**
   * Builds the prompt for generating a Person Card with per-person openers and follow-ups.
   */
  private buildPersonCardPrompt(
    participant: ExtractedParticipant,
    contextInput: ContextInput,
    intelChunks: string[],
    limitedResearch: boolean
  ): string {
    let prompt = `You are an expert networking coach. Generate a Person Card to help a user prepare for a conversation with a specific individual at a ${contextInput.eventType}.

User context:
- User Role: ${contextInput.userRole}
- User Goal: ${contextInput.userGoal}
- Industry: ${contextInput.industry}

Participant:
- Name: ${participant.name}
${participant.role ? `- Role: ${participant.role}` : ''}
${participant.company ? `- Company: ${participant.company}` : ''}
${participant.topics.length > 0 ? `- Known Topics: ${participant.topics.join(', ')}` : ''}

`;

    if (intelChunks.length > 0) {
      prompt += `Retrieved Intel:\n${intelChunks.join('\n\n')}\n\n`;
      prompt += `Generate a Person Card with intel-grounded content:\n`;
    } else {
      prompt += `Note: Limited intel available. Generate a professional Person Card based on the basic information provided.\n\n`;
      prompt += `Generate a Person Card with general professional guidance:\n`;
    }

    prompt += `1. A plain-English profile summary (2-3 sentences)
2. Exactly 3 tailored icebreakers${intelChunks.length > 0 ? ' (each based on specific intel like recent posts, company news, or shared interests)' : ' (professional and appropriate for a first meeting)'}
3. Between 3 and 5 conversation openers the user could say to ${participant.name} — specific to this person, referencing their role/company/background. Each opener should address ${participant.name} by name naturally.
4. Between 3 and 5 follow-up questions tailored to ${participant.name}'s background and the user's goal.
5. Topics this person likely cares about (array of strings)
6. Things to avoid in conversation with this person (array of strings)
7. A suggested ask or favor appropriate for this specific person
8. replicaGender: infer "male" or "female" from the participant's name and any profile information. Default to "female" if uncertain.

Return ONLY valid JSON in this exact format:
{
  "participantName": "${participant.name}",
  "profileSummary": "summary text here",
  "icebreakers": ["icebreaker1", "icebreaker2", "icebreaker3"],
  "openers": ["opener1", "opener2", "opener3"],
  "followUpQuestions": ["question1", "question2", "question3"],
  "topicsOfInterest": ["topic1", "topic2"],
  "thingsToAvoid": ["avoid1", "avoid2"],
  "suggestedAsk": "suggested ask text here",
  "replicaGender": "male"
}`;

    return prompt;
  }
}
