import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, supabaseAdmin } from "@/src/lib/supabase/server";
import {
  processDocumentIngestion,
  processMarkdownIngestion,
} from "@/src/lib/ingest/process-document";
import { normalizeProjectName } from "@/src/lib/documents/default-project";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Row shape for finalize-ingest document fetch (explicit type avoids `as typeof doc` circular inference → `never`). */
type FinalizeIngestDoc = {
  id: string;
  user_id: string;
  storage_path: string;
  markdown_content: string | null;
  project_name: string;
  tags: string[];
};

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { documentId } = body as { documentId?: string };
  if (!documentId || typeof documentId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid documentId" },
      { status: 400 },
    );
  }

  const internalSecret = process.env.INGEST_FINALIZE_SECRET;
  const providedSecret = request.headers.get("x-ingest-finalize-secret");
  const isInternalCall =
    typeof internalSecret === "string" &&
    internalSecret.length > 0 &&
    providedSecret === internalSecret;

  let supabaseForIngest: SupabaseClient;

  const selectCols =
    "id, user_id, storage_path, markdown_content, project_name, tags";

  let doc: FinalizeIngestDoc | null = null;
  let fetchError: { message: string } | null = null;

  if (isInternalCall) {
    const res = await supabaseAdmin
      .from("documents")
      .select(selectCols)
      .eq("id", documentId)
      .maybeSingle();
    doc = res.data as FinalizeIngestDoc | null;
    fetchError = res.error;
    supabaseForIngest = supabaseAdmin;
  } else {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await supabase
      .from("documents")
      .select(selectCols)
      .eq("id", documentId)
      .eq("user_id", user.id)
      .maybeSingle();
    doc = res.data as FinalizeIngestDoc | null;
    fetchError = res.error;
    supabaseForIngest = supabase;
  }

  if (fetchError) {
    return NextResponse.json(
      { error: `Failed to load document: ${fetchError.message}` },
      { status: 500 },
    );
  }

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const markdown =
    typeof doc.markdown_content === "string" ? doc.markdown_content : "";

  try {
    const normalizedProject = normalizeProjectName(doc.project_name);
    const normalizedTags = Array.isArray(doc.tags) ? doc.tags : [];

    let result: { chunkCount: number; metadata: unknown };
    let source: "markdown" | "pdf" = "markdown";

    if (markdown.trim()) {
      result = await processMarkdownIngestion({
        supabase: supabaseForIngest,
        userId: doc.user_id,
        storagePath: doc.storage_path,
        markdown,
        projectName: normalizedProject,
        tags: normalizedTags,
      });
    } else {
      // Unstructured produced no text, edge never ran, or legacy rows — index from PDF in Storage (pdf-parse path).
      source = "pdf";
      result = await processDocumentIngestion({
        supabase: supabaseForIngest,
        userId: doc.user_id,
        storagePath: doc.storage_path,
        projectName: normalizedProject,
        tags: normalizedTags,
      });
    }

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      chunkCount: result.chunkCount,
      metadata: result.metadata,
      source,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown finalize-ingest error";
    console.error("[/api/documents/finalize-ingest]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
