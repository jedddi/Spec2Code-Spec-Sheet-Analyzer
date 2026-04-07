import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BATCH = 200;

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

  const {
    documentIds,
    archived,
    favorited,
  } = body as {
    documentIds?: unknown;
    archived?: unknown;
    favorited?: unknown;
  };

  if (
    !Array.isArray(documentIds) ||
    documentIds.length === 0 ||
    documentIds.length > MAX_BATCH ||
    !documentIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return NextResponse.json(
      { error: `Provide 1–${MAX_BATCH} document IDs` },
      { status: 400 },
    );
  }

  const updates: Record<string, boolean> = {};
  if (typeof archived === "boolean") {
    updates.archived = archived;
  }
  if (typeof favorited === "boolean") {
    updates.favorited = favorited;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Provide `archived` and/or `favorited` as booleans" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("documents")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .in("id", documentIds as string[])
    .select("id");

  if (error) {
    const hint =
      error.message.includes("archived") || error.message.includes("favorited")
        ? " Apply migration 014_documents_archived_favorited.sql on your Supabase project."
        : "";
    return NextResponse.json(
      { error: `${error.message}${hint}` },
      { status: 500 },
    );
  }

  const updated = data?.length ?? 0;
  if (updated === 0) {
    return NextResponse.json(
      {
        error:
          "No matching documents were updated. They may belong to another account or the selection is stale.",
        updated: 0,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, updated });
}
