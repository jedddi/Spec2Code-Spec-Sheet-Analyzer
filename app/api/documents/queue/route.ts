import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";
import { inngest } from "@/src/lib/inngest/client";

export const runtime = "nodejs";

/**
 * Queues document ingestion via Inngest (service role is not required here — only `send` + user-scoped row check).
 */
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

  const { documentId, storagePath } = body as {
    documentId?: string;
    storagePath?: string;
  };

  let resolvedId: string | null = null;

  if (documentId && typeof documentId === "string") {
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("id", documentId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!doc || doc.user_id !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    resolvedId = doc.id;
  } else if (storagePath && typeof storagePath === "string") {
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("user_id", user.id)
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    resolvedId = doc.id;
  } else {
    return NextResponse.json(
      { error: "Provide documentId or storagePath" },
      { status: 400 },
    );
  }

  await inngest.send({
    name: "document/ingest.requested",
    data: { documentId: resolvedId },
  });

  return NextResponse.json({ ok: true, documentId: resolvedId });
}
