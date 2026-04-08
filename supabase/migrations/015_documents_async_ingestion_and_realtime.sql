-- Extend documents for async ingestion and realtime-friendly status tracking.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS markdown_content text,
  ADD COLUMN IF NOT EXISTS error_log text;

-- Normalize historical statuses to the new lifecycle.
UPDATE public.documents
SET status = CASE status
  WHEN 'ready' THEN 'completed'
  WHEN 'error' THEN 'failed'
  ELSE status
END
WHERE status IN ('ready', 'error');

-- Default newly enqueued records to pending.
ALTER TABLE public.documents
  ALTER COLUMN status SET DEFAULT 'pending';

-- Enforce allowed status values for consistency.
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Realtime needs FULL replica identity for UPDATE payloads.
ALTER TABLE public.documents REPLICA IDENTITY FULL;

-- Ensure documents changes are in Supabase realtime publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;
END
$$;
