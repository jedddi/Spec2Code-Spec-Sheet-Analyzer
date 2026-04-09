import { NonRetriableError } from "inngest";
import { inngest } from "@/src/lib/inngest/client";
import { supabaseAdmin } from "@/src/lib/supabase/server";
import { partitionPdfToMarkdown } from "@/src/lib/ingest/unstructured";
import {
  processDocumentIngestion,
  processMarkdownIngestion,
} from "@/src/lib/ingest/process-document";
import { normalizeProjectName } from "@/src/lib/documents/default-project";

const STORAGE_BUCKET = "Spec-sheets";

/** Match `ingest-document` Edge reclaim window. */
const STALE_PROCESSING_MS = 3 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type DocumentStatus = "pending" | "processing" | "completed" | "failed";

type DocumentRow = {
  id: string;
  user_id: string;
  storage_path: string | null;
  file_url: string | null;
  filename: string | null;
  project_name: string | null;
  tags: string[] | null;
  status: DocumentStatus;
};

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
      /* noop */
    }
  }

  throw new Error("Cannot resolve storage path for document");
}

type ClaimSuccess = {
  ok: true;
  document: DocumentRow & { storagePath: string; filename: string };
};

type ClaimSkip = {
  ok: false;
  reason: string;
};

async function claimDocumentRow(documentId: string): Promise<ClaimSuccess | ClaimSkip> {
  const startedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("documents")
    .select("id, status")
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load document: ${fetchError.message}`);
  }

  if (!existing) {
    throw new NonRetriableError("Document not found");
  }

  if (existing.status === "completed") {
    return { ok: false, reason: "already_completed" };
  }

  let documentRow: DocumentRow | null = null;

  const { data: claimedPending, error: claimPendingErr } = await supabaseAdmin
    .from("documents")
    .update({
      status: "processing",
      error_log: null,
      error_message: null,
      updated_at: startedAt,
    })
    .eq("id", documentId)
    .in("status", ["pending", "failed"])
    .select(
      "id, user_id, storage_path, file_url, filename, status, project_name, tags",
    )
    .maybeSingle<DocumentRow>();

  if (claimPendingErr) {
    throw new Error(`Failed to claim document: ${claimPendingErr.message}`);
  }

  documentRow = claimedPending;

  if (!documentRow) {
    const { data: reclaimed, error: reclaimErr } = await supabaseAdmin
      .from("documents")
      .update({
        status: "processing",
        error_log: null,
        error_message: null,
        updated_at: startedAt,
      })
      .eq("id", documentId)
      .eq("status", "processing")
      .lt("updated_at", staleBefore)
      .select(
        "id, user_id, storage_path, file_url, filename, status, project_name, tags",
      )
      .maybeSingle<DocumentRow>();

    if (reclaimErr) {
      throw new Error(`Failed to reclaim document: ${reclaimErr.message}`);
    }

    documentRow = reclaimed;
  }

  if (!documentRow) {
    return { ok: false, reason: "could_not_claim" };
  }

  const storagePath = inferStoragePath(documentRow);
  const filename =
    documentRow.filename || storagePath.split("/").pop() || "datasheet.pdf";

  return {
    ok: true,
    document: {
      ...documentRow,
      storagePath,
      filename,
    },
  };
}

export const processDocumentIngestionJob = inngest.createFunction(
  {
    id: "process-document-ingestion",
    name: "Process document ingestion",
    retries: 4,
    concurrency: 4,
    triggers: [{ event: "document/ingest.requested" }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event as {
        name?: string;
        data?: { documentId?: string };
      };
      const documentId = original?.data?.documentId;
      if (typeof documentId !== "string" || documentId.length === 0) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Ingestion failed after retries";
      await supabaseAdmin
        .from("documents")
        .update({
          status: "failed",
          error_log: message,
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
    },
  },
  async ({ event, step, logger }) => {
    const documentId = event.data.documentId;
    if (typeof documentId !== "string" || documentId.length === 0) {
      throw new NonRetriableError("Missing event.data.documentId");
    }

    logger.info(`Ingestion start: ${documentId}`);

    const claim = await step.run("claim-document", async () =>
      claimDocumentRow(documentId),
    );

    if (!claim.ok) {
      logger.info(`Skip ingestion for ${documentId}: ${claim.reason}`);
      return { skipped: true, documentId, reason: claim.reason };
    }

    const { document } = claim;
    logger.info(
      `Claimed document ${documentId} (user=${document.user_id}, path=${document.storagePath})`,
    );
    const normalizedProject = normalizeProjectName(document.project_name);
    const normalizedTags = Array.isArray(document.tags) ? document.tags : [];

    const { markdown } = await step.run(
      "unstructured-partition",
      async () => {
        logger.info(`Downloading PDF from storage: ${document.storagePath}`);
        let fileBlob: Blob | null = null;
        let downloadError: { message?: string } | null = null;

        // Immediately after upload, Storage can briefly return "Object not found".
        // Retry a few times before failing the whole run.
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          const res = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .download(document.storagePath);
          fileBlob = res.data ?? null;
          downloadError = res.error ? { message: res.error.message } : null;

          if (fileBlob) break;
          const msg = downloadError?.message ?? "";
          if (!msg.toLowerCase().includes("object not found")) break;

          const backoffMs = 300 * 2 ** (attempt - 1);
          logger.info(
            `Storage miss (attempt ${attempt}/5), retrying in ${backoffMs}ms`,
          );
          await sleep(backoffMs);
        }

        if (downloadError || !fileBlob) {
          throw new Error(
            downloadError?.message || "Failed to download PDF from storage",
          );
        }

        logger.info(`Calling Unstructured: ${document.filename}`);
        const { markdown: md } = await partitionPdfToMarkdown({
          file: fileBlob,
          fileName: document.filename,
        });
        logger.info(`Unstructured done (chars=${md.length})`);
        return { markdown: md };
      },
    );

    const result = await step.run("embed-and-finalize", async () => {
      logger.info(
        `Indexing start (source=${markdown.trim() ? "markdown" : "pdf_fallback"})`,
      );
      if (markdown.trim()) {
        return processMarkdownIngestion({
          supabase: supabaseAdmin,
          userId: document.user_id,
          storagePath: document.storagePath,
          markdown,
          projectName: normalizedProject,
          tags: normalizedTags,
        });
      }

      return processDocumentIngestion({
        supabase: supabaseAdmin,
        userId: document.user_id,
        storagePath: document.storagePath,
        projectName: normalizedProject,
        tags: normalizedTags,
      });
    });

    logger.info(`Ingestion done: ${documentId} (chunks=${result.chunkCount})`);
    return {
      documentId,
      chunkCount: result.chunkCount,
      source: markdown.trim() ? "markdown" : "pdf_fallback",
    };
  },
);

export const inngestFunctions = [processDocumentIngestionJob];
