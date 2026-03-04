import { claude } from '../../lib/claude';
import { ExtractedEntities } from '../../types';

/**
 * Extracts structured entities (names, roles, companies, topics) from free text using Claude API
 * @param text - The text to analyze
 * @returns Structured ExtractedEntities object
 * @throws Error if Claude API call fails or returns invalid JSON
 */
export async function extractEntities(text: string): Promise<ExtractedEntities> {
  try {
    const prompt = `You are an entity extraction system. Analyze the following text and extract:
1. People's names with their roles and companies (if mentioned)
2. Company names
3. Topics, themes, or areas of interest mentioned

Return your response as a JSON object with this exact structure:
{
  "participants": [
    {
      "name": "Full Name",
      "role": "Job Title or Role (optional)",
      "company": "Company Name (optional)",
      "topics": ["topic1", "topic2"]
    }
  ],
  "companies": ["Company1", "Company2"],
  "topics": ["topic1", "topic2", "topic3"]
}

Text to analyze:
${text}

Return ONLY the JSON object, no additional text or explanation.`;

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

    // Extract text content from Claude response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const responseText = content.text.trim();
    
    // Parse JSON response
    let entities: ExtractedEntities;
    try {
      // Try to extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      entities = JSON.parse(jsonText);
    } catch (parseError) {
      throw new Error(`Failed to parse Claude response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Validate the structure
    if (!entities.participants || !Array.isArray(entities.participants)) {
      throw new Error('Invalid response structure: missing or invalid participants array');
    }
    if (!entities.companies || !Array.isArray(entities.companies)) {
      throw new Error('Invalid response structure: missing or invalid companies array');
    }
    if (!entities.topics || !Array.isArray(entities.topics)) {
      throw new Error('Invalid response structure: missing or invalid topics array');
    }

    // Ensure each participant has required fields
    entities.participants = entities.participants.map((p: any) => ({
      name: p.name || '',
      role: p.role,
      company: p.company,
      topics: Array.isArray(p.topics) ? p.topics : [],
    }));

    return entities;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Entity extraction failed: ${error.message}`);
    }
    throw new Error('Entity extraction failed: Unknown error');
  }
}
