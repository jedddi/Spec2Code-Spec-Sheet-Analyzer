import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, createServerSupabase } from "@/src/lib/supabase/server";
import { chatComplete, type ChatMessage } from "@/src/lib/ai/openrouter";

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

  try {
    const { data: chunks, error: queryError } = await supabaseAdmin
      .from("document_chunks")
      .select("content")
      .eq("user_id", user.id)
      .eq("document_path", storagePath)
      .order("chunk_index", { ascending: true });

    if (queryError) {
      throw new Error(`Failed to fetch chunks: ${queryError.message}`);
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "No ingested text found for this file. Upload and ingest it first.",
        },
        { status: 404 },
      );
    }

    const fullText = chunks.map((c) => c.content).join("\n\n");

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: `Write a C++ header for the hardware described in this text. Focus only on this component.\n\n${fullText}`,
      },
    ];
    const code = await chatComplete(messages);

    return NextResponse.json({ code });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error generating header";
    console.error("[/api/generate-header]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
