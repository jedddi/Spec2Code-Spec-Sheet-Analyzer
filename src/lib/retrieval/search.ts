import { generateEmbeddings } from "@/src/lib/ingest/embed";
import { supabaseAdmin } from "@/src/lib/supabase/server";

type HybridSearchRow = {
  id: number;
  document_path: string;
  chunk_index: number;
  page: number | null;
  content: string;
  score: number;
};

export type SearchDocumentResult = {
  content: string;
  document_path: string;
  chunk_index: number;
  page: number | null;
  similarity: number;
};

export type SearchResult = {
  matches: SearchDocumentResult[];
  lowConfidence: boolean;
};

const DEFAULT_TOP_K = 6;
const DEFAULT_SIMILARITY_THRESHOLD = 0.2;
const LOW_CONFIDENCE_THRESHOLD = 0.2;

export async function searchDocuments(
  query: string,
  userId: string,
  topK = DEFAULT_TOP_K,
): Promise<SearchResult> {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    return { matches: [], lowConfidence: true };
  }

  const [queryEmbedding] = await generateEmbeddings([cleanedQuery]);
  if (!queryEmbedding) {
    return { matches: [], lowConfidence: true };
  }

  const { data, error } = await supabaseAdmin.rpc("hybrid_search", {
    query_text: cleanedQuery,
    query_embedding: queryEmbedding,
    match_count: topK,
    similarity_threshold: DEFAULT_SIMILARITY_THRESHOLD,
    owner_id: userId,
  });

  if (error) {
    if (error.message.includes("Could not find the function")) {
      throw new Error(
        "Failed to search document chunks: hybrid_search RPC is missing. Apply the latest Supabase migration (016_hybrid_search.sql), then retry.",
      );
    }
    throw new Error(`Failed to search document chunks: ${error.message}`);
  }

  const rows = (data ?? []) as HybridSearchRow[];
  const topScore = rows.length > 0 ? rows[0].score : 0;

  const matches = rows.map((row) => ({
    content: row.content,
    document_path: row.document_path,
    chunk_index: row.chunk_index,
    page: row.page,
    similarity: row.score,
  }));

  return {
    matches,
    lowConfidence: topScore < LOW_CONFIDENCE_THRESHOLD,
  };
}
