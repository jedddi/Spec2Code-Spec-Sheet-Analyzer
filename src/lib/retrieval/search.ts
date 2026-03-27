import { generateEmbeddings } from "@/src/lib/ingest/embed";
import { supabaseAdmin } from "@/src/lib/supabase/server";

type MatchDocumentChunkRow = {
  id: number;
  document_path: string;
  chunk_index: number;
  page: number | null;
  content: string;
  similarity: number;
};

export type SearchDocumentResult = {
  content: string;
  document_path: string;
  chunk_index: number;
  page: number | null;
  similarity: number;
};

const DEFAULT_TOP_K = 6;
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;

export async function searchDocuments(
  query: string,
  userId: string,
  topK = DEFAULT_TOP_K,
): Promise<SearchDocumentResult[]> {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    return [];
  }

  const [queryEmbedding] = await generateEmbeddings([cleanedQuery]);
  if (!queryEmbedding) {
    return [];
  }

  const { data, error } = await supabaseAdmin.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count: topK,
    similarity_threshold: DEFAULT_SIMILARITY_THRESHOLD,
    owner_id: userId,
  });

  if (error) {
    if (error.message.includes("Could not find the function")) {
      throw new Error(
        "Failed to search document chunks: match_document_chunks RPC is missing. Apply the latest Supabase migrations (including 006_match_chunks_user_scope.sql), then retry.",
      );
    }
    throw new Error(`Failed to search document chunks: ${error.message}`);
  }

  const rows = (data ?? []) as MatchDocumentChunkRow[];
  return rows.map((row) => ({
    content: row.content,
    document_path: row.document_path,
    chunk_index: row.chunk_index,
    page: row.page,
    similarity: row.similarity,
  }));
}
