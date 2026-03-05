import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PrepService } from './PrepService';
import type { ContextInput, ExtractedParticipant, TalkingPointsCard, PersonCard } from '@/src/types';
import { claude } from '../lib/claude';

// Mock the Claude API
vi.mock('../lib/claude', () => ({
  claude: {
    messages: {
      create: vi.fn(),
    },
  },
}));

/**
 * **Feature: network-coach, Property 1: TalkingPointsCard structural invariant**
 * **Validates: Requirements 3.1**
 * 
 * Property: For any valid context input, the generated TalkingPointsCard SHALL have
 * openers.length in [3, 5], followUpQuestions.length in [3, 5], and lessons.length === 3.
 */
describe('TalkingPointsCard structural invariant', () => {
  let prepService: PrepService;

  beforeEach(() => {
    prepService = new PrepService();
    vi.clearAllMocks();
  });

  // Arbitrary generator for ContextInput
  const contextInputArbitrary = fc.record({
    eventType: fc.string({ minLength: 1 }),
    industry: fc.string({ minLength: 1 }),
    userRole: fc.string({ minLength: 1 }),
    userGoal: fc.string({ minLength: 1 }),
    targetPeopleDescription: fc.string({ minLength: 1 }),
    urls: fc.option(fc.array(fc.webUrl()), { nil: undefined }),
    screenshotStoragePaths: fc.option(fc.array(fc.string()), { nil: undefined }),
    plainTextNotes: fc.option(fc.string(), { nil: undefined }),
  });

  // Arbitrary generator for ExtractedParticipant
  const participantArbitrary = fc.record({
    name: fc.string({ minLength: 1 }),
    role: fc.option(fc.string(), { nil: undefined }),
    company: fc.option(fc.string(), { nil: undefined }),
    topics: fc.array(fc.string()),
  });

  it('Property 1: TalkingPointsCard has correct structural invariants', async () => {
    await fc.assert(
      fc.asyncProperty(
        contextInputArbitrary,
        fc.array(participantArbitrary),
        fc.array(fc.string()),
        fc.boolean(),
        async (contextInput, participants, intelChunks, degradedMode) => {
          // Mock Claude API response with valid structure
          const mockOpeners = fc.sample(
            fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 5 }),
            1
          )[0];
          const mockFollowUpQuestions = fc.sample(
            fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 5 }),
            1
          )[0];
          const mockLessons = fc.sample(
            fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 3 }),
            1
          )[0];

          const mockResponse = {
            openers: mockOpeners,
            followUpQuestions: mockFollowUpQuestions,
            lessons: mockLessons,
          };

          vi.mocked(claude.messages.create).mockResolvedValue({
            content: [
              {
                type: 'text',
                text: JSON.stringify(mockResponse),
              },
            ],
          } as any);

          // Generate the card
          const card = await prepService.generateTalkingPointsCard(
            contextInput,
            participants,
            intelChunks,
            degradedMode
          );

          // Verify structural invariants
          expect(card.openers.length).toBeGreaterThanOrEqual(3);
          expect(card.openers.length).toBeLessThanOrEqual(5);
          
          expect(card.followUpQuestions.length).toBeGreaterThanOrEqual(3);
          expect(card.followUpQuestions.length).toBeLessThanOrEqual(5);
          
          expect(card.lessons.length).toBe(3);

          // Verify required fields are present
          expect(card).toHaveProperty('openers');
          expect(card).toHaveProperty('followUpQuestions');
          expect(card).toHaveProperty('lessons');
          expect(card).toHaveProperty('generatedAt');
          expect(card).toHaveProperty('degradedMode');

          // Verify types
          expect(Array.isArray(card.openers)).toBe(true);
          expect(Array.isArray(card.followUpQuestions)).toBe(true);
          expect(Array.isArray(card.lessons)).toBe(true);
          expect(typeof card.generatedAt).toBe('string');
          expect(typeof card.degradedMode).toBe('boolean');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: network-coach, Property 2: PersonCard structural invariant**
 * **Validates: Requirements 3.2**
 * 
 * Property: For any named participant with available intel, the generated PersonCard SHALL have
 * icebreakers.length === 3 and all required fields (profileSummary, topicsOfInterest,
 * thingsToAvoid, suggestedAsk) present and non-empty.
 */
describe('PersonCard structural invariant', () => {
  let prepService: PrepService;

  beforeEach(() => {
    prepService = new PrepService();
    vi.clearAllMocks();
  });

  // Arbitrary generator for ExtractedParticipant
  const participantArbitrary = fc.record({
    name: fc.string({ minLength: 1 }),
    role: fc.option(fc.string(), { nil: undefined }),
    company: fc.option(fc.string(), { nil: undefined }),
    topics: fc.array(fc.string()),
  });

  it('Property 2: PersonCard has correct structural invariants', async () => {
    await fc.assert(
      fc.asyncProperty(
        participantArbitrary,
        fc.array(fc.string()),
        fc.boolean(),
        async (participant, intelChunks, degradedMode) => {
          // Mock Claude API response with valid structure
          const mockIcebreakers = fc.sample(
            fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 3 }),
            1
          )[0];

          const mockResponse = {
            participantName: participant.name,
            profileSummary: fc.sample(fc.string({ minLength: 1 }), 1)[0],
            icebreakers: mockIcebreakers,
            topicsOfInterest: fc.sample(fc.array(fc.string({ minLength: 1 })), 1)[0],
            thingsToAvoid: fc.sample(fc.array(fc.string({ minLength: 1 })), 1)[0],
            suggestedAsk: fc.sample(fc.string({ minLength: 1 }), 1)[0],
          };

          vi.mocked(claude.messages.create).mockResolvedValue({
            content: [
              {
                type: 'text',
                text: JSON.stringify(mockResponse),
              },
            ],
          } as any);

          // Generate the card
          const card = await prepService.generatePersonCard(
            participant,
            intelChunks,
            degradedMode
          );

          // Verify structural invariants
          expect(card.icebreakers.length).toBe(3);

          // Verify all required fields are present and non-empty
          expect(card.participantName).toBeTruthy();
          expect(card.participantName.length).toBeGreaterThan(0);
          
          expect(card.profileSummary).toBeTruthy();
          expect(card.profileSummary.length).toBeGreaterThan(0);
          
          expect(card.suggestedAsk).toBeTruthy();
          expect(card.suggestedAsk.length).toBeGreaterThan(0);

          // Verify arrays are present (can be empty)
          expect(Array.isArray(card.topicsOfInterest)).toBe(true);
          expect(Array.isArray(card.thingsToAvoid)).toBe(true);

          // Verify required fields exist
          expect(card).toHaveProperty('participantName');
          expect(card).toHaveProperty('profileSummary');
          expect(card).toHaveProperty('icebreakers');
          expect(card).toHaveProperty('topicsOfInterest');
          expect(card).toHaveProperty('thingsToAvoid');
          expect(card).toHaveProperty('suggestedAsk');
          expect(card).toHaveProperty('limitedResearch');
          expect(card).toHaveProperty('generatedAt');

          // Verify types
          expect(typeof card.participantName).toBe('string');
          expect(typeof card.profileSummary).toBe('string');
          expect(Array.isArray(card.icebreakers)).toBe(true);
          expect(Array.isArray(card.topicsOfInterest)).toBe(true);
          expect(Array.isArray(card.thingsToAvoid)).toBe(true);
          expect(typeof card.suggestedAsk).toBe('string');
          expect(typeof card.limitedResearch).toBe('boolean');
          expect(typeof card.generatedAt).toBe('string');

          // Verify limitedResearch flag is set correctly
          if (intelChunks.length === 0) {
            expect(card.limitedResearch).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
