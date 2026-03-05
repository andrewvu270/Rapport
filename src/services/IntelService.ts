import { ContextInput, ExtractedParticipant } from '../types';
import { scrapeUrl } from './intel/scraper';
import { searchParticipant } from './intel/search';
import { extractTextFromImage } from './intel/ocr';
import { extractEntities } from './intel/entityExtractor';
import { embedChunks } from './intel/embedding';
import { upsertIntel } from './intel/vectorStore';

const CHUNK_BUDGET_PER_PERSON = 2000; // Maximum characters per person to prevent token overflow

interface GatherIntelResult {
  participants: ExtractedParticipant[];
  degradedMode: boolean;
}

/**
 * IntelService orchestrates the intel gathering pipeline:
 * 1. Consent check
 * 2. Firecrawl scraping (if URLs provided)
 * 3. Tavily agentic search (if consent given)
 * 4. OCR extraction (if screenshots provided)
 * 5. Entity extraction
 * 6. Embedding
 * 7. Pinecone upsert
 * 
 * Enters Degraded Mode on any external API failure.
 */
export class IntelService {
  /**
   * Gathers intel for a given context input.
   * 
   * @param contextInput - The user's context input
   * @param consentGiven - Whether the user has consented to external intel gathering
   * @param userId - The user's ID (for Pinecone namespace)
   * @param contextId - The context ID (for Pinecone namespace)
   * @returns Object containing extracted participants and degraded mode flag
   */
  async gatherIntel(
    contextInput: ContextInput,
    consentGiven: boolean,
    userId: string,
    contextId: string
  ): Promise<GatherIntelResult> {
    let degradedMode = false;
    let allText = '';

    // Step 1: Consent check - if not given, enter Degraded Mode immediately
    if (!consentGiven) {
      degradedMode = true;
      // Only use user-provided plain text notes
      allText = contextInput.plainTextNotes || '';
      allText += `\n\nEvent Type: ${contextInput.eventType}`;
      allText += `\nIndustry: ${contextInput.industry}`;
      allText += `\nUser Role: ${contextInput.userRole}`;
      allText += `\nUser Goal: ${contextInput.userGoal}`;
      allText += `\nTarget People: ${contextInput.targetPeopleDescription}`;
      
      // Extract entities from user-provided text only
      const entities = await this.extractEntitiesWithFallback(allText);
      return {
        participants: entities.participants,
        degradedMode: true,
      };
    }

    // Step 2: Firecrawl scraping (if URLs provided)
    if (contextInput.urls && contextInput.urls.length > 0) {
      for (const url of contextInput.urls) {
        try {
          const scrapedText = await scrapeUrl(url);
          allText += `\n\n${scrapedText}`;
        } catch (error) {
          console.warn(`Firecrawl scraping failed for ${url}, entering Degraded Mode:`, error);
          degradedMode = true;
        }
      }
    }

    // Step 3: OCR extraction (if screenshots provided)
    if (contextInput.screenshotStoragePaths && contextInput.screenshotStoragePaths.length > 0) {
      for (const storagePath of contextInput.screenshotStoragePaths) {
        try {
          const ocrText = await extractTextFromImage(storagePath);
          allText += `\n\n${ocrText}`;
        } catch (error) {
          console.warn(`OCR extraction failed for ${storagePath}, entering Degraded Mode:`, error);
          degradedMode = true;
        }
      }
    }

    // Add plain text notes if provided
    if (contextInput.plainTextNotes) {
      allText += `\n\n${contextInput.plainTextNotes}`;
    }

    // Add context fields to text
    allText += `\n\nEvent Type: ${contextInput.eventType}`;
    allText += `\nIndustry: ${contextInput.industry}`;
    allText += `\nUser Role: ${contextInput.userRole}`;
    allText += `\nUser Goal: ${contextInput.userGoal}`;
    allText += `\nTarget People: ${contextInput.targetPeopleDescription}`;

    // Step 4: Entity extraction
    const entities = await this.extractEntitiesWithFallback(allText);

    // Step 5: Tavily agentic search for each participant
    const participantsWithIntel: ExtractedParticipant[] = [];
    
    for (const participant of entities.participants) {
      let participantIntel = allText; // Start with base text
      
      try {
        const searchResults = await searchParticipant(
          participant.name,
          participant.company || ''
        );
        
        // Concatenate search results
        if (searchResults.length > 0) {
          participantIntel += '\n\n' + searchResults.join('\n\n');
        }
      } catch (error) {
        console.warn(`Tavily search failed for ${participant.name}, entering Degraded Mode:`, error);
        degradedMode = true;
      }

      // Step 6: Apply chunk budget (truncate to 2,000 characters per person)
      const truncatedIntel = participantIntel.slice(0, CHUNK_BUDGET_PER_PERSON);

      // Step 7: Embed and upsert to Pinecone
      try {
        const chunks = [truncatedIntel]; // Single chunk per person after truncation
        const embeddings = await embedChunks(chunks);
        
        const namespace = `${userId}/${contextId}/${participant.name}`;
        await upsertIntel(namespace, chunks, embeddings);
      } catch (error) {
        console.warn(`Embedding or Pinecone upsert failed for ${participant.name}, entering Degraded Mode:`, error);
        degradedMode = true;
      }

      participantsWithIntel.push(participant);
    }

    return {
      participants: participantsWithIntel,
      degradedMode,
    };
  }

  /**
   * Extracts entities with fallback to empty result on failure.
   * Does not throw - returns empty entities on error.
   */
  private async extractEntitiesWithFallback(text: string): Promise<{
    participants: ExtractedParticipant[];
    companies: string[];
    topics: string[];
  }> {
    try {
      return await extractEntities(text);
    } catch (error) {
      console.warn('Entity extraction failed, returning empty entities:', error);
      return {
        participants: [],
        companies: [],
        topics: [],
      };
    }
  }
}
