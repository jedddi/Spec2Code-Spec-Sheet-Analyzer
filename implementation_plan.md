# Implement Inngest for Background Job Queue

The current architecture relies on a loosely coupled Supabase Database Webhook that triggers a Supabase Edge Function to process documents. While simple, it lacks automatic retries on failure, enforces strict timeouts (preventing large PDFs from parsing), and cannot control concurrency to the Unstructured API. 

We will replace this pipeline with **Inngest**, providing robust, infinitely scalable Next.js-native background jobs with built-in retries, concurrency limits, and no time limits.

## User Review Required

> [!WARNING]
> **Supabase Dashboard Action Required:**
> Once this is implemented, you must disable or delete your existing Database Webhook for the `documents` table in the Supabase Dashboard. Otherwise, BOTH the Edge Function and the new Inngest pipeline will try to process the document simultaneously.
> 
> Also, you will need to create a free Inngest account and set up `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in your `.env.local`, but for local development, we can use the Inngest local dev server which requires zero setup!

### How to disable the `documents` webhook after cutover

Do this in the **Supabase Dashboard** (not in git). The exact sidebar label may be **Webhooks** or **Database Hooks** depending on your Supabase version.

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and select the **project** that powers this app.
2. In the left sidebar, open **Database**, then **Webhooks** (or **Hooks** / **Database Webhooks** — the feature that sends HTTP requests on table changes).
3. Find the webhook that targets ingestion — typically one or more of:
   - **Table**: `public.documents` (or schema `public`, table `documents`)
   - **Events**: `INSERT` and/or `UPDATE` (match what you originally configured)
   - **URL or Edge Function**: points at your `ingest-document` Edge Function or a `functions/v1/ingest-document` URL
4. Either **delete** that webhook or **disable** it if the UI offers a toggle. Deleting avoids accidental re-enabling; disabling is fine if you want a quick rollback.
5. **Verify**: upload a test PDF (or trigger your new queue path). Confirm ingestion runs **once** (no duplicate rows/updates, no second hit to the Edge Function in **Edge Functions → Logs** if you still have the function deployed).

**When to do it:** Prefer deploying the new app path first (upload + queue), then disable the webhook in the same release window so you are never in a state where new uploads have **no** processor unless you intend a maintenance window.

**Same for BullMQ (or any app-driven queue):** The webhook is coupled to the **Edge Function**, not to Inngest. Any replacement that enqueues work from the app still requires removing or disabling this webhook to avoid double processing.

## Proposed Changes

### Dependencies
#### [NEW] package.json
- Install `inngest` via npm.

---

### Inngest Core Setup
We will establish the core Inngest client and the main API endpoint that Inngest needs to communicate with Next.js.

#### [NEW] [src/lib/inngest/client.ts](file:///d:/Jed/Documents/Job/Job%20Project/zaigo-spec-sheet/src/lib/inngest/client.ts)
- Create the Inngest client specifying the app ID `spec2code`.

#### [NEW] [app/api/inngest/route.ts](file:///d:/Jed/Documents/Job/Job%20Project/zaigo-spec-sheet/app/api/inngest/route.ts)
- Create the Next.js API route that registers and serves the Inngest background functions.

---

### Background Job Implementation
We will replicate the Unstructured extraction and the chunking/embedding steps into a single, cohesive, retryable Inngest background job.

#### [NEW] [src/lib/inngest/functions.ts](file:///d:/Jed/Documents/Job/Job%20Project/zaigo-spec-sheet/src/lib/inngest/functions.ts)
- Create `processDocumentIngestionJob` triggered by the event `"document/ingest.requested"`.
- The job will:
  1. Fetch the pending document from Supabase.
  2. Mark status as `processing`.
  3. Download the PDF from Supabase Storage.
  4. Send the PDF to Unstructured for extraction (with auto-retries handled by Inngest via `step.run`).
  5. Run `processMarkdownIngestion` (chunking & embeddings via OpenRouter).
  6. Finalize the database row by updating `status: 'completed'` and setting `chunk_count`.
  7. Handle failures gracefully by updating `status: 'failed'` and logging to `error_message`.

---

### API & Frontend Integration
We will reroute the manual and automatic ingestion triggers to dispatch the Inngest event instead of the old Edge Function.

#### [MODIFY] [src/components/UploadPdf.tsx](file:///d:/Jed/Documents/Job/Job%20Project/zaigo-spec-sheet/src/components/UploadPdf.tsx)
- Keep the current direct Supabase `documents` table insert (status: `pending`).
- Right after the upsert succeeds, perform a quick `fetch` call to a new trigger endpoint to dispatch the event to Inngest.

#### [NEW] [app/api/documents/queue/route.ts](file:///d:/Jed/Documents/Job/Job%20Project/zaigo-spec-sheet/app/api/documents/queue/route.ts)
- Takes a `storagePath` or `documentId`.
- Verifies the document belongs to the requesting user.
- Calls `inngest.send({ name: "document/ingest.requested", data: { documentId } })`.

#### [MODIFY] [app/api/documents/trigger-ingest/route.ts](file:///d:/Jed/Documents/Job/Job%20Project/zaigo-spec-sheet/app/api/documents/trigger-ingest/route.ts)
- Migrate this fallback route (used for manual retries of stuck documents) to re-dispatch the Inngest event instead of sending an emulated webhook payload to the Edge Function URL.

## Open Questions

- Do you agree with consolidating the Unstructured extraction and the OpenRouter Embeddings/Chunking into a single cohesive background job rather than splitting them up? (I highly recommend doing them together so you don't need a confusing "finalize-ingest" step).
- Shall I proceed with `npm install inngest` and setting up the code?

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. I will run `npx inngest-cli@latest dev` alongside your Next.js server to start the local Inngest Dev Server.
2. I will manually upload a new PDF via the UI.
3. We will observe the Inngest Dashboard and Next.js console to verify the job successfully runs, downloads the file, hits Unstructured, embeds the chunks, and completes the status.
