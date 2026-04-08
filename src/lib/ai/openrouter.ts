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
// Streaming chat completion — returns a ReadableStream<Uint8Array> of raw
// text (same contract the existing chat route returns to the client).
// ---------------------------------------------------------------------------

export function chatStream(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const body: Record<string, unknown> = {
        model: opts.model ?? CHAT_MODEL,
        messages,
        stream: true,
      };
      if (opts.temperature !== undefined) body.temperature = opts.temperature;

      let res: Response;
      try {
        res = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(body),
        });
      } catch (err) {
        controller.error(err);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        controller.error(
          new Error(`OpenRouter stream error ${res.status}: ${text}`),
        );
        return;
      }

      if (!res.body) {
        controller.error(new Error("OpenRouter returned no response body"));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as {
                choices: { delta: { content?: string } }[];
              };
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // malformed SSE chunk — skip
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
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
