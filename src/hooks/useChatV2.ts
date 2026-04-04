"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/src/lib/supabase/client";
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
};

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

export function useChatV2({
  mockMode = false,
  sessionId = null,
  userId,
  router,
  createSession,
  refetchSessions,
  redirectOnly = false,
}: UseChatV2Options = {}) {
  const [messages, setMessages] = useState<ChatMessageV2[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const inFlightRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(sessionId ?? null);
  const autoTriggeredRef = useRef(false);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const isActive = messages.length > 0;

  useEffect(() => {
    currentSessionIdRef.current = sessionId ?? null;
  }, [sessionId]);

  // Load existing messages when sessionId is provided
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setIsLoadingHistory(true);
    autoTriggeredRef.current = false;

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("chat_messages")
        .select("id, role, content, citations, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (!fetchError && data && data.length > 0) {
        setMessages(
          data.map((row) => ({
            id: row.id as string,
            role: row.role as "user" | "assistant",
            content: row.content as string,
            citations: (row.citations as Citation[] | null) ?? undefined,
          })),
        );
      }
      setIsLoadingHistory(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> =
    useCallback((e) => setInput(e.target.value), []);

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

  /**
   * Core function that streams from /api/chat (or mock) and persists the
   * assistant response. Called by submitQuery for normal flow, and by the
   * auto-trigger effect for the home→chat handoff.
   */
  const streamResponse = useCallback(
    async (
      query: string,
      assistantMessageId: string,
      sid: string,
    ) => {
      if (mockMode) {
        await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
        setIsWaitingForFirstToken(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: MOCK_RESPONSE }
              : msg,
          ),
        );
        await persistMessage(sid, {
          id: assistantMessageId,
          role: "assistant",
          content: MOCK_RESPONSE,
        });
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const responseCitations = parseCitations(
        response.headers.get("x-chat-sources"),
      );

      if (!response.ok) {
        let message = "Chat request failed";
        try {
          const payload = (await response.json()) as { error?: string };
          message = payload.error ?? message;
        } catch {
          /* non-JSON body */
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
      }

      const finalContent = sawFirstToken
        ? accumulated
        : "I don't have enough information.";

      if (!sawFirstToken) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: finalContent, citations: responseCitations }
              : msg,
          ),
        );
      }

      await persistMessage(sid, {
        id: assistantMessageId,
        role: "assistant",
        content: finalContent,
        citations: responseCitations,
      });
    },
    [mockMode, persistMessage],
  );

  const submitQuery = useCallback(
    (trimmed: string) => {
      if (!trimmed || inFlightRef.current) return;
      inFlightRef.current = true;

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();

      setError(null);
      setIsSending(true);
      setIsWaitingForFirstToken(true);
      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: trimmed },
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      void (async () => {
        try {
          let sid = currentSessionIdRef.current;

          // If no session yet (home page), create one titled with the first message
          if (!sid && createSession) {
            const title = trimmed.substring(0, SESSION_TITLE_MAX_LEN);
            const session = await createSession(title);
            if (session) {
              sid = session.id;
              currentSessionIdRef.current = sid;
              refetchSessions?.();
            }
          }

          // Persist user message
          if (sid) {
            await persistMessage(sid, {
              id: userMessageId,
              role: "user",
              content: trimmed,
            });
          }

          // redirectOnly: create session + persist + navigate, then stop.
          // The chat page will auto-trigger the RAG call on mount.
          // Pass mock flag so the chat page inherits the current mock state.
          if (redirectOnly && sid && router) {
            const params = new URLSearchParams({ id: sid });
            if (mockMode) params.set("mock", "1");
            router.push(`/v2/chat?${params.toString()}`);
            return;
          }

          // If we created a session from a non-redirectOnly page (shouldn't
          // happen normally), still redirect but continue streaming
          if (sid && router && !sessionId) {
            router.push(`/v2/chat?id=${sid}`);
          }

          if (!sid) {
            throw new Error("Could not create chat session.");
          }

          await streamResponse(trimmed, assistantMessageId, sid);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown chat error";
          setError(message);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: "I don't have enough information." }
                : msg,
            ),
          );
        } finally {
          inFlightRef.current = false;
          setIsSending(false);
          setIsWaitingForFirstToken(false);
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
      streamResponse,
    ],
  );

  // Auto-trigger: when history finishes loading and the last message is a
  // user message (no assistant reply yet), fire the RAG call automatically.
  // This handles the handoff from the home page redirect.
  useEffect(() => {
    if (isLoadingHistory || autoTriggeredRef.current || redirectOnly) return;
    if (messages.length === 0 || !sessionId) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "user") return;

    autoTriggeredRef.current = true;
    inFlightRef.current = true;

    const assistantMessageId = crypto.randomUUID();
    const query = lastMsg.content;

    setIsSending(true);
    setIsWaitingForFirstToken(true);
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    void (async () => {
      try {
        await streamResponse(query, assistantMessageId, sessionId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown chat error";
        setError(message);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: "I don't have enough information." }
              : msg,
          ),
        );
      } finally {
        inFlightRef.current = false;
        setIsSending(false);
        setIsWaitingForFirstToken(false);
      }
    })();
  }, [isLoadingHistory, messages, sessionId, redirectOnly, streamResponse]);

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
    handleInputChange,
    handleSubmit,
    submitQuery,
    prefixedSubmit,
  };
}

export type ChatV2Controller = ReturnType<typeof useChatV2>;
