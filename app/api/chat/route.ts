import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import type { NextRequest } from "next/server";
import { searchDocuments } from "@/src/lib/retrieval/search";
import { createServerSupabase } from "@/src/lib/supabase/server";
import { getChatLanguageModel, type ChatMessage } from "@/src/lib/ai/openrouter";

export const runtime = "nodejs";
export const maxDuration = 120;

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

function textFromUIMessageLike(msg: unknown): string {
  if (!msg || typeof msg !== "object") return "";
  const m = msg as {
    role?: string;
    content?: unknown;
    parts?: unknown[];
  };
  if (m.role !== "user") return "";
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter(
        (p): p is { type?: string; text?: string } =>
          !!p && typeof p === "object",
      )
      .filter((p) => p.type === "text")
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("");
  }
  return "";
}

function extractUserQueryFromBody(body: Record<string, unknown>): string | null {
  const q = body.query;
  if (typeof q === "string" && q.trim().length > 0) return q.trim();

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages)) return null;
  for (let i = rawMessages.length - 1; i >= 0; i--) {
    const text = textFromUIMessageLike(rawMessages[i]).trim();
    if (text.length > 0) return text;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const b = body as Record<string, unknown>;
  const query = extractUserQueryFromBody(b);
  if (!query) {
    return new Response(
      JSON.stringify({
        error: "Missing or invalid `query` or last user `messages` entry",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { matches, lowConfidence } = await searchDocuments(
      query,
      user.id,
      DEFAULT_TOP_K,
    );

    const PREVIEW_LENGTH = 200;
    const citations = matches.map((match) => ({
      document_path: match.document_path,
      preview:
        match.content.slice(0, PREVIEW_LENGTH) +
        (match.content.length > PREVIEW_LENGTH ? "…" : ""),
      chunk_index: match.chunk_index,
      page: match.page,
      similarity: Number(match.similarity.toFixed(3)),
    }));

    const prompt = buildPrompt(
      query,
      matches.map(
        (match) =>
          `[source: ${cleanFilename(match.document_path)}]\n${match.content}`,
      ),
    );

    const llmMessages: ChatMessage[] = [{ role: "user", content: prompt }];

    const responseHeaders: Record<string, string> = {
      "Cache-Control": "no-cache, no-transform",
      "x-chat-sources": encodeURIComponent(JSON.stringify(citations)),
      "x-chat-confidence": lowConfidence ? "low" : "high",
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "data-chatPhase",
          data: { phase: "analyzing" },
          transient: true,
        });
        const result = streamText({
          model: getChatLanguageModel(),
          messages: llmMessages,
        });
        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown chat error";
    console.error("[/api/chat]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
