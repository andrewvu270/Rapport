import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildSystemPrompt } from './promptBuilder';

/**
 * **Feature: network-coach, Property 6: Session prompt construction contains all intel chunks**
 * **Validates: Requirements 4.1, 4.2, 5.1**
 * 
 * Property: For any voice or video session start with N intel chunks passed to the prompt builder,
 * the buildSystemPrompt(persona, intelChunks) function SHALL return a string that contains
 * each of the N intel chunk texts as a substring.
 */
describe('Session prompt construction contains all intel chunks', () => {
  // Arbitrary generator for PersonCard
  const personCardArbitrary = fc.record({
    participantName: fc.string({ minLength: 1 }),
    profileSummary: fc.string({ minLength: 1 }),
    icebreakers: fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 3 }),
    topicsOfInterest: fc.array(fc.string({ minLength: 1 })),
    thingsToAvoid: fc.array(fc.string({ minLength: 1 })),
    suggestedAsk: fc.string({ minLength: 1 }),
    limitedResearch: fc.boolean(),
    generatedAt: fc.date().map(d => d.toISOString()),
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

  it('Property 6: System prompt contains all intel chunks', () => {
    fc.assert(
      fc.property(
        personCardArbitrary,
        fc.array(fc.string({ minLength: 1 })),
        contextInputArbitrary,
        (persona, intelChunks, contextInput) => {
          // Build the system prompt
          const systemPrompt = buildSystemPrompt(persona, intelChunks, contextInput);

          // Verify that the prompt is a non-empty string
          expect(typeof systemPrompt).toBe('string');
          expect(systemPrompt.length).toBeGreaterThan(0);

          // Verify that ALL intel chunks are present in the prompt
          for (const chunk of intelChunks) {
            expect(systemPrompt).toContain(chunk);
          }

          // Verify that key persona information is included
          expect(systemPrompt).toContain(persona.participantName);
          expect(systemPrompt).toContain(persona.profileSummary);

          // Verify that context information is included
          expect(systemPrompt).toContain(contextInput.eventType);
          expect(systemPrompt).toContain(contextInput.industry);
          expect(systemPrompt).toContain(contextInput.userRole);
          expect(systemPrompt).toContain(contextInput.userGoal);

          // Verify that the persona hallucination guardrail is present
          expect(systemPrompt).toContain('If you do not have specific information about a participant\'s past experience or interests, do not invent them');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
