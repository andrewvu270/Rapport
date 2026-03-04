import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { withRetry } from './retry';

/**
 * **Feature: network-coach, Property 11: Retry wrapper invocation count**
 * **Validates: Requirements 10.1**
 * 
 * Property: For any external API call that fails on every attempt,
 * the retry wrapper SHALL invoke the underlying function exactly twice
 * (initial attempt + one retry) before returning an error.
 */
describe('withRetry property tests', () => {
  it('Property 11: should invoke function exactly twice when all attempts fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // arbitrary delay value (small for test speed)
        fc.string(), // arbitrary error message
        async (delayMs, errorMessage) => {
          let invocationCount = 0;
          const failingFn = async () => {
            invocationCount++;
            throw new Error(errorMessage);
          };

          // Attempt to call withRetry - it should fail
          try {
            await withRetry(failingFn, delayMs);
            // If we get here, the test should fail because withRetry should have thrown
            return false;
          } catch (err) {
            // Verify that the function was invoked exactly twice
            return invocationCount === 2;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11 (success case): should invoke function once when first attempt succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // arbitrary delay value (small for test speed)
        fc.anything(), // arbitrary return value
        async (delayMs, returnValue) => {
          let invocationCount = 0;
          const succeedingFn = async () => {
            invocationCount++;
            return returnValue;
          };

          const result = await withRetry(succeedingFn, delayMs);
          
          // Verify that the function was invoked exactly once
          // and the return value matches
          return invocationCount === 1 && result === returnValue;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11 (retry success case): should invoke function twice when first fails but second succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // arbitrary delay value (small for test speed)
        fc.string(), // arbitrary error message
        fc.anything(), // arbitrary return value
        async (delayMs, errorMessage, returnValue) => {
          let invocationCount = 0;
          const failOnceFn = async () => {
            invocationCount++;
            if (invocationCount === 1) {
              throw new Error(errorMessage);
            }
            return returnValue;
          };

          const result = await withRetry(failOnceFn, delayMs);
          
          // Verify that the function was invoked exactly twice
          // and the return value matches
          return invocationCount === 2 && result === returnValue;
        }
      ),
      { numRuns: 100 }
    );
  });
});
