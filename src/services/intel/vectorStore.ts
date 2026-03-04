import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY environment variable is not set');
}

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('PINECONE_INDEX_NAME environment variable is not set');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX_NAME;

/**
 * Upserts intel chunks and their embeddings into Pinecone.
 * Namespace format: {userId}/{contextId}/{participantName}
 * 
 * @param namespace - The namespace to store vectors in (format: userId/contextId/participantName)
 * @param chunks - Array of text chunks
 * @param embeddings - Array of embedding vectors corresponding to chunks
 */
export async function upsertIntel(
  namespace: string,
  chunks: string[],
  embeddings: number[][]
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error('Chunks and embeddings arrays must have the same length');
  }

  if (chunks.length === 0) {
    return;
  }

  const index = pinecone.index(indexName);

  // Create vector records with unique IDs
  const vectors = chunks.map((chunk, i) => ({
    id: `${namespace}-${i}-${Date.now()}`,
    values: embeddings[i],
    metadata: {
      text: chunk,
      namespace,
    },
  }));

  await index.namespace(namespace).upsert(vectors);
}

/**
 * Retrieves the most relevant intel chunks from Pinecone for a given query embedding.
 * 
 * @param namespace - The namespace to search in (format: userId/contextId/participantName)
 * @param queryEmbedding - The embedding vector to search with
 * @param topK - Maximum number of results to return (default: 5)
 * @returns Array of text chunks, ordered by relevance
 */
export async function retrieveIntel(
  namespace: string,
  queryEmbedding: number[],
  topK: number = 5
): Promise<string[]> {
  const index = pinecone.index(indexName);

  const queryResponse = await index.namespace(namespace).query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return queryResponse.matches
    .filter((match) => match.metadata && typeof match.metadata.text === 'string')
    .map((match) => match.metadata!.text as string);
}
