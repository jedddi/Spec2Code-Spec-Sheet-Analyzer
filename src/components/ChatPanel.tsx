"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type Citation = {
  document_path: string;
  preview: string;
  similarity: number;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
};

const UUID_PREFIX_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

function cleanFilename(documentPath: string): string {
  const parts = documentPath.split("/");
  const raw = parts[parts.length - 1] || documentPath;
  const match = raw.match(UUID_PREFIX_RE);
  return match ? match[2] : raw;
}

function CitationsDropdown({ citations, messageId }: { citations: Citation[]; messageId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  if (citations.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {citations.length} source{citations.length !== 1 ? "s" : ""}
      </button>

      {isOpen && (
        <ul className="mt-2 space-y-2">
          {citations.map((citation, idx) => (
            <li
              key={`${messageId}-cit-${idx}`}
              className="rounded-lg border border-primary/25 bg-card px-3 py-2"
            >
              <p className="text-xs font-semibold text-primary">
                {cleanFilename(citation.document_path)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {citation.preview}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Similarity: {citation.similarity}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setQuery("");
    setIsSending(true);
    setIsWaitingForFirstToken(true);

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: trimmed },
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    scrollToBottom();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const responseSourcesHeader = response.headers.get("x-chat-sources");
      let responseCitations: Citation[] = [];
      if (responseSourcesHeader) {
        try {
          const parsed = JSON.parse(decodeURIComponent(responseSourcesHeader)) as unknown;
          if (Array.isArray(parsed)) {
            responseCitations = parsed.filter(
              (item): item is Citation =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as Citation).document_path === "string" &&
                typeof (item as Citation).preview === "string",
            );
          }
        } catch {
          responseCitations = [];
        }
      }

      if (!response.ok) {
        let message = "Chat request failed";
        try {
          const errorPayload = (await response.json()) as { error?: string };
          message = errorPayload.error ?? message;
        } catch {
          // Keep default message when response body is not JSON.
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("No response stream received from chat API.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let sawFirstToken = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        sawFirstToken = true;
        setIsWaitingForFirstToken(false);
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulated, citations: responseCitations }
              : msg,
          ),
        );
        scrollToBottom();
      }

      if (!sawFirstToken) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: "I don't have enough information.",
                  citations: responseCitations,
                }
              : msg,
          ),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown chat error";
      setError(message);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: "I don't have enough information." }
            : msg,
        ),
      );
    } finally {
      setIsSending(false);
      setIsWaitingForFirstToken(false);
      scrollToBottom();
    }
  }

  return (
    <section className="mx-auto flex h-full w-full max-w-4xl flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border-2 border-primary/50 bg-card p-4">
        {!hasMessages ? (
          <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-primary/35 bg-primary/5 p-6 text-center">
            <p className="max-w-lg text-sm text-muted-foreground">
              Ask a question about your uploaded files. Answers are grounded in retrieved
              document chunks from Supabase.
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <article
              key={message.id}
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                isUser
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto border border-primary/25 bg-primary/10 text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content || "..."}</p>

              {!isUser && message.citations && message.citations.length > 0 ? (
                <CitationsDropdown citations={message.citations} messageId={message.id} />
              ) : null}
            </article>
          );
        })}

        {isWaitingForFirstToken ? (
          <p className="text-sm font-medium text-primary animate-pulse">Thinking...</p>
        ) : null}

        <div ref={messageEndRef} />
      </div>

      <form
        onSubmit={submitQuestion}
        className="sticky bottom-0 mt-4 rounded-xl border border-border bg-card p-3 shadow-sm"
      >
        <div className="flex items-end gap-3">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask a question about your uploaded documents..."
            rows={2}
            className="min-h-12 flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring"
            disabled={isSending}
          />

          <button
            type="submit"
            disabled={isSending || query.trim().length === 0}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 disabled:hover:bg-primary"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>

        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </form>
    </section>
  );
}
