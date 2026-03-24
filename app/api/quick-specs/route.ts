import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `You are a Hardware Validation Engineer. Extract technical specifications from the provided datasheet text. You MUST return the data in a clean Markdown table with the following columns: Parameter, Value, and Notes.
Focus on:

    Power: VCC range and typical current.

    Communication: Protocol (I2C/SPI/UART) and addresses/baud rates.

    Environment: Operating temperature range.

    Safety: Any Absolute Maximum Ratings.
    If a value is not found, write "Not Specified" in the Value column.`;

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

    const prompt = `${SYSTEM_PROMPT}\n\nDatasheet text:\n${fullText}`;

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const specs = result.response.text();

    return NextResponse.json({ specs });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error extracting specs";
    console.error("[/api/quick-specs]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
