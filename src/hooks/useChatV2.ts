"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/src/lib/supabase/client";
import { createMockChatResponse } from "@/src/lib/chat/mock-ui-chat-response";
import { getTextFromUIMessage } from "@/src/lib/chat/ui-message-text";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ChatSession } from "./useChatSessions";

export type Citation = {
  document_path: string;
  preview: string;
  chunk_index: number;
  page: number | null;
  similarity: number;
};

export type ChatMessageV2 = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  lowConfidence?: boolean;
};

export type ChatLoadingPhase = "searching" | "analyzing" | "writing" | null;

type ChatDataTypes = {
  chatPhase: { phase: "searching" | "analyzing" | "writing" };
};

type ChatMessageMetadata = {
  citations?: Citation[];
  lowConfidence?: boolean;
};

export type AppChatUIMessage = UIMessage<ChatMessageMetadata, ChatDataTypes>;

interface UseChatV2Options {
  mockMode?: boolean;
  sessionId?: string | null;
  userId?: string;
  router?: AppRouterInstance;
  createSession?: (title: string) => Promise<ChatSession | null>;
  refetchSessions?: () => void;
  /** When true, submitQuery only creates session + persists + navigates (no RAG call). */
  redirectOnly?: boolean;
}

const MOCK_RESPONSE = `[MOCK]: I have processed your request for the selected datasheet. Here is the architectural summary...

**Key Components:**
- Component A: Signal processing pipeline with configurable gain stages
- Component B: Power management unit with thermal protection
- Component C: Communication interface supporting SPI/I2C protocols

| Parameter | Min | Typ | Max | Unit |
|-----------|-----|-----|-----|------|
| Supply Voltage | 2.7 | 3.3 | 3.6 | V |
| Operating Temp | -40 | 25 | 85 | °C |
| Clock Freq | — | 16 | 20 | MHz |

\`\`\`c
// Example register configuration
void init_device(void) {
    write_reg(CTRL_REG1, 0x47); // Enable all axes, 50Hz ODR
    write_reg(CTRL_REG4, 0x30); // Full-scale ±2000 dps
}
\`\`\`

> This is a mock response for UI testing. No API credits were used.`;

const MOCK_DELAY_MS = 1500;
const SESSION_TITLE_MAX_LEN = 50;

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
        typeof (item as Citation).preview === "string" &&
        typeof (item as Citation).chunk_index === "number" &&
        ((item as Citation).page === null ||
          typeof (item as Citation).page === "number"),
    );
  } catch {
    return [];
  }
}

function rowToUIMessage(row: {
  id: string;
  role: string;
  content: string;
  citations: unknown;
}): AppChatUIMessage {
  const role = row.role as "user" | "assistant";
  const citations = row.citations as Citation[] | null;
  return {
    id: row.id as string,
    role,
    parts: [
      {
        type: "text",
        text: row.content as string,
        state: "done",
      },
    ],
    metadata:
      role === "assistant" && citations && citations.length > 0
        ? { citations }
        : undefined,
  };
}

