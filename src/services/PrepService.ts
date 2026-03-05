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
   * Generates a Talking Points Card for the user's context.
   * 
   * @param contextInput - The user's context input
   * @param participants - Extracted participants from intel gathering
   * @param intelChunks - Retrieved intel chunks from Pinecone (optional)
   * @param degradedMode - Whether the system is in degraded mode
   * @returns A TalkingPointsCard with 3-5 openers, 3-5 follow-up questions, and exactly 3 lessons
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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      return JSON.parse(content.text) as Omit<TalkingPointsCard, 'generatedAt' | 'degradedMode'>;
    });

    return {
      ...card,
      generatedAt: new Date().toISOString(),
      degradedMode,
    };
  }

  /**
   * Generates a Person Card for a specific participant.
   * 
   * @param participant - The participant to generate a card for
   * @param intelChunks - Retrieved intel chunks from Pinecone for this participant
   * @param degradedMode - Whether the system is in degraded mode
   * @returns A PersonCard with profile, 3 icebreakers, topics, things to avoid, and suggested ask
   */
  async generatePersonCard(
    participant: ExtractedParticipant,
    intelChunks: string[],
    degradedMode: boolean
  ): Promise<PersonCard> {
    const limitedResearch = intelChunks.length === 0;
    
    const prompt = this.buildPersonCardPrompt(
      participant,
      intelChunks,
      limitedResearch
    );

    const card = await withRetry(async () => {
      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      return JSON.parse(content.text) as Omit<PersonCard, 'generatedAt' | 'limitedResearch'>;
    });

    return {
      ...card,
      limitedResearch,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Builds the prompt for generating a Talking Points Card.
   */
  private buildTalkingPointsPrompt(
    contextInput: ContextInput,
    participants: ExtractedParticipant[],
    intelChunks: string[],
    degradedMode: boolean
  ): string {
    let prompt = `You are an expert networking coach. Generate a Talking Points Card for a user preparing for a professional networking event.

Context:
- Event Type: ${contextInput.eventType}
- Industry: ${contextInput.industry}
- User Role: ${contextInput.userRole}
- User Goal: ${contextInput.userGoal}
- Target People: ${contextInput.targetPeopleDescription}

`;

    if (participants.length > 0) {
      prompt += `Participants:\n`;
      participants.forEach(p => {
        prompt += `- ${p.name}${p.role ? ` (${p.role})` : ''}${p.company ? ` at ${p.company}` : ''}\n`;
      });
      prompt += '\n';
    }

    if (intelChunks.length > 0 && !degradedMode) {
      prompt += `Retrieved Intel:\n${intelChunks.join('\n\n')}\n\n`;
    } else if (degradedMode) {
      prompt += `Note: Limited intel available. Base recommendations on the context provided above.\n\n`;
    }

    prompt += `Generate a Talking Points Card with:
1. Between 3 and 5 conversation openers (each should be specific and intel-grounded when possible)
2. Between 3 and 5 follow-up questions (tailored to the context and participants)
3. Exactly 3 key lessons or reminders for the user

Return ONLY valid JSON in this exact format:
{
  "openers": ["opener1", "opener2", "opener3"],
  "followUpQuestions": ["question1", "question2", "question3"],
  "lessons": ["lesson1", "lesson2", "lesson3"]
}`;

    return prompt;
  }

  /**
   * Builds the prompt for generating a Person Card.
   */
  private buildPersonCardPrompt(
    participant: ExtractedParticipant,
    intelChunks: string[],
    limitedResearch: boolean
  ): string {
    let prompt = `You are an expert networking coach. Generate a Person Card to help a user prepare for a conversation with a specific individual.

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
3. Topics this person likely cares about (array of strings)
4. Things to avoid in conversation (array of strings)
5. A suggested ask or favor that would be appropriate

Return ONLY valid JSON in this exact format:
{
  "participantName": "${participant.name}",
  "profileSummary": "summary text here",
  "icebreakers": ["icebreaker1", "icebreaker2", "icebreaker3"],
  "topicsOfInterest": ["topic1", "topic2"],
  "thingsToAvoid": ["avoid1", "avoid2"],
  "suggestedAsk": "suggested ask text here"
}`;

    return prompt;
  }
}
