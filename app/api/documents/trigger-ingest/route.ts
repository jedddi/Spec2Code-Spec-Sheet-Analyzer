import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Re-invokes the `ingest-document` Edge Function with a webhook-shaped payload.
 * Use when a row is stuck in `processing` (e.g. first webhook delivery died mid-flight
 * and INSERT does not fire again).
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

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anon) {
    return NextResponse.json(
      { error: "Server missing Supabase URL or anon key" },
      { status: 500 },
    );
  }

  const webhookSecret = process.env.INGEST_WEBHOOK_SECRET;

  const fnUrl = `${baseUrl}/functions/v1/ingest-document`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      ...(webhookSecret
        ? { "x-webhook-secret": webhookSecret }
        : {}),
    },
    body: JSON.stringify({
      type: "INSERT",
      table: "documents",
      schema: "public",
      record: { id: doc.id },
    }),
  });

  const text = await res.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        error: "Edge function error",
        status: res.status,
        detail: payload,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, edge: payload });
}
