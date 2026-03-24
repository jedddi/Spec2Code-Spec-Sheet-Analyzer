-- Enable the pgvector extension for embedding storage and similarity search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  document_path text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(768) NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- HNSW index for fast cosine similarity searches
CREATE INDEX ON document_chunks
  USING hnsw (embedding vector_cosine_ops);