export function useChatV2({
  mockMode = false,
  sessionId = null,
  userId,
  router,
  createSession,
  refetchSessions,
  redirectOnly = false,
}: UseChatV2Options = {}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [citationEpoch, setCitationEpoch] = useState(0);
  const [serverPhase, setServerPhase] = useState<ChatLoadingPhase>(null);

  const inFlightRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(sessionId ?? null);
  const autoTriggeredRef = useRef(false);
  const mockModeRef = useRef(mockMode);
  const citationsRef = useRef<Citation[]>([]);
  const lowConfidenceRef = useRef(false);
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const persistMessageRef = useRef<
    | ((
        sid: string,
        msg: {
          id: string;
          role: string;
          content: string;
          citations?: Citation[];
        },
      ) => Promise<void>)
    | null
  >(null);

  useEffect(() => {
    mockModeRef.current = mockMode;
  }, [mockMode]);

  useEffect(() => {
    currentSessionIdRef.current = sessionId ?? null;
  }, [sessionId]);

  const chatId = useMemo(
    () => sessionId ?? `draft-${userId ?? "anon"}`,
    [sessionId, userId],
  );

  const persistMessage = useCallback(
    async (
      sid: string,
      msg: { id: string; role: string; content: string; citations?: Citation[] },
    ) => {
      await supabase.from("chat_messages").upsert(
        {
          id: msg.id,
          session_id: sid,
          role: msg.role,
          content: msg.content,
          citations: msg.citations ?? null,
        },
        { onConflict: "id" },
      );
    },
    [supabase],
  );

  persistMessageRef.current = persistMessage;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AppChatUIMessage>({
        api: "/api/chat",
        fetch: async (input, init) => {
          if (mockModeRef.current) {
            return createMockChatResponse(MOCK_RESPONSE, MOCK_DELAY_MS);
          }
          const res = await fetch(input, init);
          if (res.ok) {
            citationsRef.current = parseCitations(
              res.headers.get("x-chat-sources"),
            );
            lowConfidenceRef.current =
              res.headers.get("x-chat-confidence") === "low";
            setCitationEpoch((e) => e + 1);
          }
          return res;
        },
      }),
    [],
  );

  const { messages: uiMessages, sendMessage, setMessages: setUiMessages, status } =
    useChat<AppChatUIMessage>({
      id: chatId,
      transport,
      onData: (part) => {
        if (part.type === "data-chatPhase") {
          setServerPhase(part.data.phase);
        }
      },
      onFinish: async ({ messages: allMessages }) => {
        setServerPhase(null);
        const sid = currentSessionIdRef.current;
        const citationsSnapshot = [...citationsRef.current];
        const lowSnap = lowConfidenceRef.current;
        citationsRef.current = [];
        lowConfidenceRef.current = false;

        const persist = persistMessageRef.current;
        if (!sid || !persist) return;

        const n = allMessages.length;
        if (n < 2) return;

        const assistantMsg = allMessages[n - 1];
        const userMsg = allMessages[n - 2];

        if (userMsg?.role === "user") {
          await persist(sid, {
            id: userMsg.id,
            role: "user",
            content: getTextFromUIMessage(userMsg),
          });
        }

        if (assistantMsg?.role === "assistant") {
          const text =
            getTextFromUIMessage(assistantMsg).trim() ||
            "I don't have enough information.";
          await persist(sid, {
            id: assistantMsg.id,
            role: "assistant",
            content: text,
            citations: citationsSnapshot.length ? citationsSnapshot : undefined,
          });

          setUiMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    metadata: {
                      citations: citationsSnapshot.length
                        ? citationsSnapshot
                        : m.metadata?.citations,
                      lowConfidence: lowSnap,
                    },
                  }
                : m,
            ),
          );
        }
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
                        text: "I don't have enough information.",
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
    if (!sessionId) {
      setUiMessages([]);
      autoTriggeredRef.current = false;
      setIsLoadingHistory(false);
      return;
    }

    let cancelled = false;
    setIsLoadingHistory(true);
    autoTriggeredRef.current = false;

    void (async () => {
      const { data, error: fetchError } = await supabase
        .from("chat_messages")
        .select("id, role, content, citations, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (!fetchError && data && data.length > 0) {
        setUiMessages(data.map(rowToUIMessage));
      } else {
        setUiMessages([]);
      }
      setIsLoadingHistory(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase, setUiMessages]);

  const messages: ChatMessageV2[] = useMemo(() => {
    void citationEpoch;
    return uiMessages.map((m, i) => {
      const content = getTextFromUIMessage(m);
      const meta = m.metadata;
      const isLastAssistant = m.role === "assistant" && i === uiMessages.length - 1;
      let citations = meta?.citations;
      let lowConfidence = meta?.lowConfidence;
      if (
        isLastAssistant &&
        citationsRef.current.length > 0 &&
        (status === "streaming" || status === "submitted")
      ) {
        citations = citationsRef.current;
        lowConfidence = lowConfidenceRef.current;
      }
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        content,
        citations,
        lowConfidence,
      };
    });
  }, [uiMessages, status, citationEpoch]);

  const loadingPhase: ChatLoadingPhase = useMemo(() => {
    const last = uiMessages[uiMessages.length - 1];
    if (last?.role === "assistant" && getTextFromUIMessage(last).length > 0) {
      return "writing";
    }
    if (serverPhase) return serverPhase;
    if (status === "submitted") return "searching";
    if (status === "streaming" && last?.role === "assistant") return "analyzing";
    return null;
  }, [serverPhase, status, uiMessages]);

  const isSending = status === "submitted" || status === "streaming";
  const isWaitingForFirstToken =
    status === "streaming" &&
    uiMessages[uiMessages.length - 1]?.role === "assistant" &&
    getTextFromUIMessage(uiMessages[uiMessages.length - 1]!).length === 0;

  const isActive = messages.length > 0;

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> =
    useCallback((e) => setInput(e.target.value), []);

  const submitQuery = useCallback(
    (trimmed: string) => {
      if (!trimmed || inFlightRef.current) return;
      inFlightRef.current = true;
      setError(null);

      void (async () => {
        try {
          let sid = currentSessionIdRef.current;

          if (!sid && createSession) {
            const title = trimmed.substring(0, SESSION_TITLE_MAX_LEN);
            const session = await createSession(title);
            if (session) {
              sid = session.id;
              currentSessionIdRef.current = sid;
              refetchSessions?.();
            }
          }

          if (redirectOnly && sid && router) {
            await persistMessage(sid, {
              id: crypto.randomUUID(),
              role: "user",
              content: trimmed,
            });
            const params = new URLSearchParams({ id: sid });
            if (mockMode) params.set("mock", "1");
            router.push(`/chat?${params.toString()}`);
            return;
          }

          if (sid && router && !sessionId) {
            router.push(`/chat?id=${sid}`);
          }

          if (!sid) {
            throw new Error("Could not create chat session.");
          }

          await sendMessage({ text: trimmed });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown chat error";
          setError(message);
        } finally {
          inFlightRef.current = false;
        }
      })();
    },
    [
      redirectOnly,
      sessionId,
      router,
      createSession,
      refetchSessions,
      persistMessage,
      sendMessage,
      mockMode,
    ],
  );

  useEffect(() => {
    if (isLoadingHistory || autoTriggeredRef.current || redirectOnly) return;
    if (uiMessages.length === 0 || !sessionId) return;

    const last = uiMessages[uiMessages.length - 1];
    if (last.role !== "user") return;

    autoTriggeredRef.current = true;
    inFlightRef.current = true;

    void (async () => {
      try {
        await sendMessage({
          text: getTextFromUIMessage(last),
          messageId: last.id,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown chat error";
        setError(message);
        setUiMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastM = prev[lastIdx];
          if (lastM?.role === "user") {
            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                parts: [
                  {
                    type: "text" as const,
                    text: "I don't have enough information.",
                    state: "done" as const,
                  },
                ],
              },
            ];
          }
          return prev;
        });
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [
    isLoadingHistory,
    uiMessages,
    sessionId,
    redirectOnly,
    sendMessage,
    setUiMessages,
  ]);

  const handleSubmit = useCallback(
    (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
      if (isSending) return;
      const trimmed = input.trim();
      if (!trimmed) return;
      setInput("");
      submitQuery(trimmed);
    },
    [input, isSending, submitQuery],
  );

  const applyQuickPrompt = useCallback(
    (text: string) => {
      if (isSending) return;
      setInput(text);
    },
    [isSending],
  );

  const prefixedSubmit = useCallback(
    (prefix: string) => {
      if (isSending) return;
      const body = input.trim();
      const full = body ? `${prefix} ${body}` : prefix;
      setInput("");
      submitQuery(full);
    },
    [input, isSending, submitQuery],
  );

  return {
    messages,
    input,
    isSending,
    error,
    isActive,
    isLoadingHistory,
    isWaitingForFirstToken,
    loadingPhase,
    handleInputChange,
    handleSubmit,
    submitQuery,
    applyQuickPrompt,
    prefixedSubmit,
  };
}

export type ChatV2Controller = ReturnType<typeof useChatV2>;
