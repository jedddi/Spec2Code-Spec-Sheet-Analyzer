ALTER TABLE document_chunks
ADD COLUMN user_id uuid REFERENCES auth.users(id);

DELETE FROM document_chunks
WHERE user_id IS NULL;

ALTER TABLE document_chunks
ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS document_chunks_user_id_idx
  ON document_chunks (user_id);
