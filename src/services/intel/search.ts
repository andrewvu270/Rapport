import { TavilyClient } from 'tavily';

if (!process.env.TAVILY_API_KEY) {
  throw new Error('TAVILY_API_KEY environment variable is not set');
}

const tavilyClient = new TavilyClient({ apiKey: process.env.TAVILY_API_KEY });

/**
 * Searches for publicly available information about a participant using Tavily agentic search.
 * Retrieves news and signals from the past 30 days.
 * 
 * @param name - The participant's name
 * @param company - The participant's company (optional)
 * @returns Array of text snippets from search results
 * @throws Error if search fails
 */
export async function searchParticipant(name: string, company: string = ''): Promise<string[]> {
  try {
    const query = company 
      ? `${name} ${company}` 
      : name;
    
    const response = await tavilyClient.search({
      query,
      search_depth: 'basic',
      max_results: 5,
    });

    // Extract text snippets from results
    const snippets: string[] = [];
    
    if (response.results && Array.isArray(response.results)) {
      for (const result of response.results) {
        if (result.content) {
          snippets.push(result.content);
        }
      }
    }

    return snippets;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Tavily search failed for ${name}: ${error.message}`);
    }
    throw new Error(`Tavily search failed for ${name}: Unknown error`);
  }
}
