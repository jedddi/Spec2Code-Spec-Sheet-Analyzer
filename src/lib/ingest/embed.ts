import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const BATCH_SIZE = 100;

/**
 * Generate embeddings for an array of text chunks using Google Gemini.
 *
 * Output is truncated to {@link EMBEDDING_DIMS} dimensions via the API's
 * outputDimensionality parameter (Matryoshka representation). Chunks are
 * batched into groups of up to {@link BATCH_SIZE} to stay within API limits.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const embeddings: number[][] = new Array(texts.length);

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);

    const result = await model.batchEmbedContents({
      requests: batch.map((text) => ({
        content: { parts: [{ text }], role: "user" },
        outputDimensionality: EMBEDDING_DIMS,
      })),
    });

    for (let i = 0; i < result.embeddings.length; i++) {
      embeddings[start + i] = result.embeddings[i].values;
    }
  }

  return embeddings;
}
