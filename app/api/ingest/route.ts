import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/src/lib/ingest/extract";
import { chunkText } from "@/src/lib/ingest/chunk";
import { generateEmbeddings } from "@/src/lib/ingest/embed";
import { supabaseAdmin } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

  try {
    const text = await extractTextFromPdf(storagePath);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "PDF produced no text chunks after splitting" },
        { status: 422 },
      );
    }

    const embeddings = await generateEmbeddings(
      chunks.map((c) => c.content),
    );

    // Remove any existing chunks for this document (safe re-ingestion)
    const { error: deleteError } = await supabaseAdmin
      .from("document_chunks")
      .delete()
      .eq("document_path", storagePath);

    if (deleteError) {
      throw new Error(`Failed to clear old chunks: ${deleteError.message}`);
    }

    const rows = chunks.map((chunk, i) => ({
      document_path: storagePath,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      metadata: {},
    }));

    // Insert in batches of 500 to avoid payload limits
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabaseAdmin
        .from("document_chunks")
        .insert(batch);

      if (insertError) {
        throw new Error(
          `Failed to insert chunks (batch starting at ${i}): ${insertError.message}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      documentPath: storagePath,
      chunkCount: chunks.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown ingestion error";
    console.error("[/api/ingest]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
