CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id bigint,
  document_path text,
  chunk_index integer,
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
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT GREATEST(match_count, 1);
$$;
