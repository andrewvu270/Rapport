import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DebriefService } from './DebriefService';
import type { Transcript, DebriefReport } from '@/src/types';
import { claude } from '../lib/claude';
import { createServiceClient } from '../lib/supabase-server';

// Mock the Claude API
vi.mock('../lib/claude', () => ({
  claude: {
    messages: {
      create: vi.fn(),
    },
  },
}));

// Mock Supabase
vi.mock('../lib/supabase-server', () => ({
  createServiceClient: vi.fn(),
}));

/**
 * **Feature: network-coach, Property 5: DebriefReport structural invariant**
 * **Validates: Requirements 6.2, 6.3, 6.4**
 * 
 * Property: For any session transcript, the generated DebriefReport SHALL have all four score fields
 * (openers, questionQuality, responseRelevance, closing) present with values in [1, 10],
 * moments.length in [0, 3], and homework.length === 3.
 */
describe('DebriefReport structural invariant', () => {
  let debriefService: DebriefService;
  let mockSupabase: any;

  beforeEach(() => {
    debriefService = new DebriefService();
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn(),
    };

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);
  });

  // Arbitrary generator for Transcript
  const transcriptArbitrary = fc.record({
    turns: fc.array(
      fc.record({
        speaker: fc.constantFrom('user' as const, 'persona' as const),
        text: fc.string({ minLength: 1 }),
        timestamp: fc.date().map(d => d.toISOString()),
      }),
      { minLength: 1 }
    ),
    durationSeconds: fc.integer({ min: 1, max: 3600 }),
    sessionId: fc.uuid(),
  });

  it('Property 5: DebriefReport has correct structural invariants', async () => {
    await fc.assert(
      fc.asyncProperty(
        transcriptArbitrary,
        fc.uuid(),
        fc.uuid(),
        async (transcript, sessionId, userId) => {
          // Mock Supabase session fetch
          mockSupabase.single.mockResolvedValue({
            data: {
              transcript: JSON.stringify(transcript),
              user_id: userId,
            },
            error: null,
          });

          // Mock Claude API response with valid structure
          const mockScores = {
            openers: fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0],
            questionQuality: fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0],
            responseRelevance: fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0],
            closing: fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0],
          };

          const mockMoments = fc.sample(
            fc.array(
              fc.record({
                turnIndex: fc.integer({ min: 0, max: transcript.turns.length - 1 }),
                userText: fc.string({ minLength: 1 }),
                suggestion: fc.string({ minLength: 1 }),
              }),
              { minLength: 0, maxLength: 3 }
            ),
            1
          )[0];

          const mockHomework = fc.sample(
            fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 3 }),
            1
          )[0];

          const mockResponse = {
            scores: mockScores,
            moments: mockMoments,
            homework: mockHomework,
          };

          vi.mocked(claude.messages.create).mockResolvedValue({
            content: [
              {
                type: 'text',
                text: JSON.stringify(mockResponse),
              },
            ],
          } as any);

          // Mock Supabase insert
          mockSupabase.insert.mockResolvedValue({
            data: null,
            error: null,
          });

          // Generate the debrief
          const report = await debriefService.generateDebrief(sessionId);

          // Verify all four score fields are present with values in [1, 10]
          expect(report.scores.openers).toBeGreaterThanOrEqual(1);
          expect(report.scores.openers).toBeLessThanOrEqual(10);
          
          expect(report.scores.questionQuality).toBeGreaterThanOrEqual(1);
          expect(report.scores.questionQuality).toBeLessThanOrEqual(10);
          
          expect(report.scores.responseRelevance).toBeGreaterThanOrEqual(1);
          expect(report.scores.responseRelevance).toBeLessThanOrEqual(10);
          
          expect(report.scores.closing).toBeGreaterThanOrEqual(1);
          expect(report.scores.closing).toBeLessThanOrEqual(10);

          // Verify moments.length in [0, 3]
          expect(report.moments.length).toBeGreaterThanOrEqual(0);
          expect(report.moments.length).toBeLessThanOrEqual(3);

          // Verify homework.length === 3
          expect(report.homework.length).toBe(3);

          // Verify required fields exist
          expect(report).toHaveProperty('sessionId');
          expect(report).toHaveProperty('scores');
          expect(report).toHaveProperty('moments');
          expect(report).toHaveProperty('homework');
          expect(report).toHaveProperty('generatedAt');

          // Verify types
          expect(typeof report.sessionId).toBe('string');
          expect(typeof report.scores).toBe('object');
          expect(Array.isArray(report.moments)).toBe(true);
          expect(Array.isArray(report.homework)).toBe(true);
          expect(typeof report.generatedAt).toBe('string');

          // Verify score object structure
          expect(report.scores).toHaveProperty('openers');
          expect(report.scores).toHaveProperty('questionQuality');
          expect(report.scores).toHaveProperty('responseRelevance');
          expect(report.scores).toHaveProperty('closing');

          // Verify moment structure if moments exist
          if (report.moments.length > 0) {
            for (const moment of report.moments) {
              expect(moment).toHaveProperty('turnIndex');
              expect(moment).toHaveProperty('userText');
              expect(moment).toHaveProperty('suggestion');
              expect(typeof moment.turnIndex).toBe('number');
              expect(typeof moment.userText).toBe('string');
              expect(typeof moment.suggestion).toBe('string');
            }
          }

          // Verify homework items are strings
          for (const item of report.homework) {
            expect(typeof item).toBe('string');
            expect(item.length).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
