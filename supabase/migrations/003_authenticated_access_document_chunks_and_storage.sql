-- Allow logged-in users to ingest without relying on SUPABASE_SERVICE_ROLE_KEY for this path.
-- Apply in Supabase SQL Editor or: supabase db push

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_chunks_authenticated_select" ON document_chunks;
DROP POLICY IF EXISTS "document_chunks_authenticated_insert" ON document_chunks;
DROP POLICY IF EXISTS "document_chunks_authenticated_update" ON document_chunks;
DROP POLICY IF EXISTS "document_chunks_authenticated_delete" ON document_chunks;

CREATE POLICY "document_chunks_authenticated_select"
  ON document_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "document_chunks_authenticated_insert"
  ON document_chunks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "document_chunks_authenticated_update"
  ON document_chunks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "document_chunks_authenticated_delete"
  ON document_chunks FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "spec_sheets_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "spec_sheets_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "spec_sheets_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "spec_sheets_authenticated_delete" ON storage.objects;

CREATE POLICY "spec_sheets_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'Spec-sheets');

CREATE POLICY "spec_sheets_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Spec-sheets');

CREATE POLICY "spec_sheets_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'Spec-sheets')
  WITH CHECK (bucket_id = 'Spec-sheets');

CREATE POLICY "spec_sheets_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'Spec-sheets');
