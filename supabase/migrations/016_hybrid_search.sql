-- 016: Hybrid Search — add full-text search column + combined vector/keyword RPC
--
-- Adds a generated tsvector column to document_chunks so Postgres FTS can run
-- alongside pgvector cosine similarity.  The new hybrid_search() RPC merges
-- both result sets and returns a single normalised score.
--
-- The existing match_document_chunks() function is intentionally left intact.

-- 1. Generated tsvector column (auto-populated for existing + future rows)
ALTER TABLE document_chunks
  ADD COLUMN fts_tokens tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 2. GIN index for fast full-text lookups
CREATE INDEX document_chunks_fts_idx
  ON document_chunks USING GIN (fts_tokens);

-- 3. Hybrid search RPC
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(768),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.2,
  owner_id uuid DEFAULT NULL,
  vector_weight float DEFAULT 0.5,
  keyword_weight float DEFAULT 0.5
)
RETURNS TABLE (
  id bigint,
  document_path text,
  chunk_index integer,
  page integer,
  content text,
  score float
)
LANGUAGE sql
STABLE
AS $$
  WITH vector_results AS (
    SELECT
      dc.id,
      dc.document_path,
      dc.chunk_index,
      CASE
        WHEN (dc.metadata->>'page') ~ '^[0-9]+$'
          THEN (dc.metadata->>'page')::integer
        ELSE NULL
      END AS page,
      dc.content,
      1 - (dc.embedding <=> query_embedding) AS vector_similarity
    FROM document_chunks dc
    WHERE dc.user_id = COALESCE(owner_id, auth.uid())
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  fts_results AS (
    SELECT
      dc.id,
      dc.document_path,
      dc.chunk_index,
      CASE
        WHEN (dc.metadata->>'page') ~ '^[0-9]+$'
          THEN (dc.metadata->>'page')::integer
        ELSE NULL
      END AS page,
      dc.content,
      ts_rank(dc.fts_tokens, websearch_to_tsquery('english', query_text)) AS fts_rank
    FROM document_chunks dc
    WHERE dc.user_id = COALESCE(owner_id, auth.uid())
      AND dc.fts_tokens @@ websearch_to_tsquery('english', query_text)
    ORDER BY fts_rank DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.document_path, f.document_path) AS document_path,
      COALESCE(v.chunk_index, f.chunk_index) AS chunk_index,
      COALESCE(v.page, f.page) AS page,
      COALESCE(v.content, f.content) AS content,
      COALESCE(v.vector_similarity, 0.0) AS vector_similarity,
      COALESCE(f.fts_rank, 0.0) AS fts_rank
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.id = f.id
  ),
  max_fts AS (
    SELECT GREATEST(MAX(fts_rank), 0.0001) AS max_rank FROM combined
  )
  SELECT
    c.id,
    c.document_path,
    c.chunk_index,
    c.page,
    c.content,
    (c.vector_similarity * vector_weight
      + (c.fts_rank / m.max_rank) * keyword_weight)::float AS score
  FROM combined c, max_fts m
  WHERE (c.vector_similarity * vector_weight
          + (c.fts_rank / m.max_rank) * keyword_weight) >= similarity_threshold
  ORDER BY score DESC
  LIMIT GREATEST(match_count, 1);
$$;
