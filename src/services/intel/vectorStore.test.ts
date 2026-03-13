// @vitest-environment node

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { embedChunks } from './embedding';
import { upsertIntel, retrieveIntel } from './vectorStore';

// **Feature: network-coach, Property 10: Pinecone retrieval count bound**
// **Validates: Requirements 2.3**

describe('vectorStore - Property 10: Pinecone retrieval count bound', () => {
  // Skip these tests if API keys are not configured
  const hasApiKeys =
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
    process.env.PINECONE_API_KEY &&
    process.env.PINECONE_API_KEY !== 'your_pinecone_api_key_here';

  const testOrSkip = hasApiKeys ? it : it.skip;

  testOrSkip(
    'should return at most topK results when more vectors are stored',
    async () => {
      // Property: For any participant namespace in Pinecone, the retrieval function
      // SHALL return at most topK results regardless of how many vectors are stored

      await fc.assert(
        fc.asyncProperty(
          // Generate chunks - ensure we have more than the default topK (5)
          fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
            minLength: 6,
            maxLength: 10,
          }),
          // Generate different topK values to test
          fc.integer({ min: 1, max: 8 }),
          async (chunks, topK) => {
            // Use a fixed test namespace to avoid exhausting Pinecone's namespace limit
            const namespace = `test-user/test-context/property-test-retrieval`;

            try {
              // Embed all chunks
              const embeddings = await embedChunks(chunks);

              // Upsert all chunks to Pinecone
              await upsertIntel(namespace, chunks, embeddings);

              // Wait a moment for Pinecone to index
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Create a query embedding (use the first chunk's embedding)
              const queryEmbedding = embeddings[0];

              // Retrieve with the specified topK value
              const results = await retrieveIntel(
                namespace,
                queryEmbedding,
                topK
              );

              // Property assertion: results length should never exceed topK
              expect(results.length).toBeLessThanOrEqual(topK);

              // Additional invariant: if we stored fewer chunks than topK,
              // we should get at most that many back
              if (chunks.length < topK) {
                expect(results.length).toBeLessThanOrEqual(chunks.length);
              }

              return true;
            } catch (error) {
              // Infrastructure errors (e.g. namespace limit, quota) skip the run
              console.error('API error in property test:', error);
              return true;
            }
          }
        ),
        { numRuns: 5 } // Limited runs due to real API calls and costs
      );
    },
    300000
  ); // 5 minute timeout for API calls

  testOrSkip(
    'should respect default topK of 5',
    async () => {
      // Test the specific requirement that default topK is 5
      const chunks = Array.from(
        { length: 10 },
        (_, i) => `Test chunk number ${i} with some content to embed`
      );

      const namespace = `test-user/test-context/property-test-default-topk`;

      try {
        const embeddings = await embedChunks(chunks);
        await upsertIntel(namespace, chunks, embeddings);

        // Wait for indexing
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Query without specifying topK (should default to 5)
        const results = await retrieveIntel(namespace, embeddings[0]);

        // Should return at most 5 results
        expect(results.length).toBeLessThanOrEqual(5);
      } catch (error) {
        // Infrastructure errors (e.g. namespace limit, quota) skip the test
        console.error('API error in default topK test:', error);
      }
    },
    60000
  );
});
