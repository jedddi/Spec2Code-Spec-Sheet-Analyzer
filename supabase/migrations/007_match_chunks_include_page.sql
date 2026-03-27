DROP FUNCTION IF EXISTS match_document_chunks(vector, integer, double precision, uuid);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5,
  owner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  document_path text,
  chunk_index integer,
  page integer,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    dc.id,
    dc.document_path,
    dc.chunk_index,
    CASE
      WHEN (dc.metadata->>'page') ~ '^[0-9]+$' THEN (dc.metadata->>'page')::integer
      ELSE NULL
    END AS page,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    dc.user_id = COALESCE(owner_id, auth.uid())
    AND 1 - (dc.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT GREATEST(match_count, 1);
$$;
