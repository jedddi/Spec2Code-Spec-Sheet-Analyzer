import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

const BASE_URL = "https://openrouter.ai/api/v1";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Missing env var OPENROUTER_API_KEY");
  return key;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
  if (process.env.OPENROUTER_HTTP_REFERER)
    h["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  if (process.env.OPENROUTER_APP_NAME)
    h["X-Title"] = process.env.OPENROUTER_APP_NAME;
  return h;
}

// ---------------------------------------------------------------------------
// Models (env-overridable)
// ---------------------------------------------------------------------------

export const CHAT_MODEL =
  process.env.OPENROUTER_CHAT_MODEL ?? "openai/gpt-4o-mini";

let openRouterProvider: ReturnType<typeof createOpenRouter> | null = null;

/**
 * OpenRouter provider for Vercel AI SDK (`streamText`, etc.).
 * Uses the same env vars as manual `fetch` helpers below.
 */
export function getOpenRouterProvider() {
  if (!openRouterProvider) {
    openRouterProvider = createOpenRouter({
      apiKey: getApiKey(),
      appUrl: process.env.OPENROUTER_HTTP_REFERER,
      appName: process.env.OPENROUTER_APP_NAME,
    });
  }
  return openRouterProvider;
}

/** Language model for RAG chat completions (env: OPENROUTER_CHAT_MODEL). */
export function getChatLanguageModel(): LanguageModel {
  return getOpenRouterProvider()(CHAT_MODEL);
}

export const METADATA_MODEL =
  process.env.OPENROUTER_METADATA_MODEL ?? CHAT_MODEL;

export const EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

export const EMBEDDING_DIMS = 768;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionChoice {
  message: { content: string };
}

interface EmbeddingData {
  embedding: number[];
}

// ---------------------------------------------------------------------------
// Non-streaming chat completion
// ---------------------------------------------------------------------------

export async function chatComplete(
  messages: ChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    responseFormat?: { type: string };
  } = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model ?? CHAT_MODEL,
    messages,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.responseFormat) body.response_format = opts.responseFormat;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter chat error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { choices: ChatCompletionChoice[] };
  return json.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Embeddings — batched, always 768-dim
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const embeddings: number[][] = new Array(texts.length);

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);

    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMS,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter embeddings error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { data: EmbeddingData[] };

    for (const item of json.data) {
      if (item.embedding.length !== EMBEDDING_DIMS) {
        throw new Error(
          `Expected ${EMBEDDING_DIMS}-dim embedding, got ${item.embedding.length}`,
        );
      }
    }

    // OpenRouter returns data sorted by index — mirror the input order
    const sorted = [...json.data].sort(
      (a, b) =>
        (a as unknown as { index: number }).index -
        (b as unknown as { index: number }).index,
    );
    for (let i = 0; i < sorted.length; i++) {
      embeddings[start + i] = sorted[i].embedding;
    }
  }

  return embeddings;
}
