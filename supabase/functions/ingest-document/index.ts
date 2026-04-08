import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { UnstructuredClient } from "npm:unstructured-client";

// Hosted Edge Functions inject SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (do not set via `supabase secrets set` — names starting with SUPABASE_ are reserved).
const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const UNSTRUCTURED_API_KEY = Deno.env.get("UNSTRUCTURED_API_KEY");
const INGEST_FINALIZE_URL = Deno.env.get("INGEST_FINALIZE_URL")?.trim();
const INGEST_FINALIZE_SECRET = Deno.env.get("INGEST_FINALIZE_SECRET")?.trim();
// Custom secrets cannot use the SUPABASE_ prefix (CLI skips them). Use INGEST_WEBHOOK_SECRET in Dashboard + webhook header.
const DB_WEBHOOK_SECRET =
  Deno.env.get("INGEST_WEBHOOK_SECRET") ??
  Deno.env.get("SUPABASE_DB_WEBHOOK_SECRET");
const STORAGE_BUCKET =
  Deno.env.get("INGEST_STORAGE_BUCKET") ??
  Deno.env.get("SUPABASE_STORAGE_BUCKET") ??
  "Spec-sheets";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase URL or service role (expected injected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on hosted Edge Functions)",
  );
}

if (!UNSTRUCTURED_API_KEY) {
  throw new Error("Missing UNSTRUCTURED_API_KEY for edge worker");
}

type DocumentStatus = "pending" | "processing" | "completed" | "failed";

interface DocumentRow {
  id: string;
  user_id: string;
  storage_path: string | null;
  file_url: string | null;
  filename: string | null;
  status: DocumentStatus;
}

/** Reclaim `processing` if `updated_at` is older than this (crashed/timeout mid-run). */
const STALE_PROCESSING_MS = 3 * 60 * 1000;

function parseWebhookRecord(payload: unknown): { id: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  const record =
    (source.record as Record<string, unknown> | undefined) ??
    (source.new as Record<string, unknown> | undefined) ??
    source;

  const id = record.id;
  return typeof id === "string" && id.length > 0 ? { id } : null;
}

function inferStoragePath(doc: DocumentRow): string {
  if (doc.storage_path && doc.storage_path.length > 0) {
    return doc.storage_path;
  }

  if (doc.file_url && doc.file_url.length > 0) {
    try {
      const parsed = new URL(doc.file_url);
      const marker = `/storage/v1/object/${STORAGE_BUCKET}/`;
      const idx = parsed.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
      }
    } catch {
      // no-op: handled by throw below
    }
  }

  throw new Error("Cannot resolve storage path for document");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function elementToMarkdown(element: Record<string, unknown>): string {
  const type = typeof element.type === "string" ? element.type : "Text";
  const rawText = typeof element.text === "string" ? element.text.trim() : "";
  const metadata =
    element.metadata && typeof element.metadata === "object"
      ? (element.metadata as Record<string, unknown>)
      : {};
  const html = typeof metadata.text_as_html === "string" ? metadata.text_as_html : "";

  if (!rawText && !html) return "";

  if (type === "Title") {
    return `## ${rawText || stripHtml(html)}`;
  }

  if (type === "ListItem") {
    return `- ${rawText || stripHtml(html)}`;
  }

  if (type === "Table") {
    if (html) {
      return `\n${stripHtml(html)}\n`;
    }
    return rawText;
  }

  return rawText || stripHtml(html);
}

