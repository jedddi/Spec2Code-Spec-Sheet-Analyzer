import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { searchDocuments } from "@/src/lib/retrieval/search";

export const runtime = "nodejs";

const CHAT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_TOP_K = 6;

const UUID_PREFIX_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

function cleanFilename(documentPath: string): string {
  const parts = documentPath.split("/");
  const raw = parts[parts.length - 1] || documentPath;
  const match = raw.match(UUID_PREFIX_RE);
  return match ? match[2] : raw;
}

function buildPrompt(query: string, contextChunks: string[]) {
  const contextBlock =
    contextChunks.length > 0
      ? contextChunks
          .map((chunk, i) => `Chunk ${i + 1}:\n${chunk}`)
          .join("\n\n---\n\n")
      : "No context chunks were retrieved.";

  return `
You are a document QA assistant.

Rules:
- Answer using only the provided context.
- If the context is insufficient, respond exactly: "I don't have enough information."
- Keep answers concise and factual.
- Do NOT include a "Sources:" section. Source citations are handled separately by the UI.

Context:
${contextBlock}

User question:
${query}
`.trim();
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query } = body as { query?: string };
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or invalid `query` field" },
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
    const matches = await searchDocuments(query, DEFAULT_TOP_K);

    const PREVIEW_LENGTH = 200;
    const citations = matches.map((match) => ({
      document_path: match.document_path,
      preview: match.content.slice(0, PREVIEW_LENGTH) + (match.content.length > PREVIEW_LENGTH ? "…" : ""),
      similarity: Number(match.similarity.toFixed(3)),
    }));

    const prompt = buildPrompt(
      query.trim(),
      matches.map(
        (match) =>
          `[source: ${cleanFilename(match.document_path)}]\n${match.content}`,
      ),
    );

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: CHAT_MODEL });
    const result = await model.generateContentStream(prompt);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "x-chat-sources": encodeURIComponent(JSON.stringify(citations)),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown chat error";
    console.error("[/api/chat]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
