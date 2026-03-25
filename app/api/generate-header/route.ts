import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-2.5-flash";

export async function POST(request: NextRequest) {
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

  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (!googleApiKey) {
    return NextResponse.json(
      { error: "Missing env var GOOGLE_API_KEY" },
      { status: 500 },
    );
  }

  try {
    const { data: chunks, error: queryError } = await supabaseAdmin
      .from("document_chunks")
      .select("content")
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

    const prompt = `Write a C++ header for the hardware described in this text. Focus only on this component.\n\n${fullText}`;

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const code = result.response.text();

    return NextResponse.json({ code });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error generating header";
    console.error("[/api/generate-header]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
