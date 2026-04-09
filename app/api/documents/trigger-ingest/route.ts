import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";
import { inngest } from "@/src/lib/inngest/client";

export const runtime = "nodejs";

/**
 * Re-queues ingestion via Inngest for a document the user owns.
 * Use when a row is stuck in `processing` (e.g. worker died mid-run) or after `failed` to retry.
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

  const { documentId } = body as { documentId?: string };
  if (!documentId || typeof documentId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid documentId" },
      { status: 400 },
    );
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, user_id, status")
    .eq("id", documentId)
    .maybeSingle();

  if (docError) {
    return NextResponse.json(
      { error: docError.message },
      { status: 500 },
    );
  }

  if (!doc || doc.user_id !== user.id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await inngest.send({
    name: "document/ingest.requested",
    data: { documentId: doc.id },
  });

  return NextResponse.json({ ok: true, documentId: doc.id });
}
