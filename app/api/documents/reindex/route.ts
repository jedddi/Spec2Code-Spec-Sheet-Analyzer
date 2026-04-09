import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";
import { processDocumentIngestion } from "@/src/lib/ingest/process-document";
import { normalizeProjectName } from "@/src/lib/documents/default-project";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { storagePath } = body as { storagePath?: string };
  if (!storagePath || typeof storagePath !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid `storagePath` field" },
      { status: 400 },
    );
  }

  const userPrefix = `uploads/${user.id}/`;
  if (!storagePath.startsWith(userPrefix)) {
    return NextResponse.json(
      { error: "Forbidden: storagePath is outside your account scope" },
      { status: 403 },
    );
  }

  const { data: existingDoc, error: existingDocError } = await supabase
    .from("documents")
    .select("id, project_name, tags")
    .eq("user_id", user.id)
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (existingDocError) {
    return NextResponse.json(
      { error: `Failed to load document: ${existingDocError.message}` },
      { status: 500 },
    );
  }

  if (!existingDoc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { error: markProcessingError } = await supabase
    .from("documents")
    .update({
      status: "processing",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existingDoc.id)
    .eq("user_id", user.id);

  if (markProcessingError) {
    return NextResponse.json(
      { error: `Failed to mark processing: ${markProcessingError.message}` },
      { status: 500 },
    );
  }

  try {
    const result = await processDocumentIngestion({
      supabase,
      userId: user.id,
      storagePath,
      projectName: normalizeProjectName(existingDoc.project_name),
      tags: Array.isArray(existingDoc.tags) ? existingDoc.tags : [],
    });
    return NextResponse.json({
      success: true,
      storagePath,
      chunkCount: result.chunkCount,
      metadata: result.metadata,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown reindex error";
    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDoc.id)
      .eq("user_id", user.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
