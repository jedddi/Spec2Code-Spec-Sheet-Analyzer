import { NextRequest, NextResponse } from "next/server";
import { searchDocuments } from "@/src/lib/retrieval/search";
import { createServerSupabase } from "@/src/lib/supabase/server";
import { chatStream, type ChatMessage } from "@/src/lib/ai/openrouter";

export const runtime = "nodejs";

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
You are an expert Hardware Integration Assistant.

Rules:
- Use the provided context to extract specific electrical characteristics, pinouts, and communication protocols.
- You may use your internal knowledge of microcontrollers and electronics to interpret how the data in the context applies to the user's specific application
- If your internal knowledge contradicts the provided context, always prioritize the context.
- If a specific technical value required for an answer (like a max voltage) is missing from both the context and your internal knowledge, respond: "I don't have enough information."
- Keep answers technical, concise, and focused on implementation.
- Do NOT include a "Sources:" section. Source citations are handled separately by the UI.

Context:
${contextBlock}

User question:
${query}
`.trim();
}

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

  const { query } = body as { query?: string };
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or invalid `query` field" },
      { status: 400 },
    );
  }

  try {
    const matches = await searchDocuments(query, user.id, DEFAULT_TOP_K);

    const PREVIEW_LENGTH = 200;
    const citations = matches.map((match) => ({
      document_path: match.document_path,
      preview: match.content.slice(0, PREVIEW_LENGTH) + (match.content.length > PREVIEW_LENGTH ? "…" : ""),
      chunk_index: match.chunk_index,
      page: match.page,
      similarity: Number(match.similarity.toFixed(3)),
    }));

    const prompt = buildPrompt(
      query.trim(),
      matches.map(
        (match) =>
          `[source: ${cleanFilename(match.document_path)}]\n${match.content}`,
      ),
    );

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    const stream = chatStream(messages);

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
