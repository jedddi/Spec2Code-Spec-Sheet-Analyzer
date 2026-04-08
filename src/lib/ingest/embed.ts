import { embedTexts } from "@/src/lib/ai/openrouter";

/**
 * Generate 768-dim embeddings for an array of text chunks via OpenRouter.
 *
 * Delegates entirely to the shared OpenRouter client which handles batching,
 * model selection, and dimension validation.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  return embedTexts(texts);
}
