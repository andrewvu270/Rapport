/**
 * Retry wrapper utility for external API calls
 * Implements Requirements 10.1 - retry once after delay, log both errors
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps an async function with retry logic
 * @param fn - The async function to execute
 * @param delayMs - Delay in milliseconds before retry (default: 2000)
 * @returns The result of the function call
 * @throws The error from the second attempt if both fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  delayMs: number = 2000
): Promise<T> {
  let firstError: unknown;
  
  try {
    return await fn();
  } catch (err) {
    firstError = err;
    console.warn('API call failed, retrying', { error: err });
  }
  
  await sleep(delayMs);
  
  try {
    return await fn();
  } catch (err) {
    console.error('API call failed after retry', { firstError, retryError: err });
    throw err; // throws the second error; first is logged above
  }
}
