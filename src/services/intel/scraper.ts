import FirecrawlApp from '@mendable/firecrawl-js';

if (!process.env.FIRECRAWL_API_KEY) {
  throw new Error('FIRECRAWL_API_KEY environment variable is not set');
}

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

/**
 * Scrapes a URL using Firecrawl and returns extracted markdown text
 * @param url - The URL to scrape
 * @returns Extracted markdown text
 * @throws Error if scraping fails or returns no usable content
 */
export async function scrapeUrl(url: string): Promise<string> {
  try {
    const result = await firecrawl.scrape(url, {
      formats: ['markdown'],
    });

    // Firecrawl returns a Document object with markdown property
    const markdown = result.markdown;
    
    if (!markdown || markdown.trim().length === 0) {
      throw new Error(`No usable content extracted from URL: ${url}`);
    }

    return markdown;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scrape URL ${url}: ${error.message}`);
    }
    throw new Error(`Failed to scrape URL ${url}: Unknown error`);
  }
}
