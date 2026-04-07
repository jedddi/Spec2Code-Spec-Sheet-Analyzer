import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";
import { processDocumentIngestion } from "@/src/lib/ingest/process-document";
import { DEFAULT_DOCUMENT_PROJECT } from "@/src/lib/documents/default-project";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const {
    storagePath,
    projectName,
    tags,
  } = body as {
    storagePath?: string;
    projectName?: string;
    tags?: string[];
  };

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

  try {
    const result = await processDocumentIngestion({
      supabase,
      userId: user.id,
      storagePath,
      projectName,
      tags,
    });

    return NextResponse.json({
      success: true,
      documentPath: storagePath,
      chunkCount: result.chunkCount,
      metadata: result.metadata,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown ingestion error";
    console.error("[/api/ingest]", message);

    // Attempt to record the error state in documents table
    try {
      const filename = storagePath.split("/").pop() ?? storagePath;
      await supabase.from("documents").upsert(
        {
          user_id: user.id,
          storage_path: storagePath,
          filename,
          project_name:
            typeof projectName === "string" && projectName.trim().length > 0
              ? projectName.trim()
              : DEFAULT_DOCUMENT_PROJECT,
          tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [],
          status: "error",
          error_message: message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,storage_path" },
      );
    } catch {
      // Best-effort; don't mask the original error
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
