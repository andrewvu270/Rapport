import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { IntelService } from './IntelService';
import { ContextInput } from '../types';

// Mock all external dependencies
vi.mock('./intel/scraper', () => ({
  scrapeUrl: vi.fn(),
}));

vi.mock('./intel/search', () => ({
  searchParticipant: vi.fn(),
}));

vi.mock('./intel/ocr', () => ({
  extractTextFromImage: vi.fn(),
}));

vi.mock('./intel/entityExtractor', () => ({
  extractEntities: vi.fn(),
}));

vi.mock('./intel/embedding', () => ({
  embedChunks: vi.fn(),
}));

vi.mock('./intel/vectorStore', () => ({
  upsertIntel: vi.fn(),
}));

import { scrapeUrl } from './intel/scraper';
import { searchParticipant } from './intel/search';
import { extractTextFromImage } from './intel/ocr';
import { extractEntities } from './intel/entityExtractor';
import { embedChunks } from './intel/embedding';
import { upsertIntel } from './intel/vectorStore';

/**
 * **Feature: network-coach, Property 14: Consent gate on intel pipeline**
 * **Validates: Requirements 9.4, 9.5**
 * 
 * Property: For any context submission where the user has not confirmed the consent notice,
 * the IntelService SHALL not invoke Firecrawl or Tavily, and the result SHALL have
 * degradedMode === true.
 */
describe('IntelService property tests', () => {
  let intelService: IntelService;

  beforeEach(() => {
    intelService = new IntelService();
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(scrapeUrl).mockResolvedValue('scraped content');
    vi.mocked(searchParticipant).mockResolvedValue(['search result']);
    vi.mocked(extractTextFromImage).mockResolvedValue('ocr text');
    vi.mocked(extractEntities).mockResolvedValue({
      participants: [
        {
          name: 'John Doe',
          role: 'Engineer',
          company: 'TechCorp',
          topics: ['AI', 'ML'],
        },
      ],
      companies: ['TechCorp'],
      topics: ['AI', 'ML'],
    });
    vi.mocked(embedChunks).mockResolvedValue([[0.1, 0.2, 0.3]]);
    vi.mocked(upsertIntel).mockResolvedValue(undefined);
  });

  it('Property 14: should not invoke Firecrawl or Tavily when consent is not given', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary context inputs
        fc.record({
          eventType: fc.string({ minLength: 1, maxLength: 50 }),
          industry: fc.string({ minLength: 1, maxLength: 50 }),
          userRole: fc.string({ minLength: 1, maxLength: 50 }),
          userGoal: fc.string({ minLength: 1, maxLength: 100 }),
          targetPeopleDescription: fc.string({ minLength: 1, maxLength: 200 }),
          urls: fc.option(fc.array(fc.webUrl(), { minLength: 1, maxLength: 3 }), { nil: undefined }),
          screenshotStoragePaths: fc.option(
            fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
            { nil: undefined }
          ),
          plainTextNotes: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
        }),
        fc.uuid(), // userId
        fc.uuid(), // contextId
        async (contextInput: ContextInput, userId: string, contextId: string) => {
          // Clear mocks before each property test iteration
          vi.clearAllMocks();
          
          // Reset mock implementations
          vi.mocked(scrapeUrl).mockResolvedValue('scraped content');
          vi.mocked(searchParticipant).mockResolvedValue(['search result']);
          vi.mocked(extractTextFromImage).mockResolvedValue('ocr text');
          vi.mocked(extractEntities).mockResolvedValue({
            participants: [
              {
                name: 'John Doe',
                role: 'Engineer',
                company: 'TechCorp',
                topics: ['AI', 'ML'],
              },
            ],
            companies: ['TechCorp'],
            topics: ['AI', 'ML'],
          });
          vi.mocked(embedChunks).mockResolvedValue([[0.1, 0.2, 0.3]]);
          vi.mocked(upsertIntel).mockResolvedValue(undefined);

          // Call gatherIntel with consentGiven = false
          const result = await intelService.gatherIntel(
            contextInput,
            false, // consentGiven = false
            userId,
            contextId
          );

          // Verify that Firecrawl (scrapeUrl) was NOT called
          const firecrawlNotCalled = vi.mocked(scrapeUrl).mock.calls.length === 0;

          // Verify that Tavily (searchParticipant) was NOT called
          const tavilyNotCalled = vi.mocked(searchParticipant).mock.calls.length === 0;

          // Verify that degradedMode is true
          const degradedModeTrue = result.degradedMode === true;

          return firecrawlNotCalled && tavilyNotCalled && degradedModeTrue;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14 (consent given case): should invoke external APIs when consent is given', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate context inputs with URLs to trigger Firecrawl
        fc.record({
          eventType: fc.string({ minLength: 1, maxLength: 50 }),
          industry: fc.string({ minLength: 1, maxLength: 50 }),
          userRole: fc.string({ minLength: 1, maxLength: 50 }),
          userGoal: fc.string({ minLength: 1, maxLength: 100 }),
          targetPeopleDescription: fc.string({ minLength: 1, maxLength: 200 }),
          urls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 2 }), // Always include URLs
          plainTextNotes: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
        }),
        fc.uuid(), // userId
        fc.uuid(), // contextId
        async (contextInput: ContextInput, userId: string, contextId: string) => {
          // Clear mocks before each property test iteration
          vi.clearAllMocks();
          
          // Reset mock implementations
          vi.mocked(scrapeUrl).mockResolvedValue('scraped content');
          vi.mocked(searchParticipant).mockResolvedValue(['search result']);
          vi.mocked(extractEntities).mockResolvedValue({
            participants: [
              {
                name: 'Jane Smith',
                role: 'Manager',
                company: 'BigCorp',
                topics: ['Leadership'],
              },
            ],
            companies: ['BigCorp'],
            topics: ['Leadership'],
          });
          vi.mocked(embedChunks).mockResolvedValue([[0.1, 0.2, 0.3]]);
          vi.mocked(upsertIntel).mockResolvedValue(undefined);

          // Call gatherIntel with consentGiven = true
          const result = await intelService.gatherIntel(
            contextInput,
            true, // consentGiven = true
            userId,
            contextId
          );

          // Verify that Firecrawl (scrapeUrl) WAS called (since we have URLs)
          const firecrawlCalled = vi.mocked(scrapeUrl).mock.calls.length > 0;

          // Verify that Tavily (searchParticipant) WAS called (since we have participants)
          const tavilyCalled = vi.mocked(searchParticipant).mock.calls.length > 0;

          return firecrawlCalled && tavilyCalled;
        }
      ),
      { numRuns: 100 }
    );
  });
});
