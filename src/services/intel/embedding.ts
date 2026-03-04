import { openai } from '../../lib/openai';

/**
 * Embeds an array of text chunks using OpenAI's text-embedding-3-small model.
 * @param chunks - Array of text strings to embed
 * @returns Array of embedding vectors (float arrays)
 */
export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) {
    return [];
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks,
  });

  return response.data.map((item) => item.embedding);
}