function elementsToMarkdown(elements: unknown[]): string {
  const lines: string[] = [];
  for (const entry of elements) {
    if (!entry || typeof entry !== "object") continue;
    const line = elementToMarkdown(entry as Record<string, unknown>);
    if (line.length === 0) continue;
    lines.push(line);
  }
  return lines.join("\n\n").trim();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: (attempt: number) => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const backoffMs = 500 * (2 ** (attempt - 1));
      await sleep(backoffMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unknown retry failure");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (DB_WEBHOOK_SECRET) {
    const provided = request.headers.get("x-webhook-secret");
    if (provided !== DB_WEBHOOK_SECRET) {
      return new Response("Unauthorized webhook", { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const parsed = parseWebhookRecord(payload);
  if (!parsed) {
    return new Response("Missing document id in webhook payload", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const unstructured = new UnstructuredClient({
    security: { apiKeyAuth: UNSTRUCTURED_API_KEY },
  });

  const startedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();

  // 1) Skip only when Unstructured step is done. Old logic skipped all `processing` rows — webhook retries then never recovered (stuck "Indexing").
  const { data: existing, error: fetchError } = await supabase
    .from("documents")
    .select("id, status")
    .eq("id", parsed.id)
    .maybeSingle();

  if (fetchError) {
    return new Response(`Failed to load document: ${fetchError.message}`, { status: 500 });
  }

  if (!existing) {
    return new Response("Document not found", { status: 404 });
  }

  if (existing.status === "completed") {
    return new Response(JSON.stringify({ skipped: true, reason: "already_completed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Claim row: pending/failed, or stale `processing` (retries used to skip every `processing` row forever → UI stuck on "Indexing").
  let documentRow: DocumentRow | null = null;

  const { data: claimedPending, error: claimPendingErr } = await supabase
    .from("documents")
    .update({
      status: "processing",
      error_log: null,
      error_message: null,
      updated_at: startedAt,
    })
    .eq("id", parsed.id)
    .in("status", ["pending", "failed"])
    .select("id, user_id, storage_path, file_url, filename, status")
    .maybeSingle<DocumentRow>();

  if (claimPendingErr) {
    return new Response(`Failed to claim document: ${claimPendingErr.message}`, { status: 500 });
  }

  documentRow = claimedPending;

  if (!documentRow) {
    const { data: reclaimed, error: reclaimErr } = await supabase
      .from("documents")
      .update({
        status: "processing",
        error_log: null,
        error_message: null,
        updated_at: startedAt,
      })
      .eq("id", parsed.id)
      .eq("status", "processing")
      .lt("updated_at", staleBefore)
      .select("id, user_id, storage_path, file_url, filename, status")
      .maybeSingle<DocumentRow>();

    if (reclaimErr) {
      return new Response(`Failed to reclaim document: ${reclaimErr.message}`, { status: 500 });
    }

    documentRow = reclaimed;
  }

  if (!documentRow) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "could_not_claim" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const storagePath = inferStoragePath(documentRow);
    const filename = documentRow.filename || storagePath.split("/").pop() || "datasheet.pdf";

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message || "Failed to download PDF from storage");
    }

    const response = await withRetry(async () => {
      const result = await unstructured.general.partition({
        partitionParameters: {
          files: {
            content: fileBlob,
            fileName: filename,
          },
          strategy: "hi_res",
          pdfInferTableStructure: true,
          // keep both keys to handle SDK naming differences across versions
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...( { pdf_infer_table_structure: true } as any ),
        },
      });

      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(`Unstructured returned status ${result.statusCode}`);
      }

      return result;
    }, 3);

    const elements = Array.isArray(response.elements) ? response.elements : [];
    const markdownContent = elementsToMarkdown(elements);

    if (!markdownContent.trim()) {
      const msg = "Unstructured returned no extractable text for this PDF";
      await supabase
        .from("documents")
        .update({
          status: "failed",
          markdown_content: null,
          error_log: msg,
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentRow.id);
      return new Response(
        JSON.stringify({
          success: false,
          id: documentRow.id,
          status: "failed",
          error: msg,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const { error: completeError } = await supabase
      .from("documents")
      .update({
        status: "completed",
        markdown_content: markdownContent,
        error_log: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentRow.id);

    if (completeError) {
      throw new Error(`Failed to persist completed status: ${completeError.message}`);
    }

    let finalizeStatus: "ok" | "skipped" | "error" = "skipped";
    let finalizeDetail: string | undefined;

    if (INGEST_FINALIZE_URL && INGEST_FINALIZE_SECRET) {
      const base = INGEST_FINALIZE_URL.replace(/\/$/, "");
      try {
        const fr = await fetch(`${base}/api/documents/finalize-ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ingest-finalize-secret": INGEST_FINALIZE_SECRET,
          },
          body: JSON.stringify({ documentId: documentRow.id }),
        });
        if (fr.ok) {
          finalizeStatus = "ok";
        } else {
          finalizeStatus = "error";
          finalizeDetail = await fr.text();
          console.error("finalize-ingest failed", fr.status, finalizeDetail);
        }
      } catch (e) {
        finalizeStatus = "error";
        finalizeDetail = e instanceof Error ? e.message : String(e);
        console.error("finalize-ingest error", finalizeDetail);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: documentRow.id,
        status: "completed",
        elementCount: elements.length,
        ragFinalize: finalizeStatus,
        ...(finalizeDetail ? { ragFinalizeDetail: finalizeDetail.slice(0, 500) } : {}),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_log: message,
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentRow.id);

    return new Response(
      JSON.stringify({
        success: false,
        id: documentRow.id,
        status: "failed",
        error: message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
