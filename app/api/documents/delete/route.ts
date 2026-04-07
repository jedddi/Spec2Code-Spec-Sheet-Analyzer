import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET_NAME = "Spec-sheets";

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

  const errors: string[] = [];

  const { data: document, error: docLookupError } = await supabase
    .from("documents")
    .select("id")
    .eq("storage_path", storagePath)
    .eq("user_id", user.id)
    .maybeSingle();

  if (docLookupError) {
    return NextResponse.json(
      { error: `Failed to load document: ${docLookupError.message}` },
      { status: 500 },
    );
  }

  if (!document) {
    return NextResponse.json({ success: true, mode: "not_found" });
  }

  const { count: snippetRefCount, error: snippetRefError } = await supabase
    .from("snippets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source_pdf_id", document.id);

  if (snippetRefError) {
    if (snippetRefError.message.includes("Could not find the table 'public.snippets'")) {
      // Snippet Vault not initialized yet; proceed with hard delete behavior.
      const { error: docError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id)
        .eq("user_id", user.id);
      if (docError) {
        return NextResponse.json(
          { error: `Failed to delete document: ${docError.message}` },
          { status: 500 },
        );
      }
      const { error: chunksError } = await supabase
        .from("document_chunks")
        .delete()
        .eq("document_path", storagePath)
        .eq("user_id", user.id);
      if (chunksError) {
        return NextResponse.json(
          { error: `Failed to delete chunks: ${chunksError.message}` },
          { status: 500 },
        );
      }
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);
      if (storageError) {
        return NextResponse.json(
          { error: `Failed to delete storage file: ${storageError.message}` },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, mode: "hard" });
    }
    return NextResponse.json(
      { error: `Failed to check snippet references: ${snippetRefError.message}` },
      { status: 500 },
    );
  }

  if ((snippetRefCount ?? 0) > 0) {
    const { error: softDeleteError } = await supabase
      .from("documents")
      .update({
        hidden: true,
        hidden_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", document.id)
      .eq("user_id", user.id);

    if (softDeleteError) {
      return NextResponse.json(
        { error: `Failed to soft delete: ${softDeleteError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, mode: "soft" });
  }

  // 1. Delete from documents table
  const { error: docError } = await supabase
    .from("documents")
    .delete()
    .eq("id", document.id)
    .eq("user_id", user.id);

  if (docError) {
    errors.push(`documents: ${docError.message}`);
  }

  // 2. Delete from document_chunks table
  const { error: chunksError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_path", storagePath)
    .eq("user_id", user.id);

  if (chunksError) {
    errors.push(`document_chunks: ${chunksError.message}`);
  }

  // 3. Delete from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (storageError) {
    errors.push(`storage: ${storageError.message}`);
  }

  if (errors.length > 0) {
    console.error("[/api/documents/delete] partial failures:", errors);
    return NextResponse.json(
      { error: `Partial delete failure: ${errors.join("; ")}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, mode: "hard" });
}
