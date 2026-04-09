"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getTextFromUIMessage } from "@/src/lib/chat/ui-message-text";
import type { AppChatUIMessage, ChatLoadingPhase } from "@/src/hooks/useChatV2";
import LoadingStatus from "@/src/components/v2/LoadingStatus";

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
const SIDEBAR_CHAT_ID = "sidebar-local";

const UUID_PREFIX_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

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

function parseCitations(header: string | null): Citation[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(header)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Citation =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Citation).document_path === "string" &&
        typeof (item as Citation).preview === "string",
    );
  } catch {
    return [];
  }
}

function storedToUi(m: ChatMessage): AppChatUIMessage {
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content, state: "done" }],
    metadata: m.citations?.length ? { citations: m.citations as never } : undefined,
  };
}

function CitationsDropdown({
  citations,
  messageId,
}: {
  citations: Citation[];
  messageId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (citations.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded-md border border-primary/40 bg-card px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
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
              className="rounded-md border border-primary/25 bg-card px-2 py-1.5"
            >
              <p className="text-[11px] font-semibold text-primary">
                {cleanFilename(citation.document_path)}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
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
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [citationEpoch, setCitationEpoch] = useState(0);
  const [serverPhase, setServerPhase] = useState<ChatLoadingPhase>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timestampsRef = useRef<Record<string, number>>({});
  const citationsRef = useRef<Citation[]>([]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AppChatUIMessage>({
        api: "/api/chat",
        fetch: async (inputUrl, init) => {
          const res = await fetch(inputUrl, init);
          if (res.ok) {
            citationsRef.current = parseCitations(
              res.headers.get("x-chat-sources"),
            );
            setCitationEpoch((e) => e + 1);
          }
          return res;
        },
      }),
    [],
  );

  const { messages: uiMessages, sendMessage, setMessages: setUiMessages, status } =
    useChat<AppChatUIMessage>({
      id: SIDEBAR_CHAT_ID,
      transport,
      onData: (part) => {
        if (part.type === "data-chatPhase") {
          setServerPhase(part.data.phase);
        }
      },
      onFinish: ({ message: assistantMsg }) => {
        setServerPhase(null);
        const snap = [...citationsRef.current];
        citationsRef.current = [];
        if (snap.length === 0) return;
        setUiMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, metadata: { ...m.metadata, citations: snap as never } }
              : m,
          ),
        );
      },
      onError: (err) => {
        setServerPhase(null);
        setError(err.message ?? "Chat error");
        setUiMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? {
                    ...m,
                    parts: [
                      {
                        type: "text",
                        text: "Something went wrong. Please try again.",
                        state: "done",
                      },
                    ],
                  }
                : m,
            );
          }
          return prev;
        });
      },
    });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUiMessages(parsed.map(storedToUi));
          for (const m of parsed) {
            timestampsRef.current[m.id] = m.timestamp;
          }
        }
      }
    } catch {
      /* corrupted storage */
    }
    setHydrated(true);
  }, [setUiMessages]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    const now = Date.now();
    for (const m of uiMessages) {
      if (!timestampsRef.current[m.id]) {
        timestampsRef.current[m.id] = now;
      }
    }
    void citationEpoch;
    setMessages(
      uiMessages.map((m, i) => {
        const content = getTextFromUIMessage(m);
        const meta = m.metadata as { citations?: Citation[] } | undefined;
        const isLastAssistant =
          m.role === "assistant" && i === uiMessages.length - 1;
        let citations = meta?.citations;
        if (
          isLastAssistant &&
          citationsRef.current.length > 0 &&
          (status === "streaming" || status === "submitted")
        ) {
          citations = citationsRef.current;
        }
        const ts = timestampsRef.current[m.id];
        return {
          id: m.id,
          role: m.role as "user" | "assistant",
          content,
          timestamp: ts ?? now,
          citations,
        };
      }),
    );
  }, [uiMessages, status, citationEpoch, hydrated]);

  const loadingPhase: ChatLoadingPhase = (() => {
    const last = uiMessages[uiMessages.length - 1];
    if (last?.role === "assistant" && getTextFromUIMessage(last).length > 0) {
      return "writing";
    }
    if (serverPhase) return serverPhase;
    if (status === "submitted") return "searching";
    if (status === "streaming" && last?.role === "assistant") return "analyzing";
    return null;
  })();

  const isSending = status === "submitted" || status === "streaming";

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

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput("");
    setError(null);

    try {
      await sendMessage({ text: trimmed });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown chat error";
      setError(message);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function clearHistory() {
    setUiMessages([]);
    timestampsRef.current = {};
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
    <aside className="flex h-full w-[440px] flex-shrink-0 flex-col border-r border-border bg-muted p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Chat</h2>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="px-4 text-center text-sm text-muted-foreground">
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
                            ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-2xl rounded-bl-md bg-muted text-foreground"
                        }`}
                      >
                        {!isUser && msg.content === "" ? (
                          <div className="space-y-2">
                            <LoadingStatus
                              phase={loadingPhase}
                              className="text-muted-foreground"
                            />
                            <span className="inline-flex gap-1">
                              <span className="animate-bounce">.</span>
                              <span className="animate-bounce [animation-delay:0.15s]">
                                .
                              </span>
                              <span className="animate-bounce [animation-delay:0.3s]">
                                .
                              </span>
                            </span>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}

                        {!isUser &&
                          msg.citations &&
                          msg.citations.length > 0 &&
                          msg.content !== "" && (
                            <CitationsDropdown
                              citations={msg.citations}
                              messageId={msg.id}
                            />
                          )}
                      </div>
                      <span className="mt-1 px-1 text-[10px] text-muted-foreground">
                        {formatTime(msg.timestamp)}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card px-3 py-3">
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your documents..."
              rows={1}
              disabled={isSending}
              className="min-h-[40px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isSending || input.trim().length === 0}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary"
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
