"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Citation = {
  document_path: string;
  preview: string;
  similarity: number;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  citations?: Citation[];
}

const STORAGE_KEY = "chat-history";

const UUID_PREFIX_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-50"
      >
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
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
        <ul className="mt-1.5 space-y-1.5">
          {citations.map((citation, idx) => (
            <li
              key={`${messageId}-cit-${idx}`}
              className="rounded-md border border-blue-200 bg-white px-2 py-1.5"
            >
              <p className="text-[11px] font-semibold text-blue-800">
                {cleanFilename(citation.document_path)}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-zinc-600">
                {citation.preview}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SidebarChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function sendMessage(userContent: string) {
    setError(null);
    setIsSending(true);
    setIsWaitingForFirstToken(true);

    const assistantMessageId = generateId();

    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "", timestamp: Date.now() },
    ]);
    scrollToBottom();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userContent }),
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
          // keep default
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
            ? { ...msg, content: "Something went wrong. Please try again." }
            : msg,
        ),
      );
    } finally {
      setIsSending(false);
      setIsWaitingForFirstToken(false);
      scrollToBottom();
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    sendMessage(trimmed);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }

  return (
    <aside className="flex h-full w-[440px] flex-shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-4">
      {/* Floating chat card */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Chat</h2>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="px-4 text-center text-sm text-zinc-400">
                Ask a question about your uploaded documents.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? "rounded-2xl rounded-br-md bg-blue-600 text-white"
                            : "rounded-2xl rounded-bl-md bg-zinc-200 text-zinc-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content || "..."}</p>

                        {!isUser && msg.citations && msg.citations.length > 0 && (
                          <CitationsDropdown citations={msg.citations} messageId={msg.id} />
                        )}
                      </div>
                      <span className="mt-1 px-1 text-[10px] text-zinc-400">
                        {formatTime(msg.timestamp)}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {isWaitingForFirstToken && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex items-start"
                >
                  <div className="rounded-2xl rounded-bl-md bg-zinc-200 px-3.5 py-2.5 text-sm text-zinc-500">
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce [animation-delay:0.15s]">.</span>
                      <span className="animate-bounce [animation-delay:0.3s]">.</span>
                    </span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-200 bg-white px-3 py-3">
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your documents..."
              rows={1}
              disabled={isSending}
              className="min-h-[40px] flex-1 resize-none rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || input.trim().length === 0}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
              aria-label="Send"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
