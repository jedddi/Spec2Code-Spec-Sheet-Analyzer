# ingest-document

Supabase Edge Function that processes PDF ingestion asynchronously.

## Behavior

1. Receives a database webhook payload for an inserted `public.documents` row.
2. Sets document status to `processing`.
3. Downloads the PDF from Supabase Storage bucket `Spec-sheets`.
4. Calls Unstructured API (`strategy: hi_res`, table inference enabled).
5. Converts returned elements into markdown.
6. Updates row to:
   - `completed` with `markdown_content`, or
   - `failed` with `error_log`.

The Unstructured call uses a 3-attempt retry loop with exponential backoff.

## Required secrets

- `UNSTRUCTURED_API_KEY` — set with `npx supabase secrets set UNSTRUCTURED_API_KEY=...`

On **hosted** Supabase Edge Functions, these are **injected for you** (do not set via CLI; names `SUPABASE_*` are reserved when using `secrets set` anyway):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `INGEST_WEBHOOK_SECRET` — same value as Database Webhook header `x-webhook-secret`
- `INGEST_STORAGE_BUCKET` — defaults to `Spec-sheets`

**RAG (chunks + category tags):** set both so the Edge Function can call your deployed Next.js app after markdown is saved:

- `INGEST_FINALIZE_URL` — e.g. `https://your-app.vercel.app` (no trailing slash)
- `INGEST_FINALIZE_SECRET` — must match the Next.js env `INGEST_FINALIZE_SECRET` (sent as header `x-ingest-finalize-secret`).
