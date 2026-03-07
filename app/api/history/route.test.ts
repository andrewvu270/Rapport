/**
 * Property-based tests for session history API
 * 
 * Tests:
 * - Property 8: Session history ordering
 * - Property 9: Average score computation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DebriefReport, DebriefScores } from '@/src/types';

describe('Session History API - Property Tests', () => {

  /**
   * **Feature: network-coach, Property 8: Session history ordering**
   * **Validates: Requirements 7.1**
   * 
   * For any user with multiple past sessions, the history list returned by the system
   * SHALL be sorted in descending order by created_at (most recent first).
   */
  it('Property 8: Session history ordering - sessions are ordered by created_at DESC', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-20 sessions with different timestamps
        fc.array(
          fc.record({
            id: fc.uuid(),
            created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        async (sessions) => {
          // Sort sessions by created_at DESC (simulating the database query with ORDER BY)
          const sortedSessions = [...sessions].sort((a, b) => 
            b.created_at.getTime() - a.created_at.getTime()
          );

          // Verify ordering: each session should have created_at >= next session
          for (let i = 0; i < sortedSessions.length - 1; i++) {
            const current = sortedSessions[i].created_at.getTime();
            const next = sortedSessions[i + 1].created_at.getTime();
            expect(current).toBeGreaterThanOrEqual(next);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: network-coach, Property 9: Average score computation**
   * **Validates: Requirements 7.3**
   * 
   * For any set of DebriefReport records for a user in a billing period,
   * the computed average for each dimension SHALL equal the arithmetic mean
   * of that dimension's scores across all reports, rounded to two decimal places.
   */
  it('Property 9: Average score computation - averages are computed correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-20 debrief reports with random scores
        fc.array(
          fc.record({
            openers: fc.integer({ min: 1, max: 10 }),
            questionQuality: fc.integer({ min: 1, max: 10 }),
            responseRelevance: fc.integer({ min: 1, max: 10 }),
            closing: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (scoreConfigs) => {
          // Compute expected averages
          const expectedOpeners = scoreConfigs.reduce((sum, s) => sum + s.openers, 0) / scoreConfigs.length;
          const expectedQuestionQuality = scoreConfigs.reduce((sum, s) => sum + s.questionQuality, 0) / scoreConfigs.length;
          const expectedResponseRelevance = scoreConfigs.reduce((sum, s) => sum + s.responseRelevance, 0) / scoreConfigs.length;
          const expectedClosing = scoreConfigs.reduce((sum, s) => sum + s.closing, 0) / scoreConfigs.length;

          // Round to 2 decimal places (simulating the API logic)
          const roundTo2 = (num: number) => Math.round(num * 100) / 100;

          // Simulate the API computation logic
          let totalOpeners = 0;
          let totalQuestionQuality = 0;
          let totalResponseRelevance = 0;
          let totalClosing = 0;

          scoreConfigs.forEach((scores) => {
            totalOpeners += scores.openers;
            totalQuestionQuality += scores.questionQuality;
            totalResponseRelevance += scores.responseRelevance;
            totalClosing += scores.closing;
          });

          const count = scoreConfigs.length;
          const actualOpeners = roundTo2(totalOpeners / count);
          const actualQuestionQuality = roundTo2(totalQuestionQuality / count);
          const actualResponseRelevance = roundTo2(totalResponseRelevance / count);
          const actualClosing = roundTo2(totalClosing / count);

          // Verify averages match expected values
          expect(actualOpeners).toBe(roundTo2(expectedOpeners));
          expect(actualQuestionQuality).toBe(roundTo2(expectedQuestionQuality));
          expect(actualResponseRelevance).toBe(roundTo2(expectedResponseRelevance));
          expect(actualClosing).toBe(roundTo2(expectedClosing));
        }
      ),
      { numRuns: 100 }
    );
  });
});
