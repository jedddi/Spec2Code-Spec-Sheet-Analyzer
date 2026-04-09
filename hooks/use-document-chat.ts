"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createMockChatResponse } from "@/src/lib/chat/mock-ui-chat-response";
import { getTextFromUIMessage } from "@/src/lib/chat/ui-message-text";
import type {
  AppChatUIMessage,
  ChatLoadingPhase,
  Citation,
} from "@/src/hooks/useChatV2";

export type { Citation } from "@/src/hooks/useChatV2";

export type DocumentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

const DOC_CHAT_ID = "document-panel";

const MOCK_RESPONSE = `[MOCK]: Document chat response for UI testing.`;

const MOCK_DELAY_MS = 800;

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
        (((item as Citation).page === null) ||
          typeof (item as Citation).page === "number"),
    );
  } catch {
    return [];
  }
}

function docToUi(m: DocumentChatMessage): AppChatUIMessage {
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content, state: "done" }],
    metadata: m.citations?.length ? { citations: m.citations } : undefined,
  };
}

function uiToDoc(m: AppChatUIMessage): DocumentChatMessage {
  const meta = m.metadata;
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: getTextFromUIMessage(m),
    citations: meta?.citations,
  };
}

export function useDocumentChat() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [citationEpoch, setCitationEpoch] = useState(0);
  const [serverPhase, setServerPhase] = useState<ChatLoadingPhase>(null);
  const [globalStatus, setGlobalStatus] = useState<string | null>(null);
  const mockModeRef = useRef(
    typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_MOCK_AI === "true",
  );
  const citationsRef = useRef<Citation[]>([]);
  const globalStatusTokenRef = useRef(0);
  const inFlightRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AppChatUIMessage>({
        api: "/api/chat",
        fetch: async (inputUrl, init) => {
          if (mockModeRef.current) {
            return createMockChatResponse(MOCK_RESPONSE, MOCK_DELAY_MS);
          }
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
      id: DOC_CHAT_ID,
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
              ? {
                  ...m,
                  metadata: { ...m.metadata, citations: snap },
                }
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

  const messages: DocumentChatMessage[] = useMemo(() => {
    void citationEpoch;
    return uiMessages.map((m, i) => {
      const base = uiToDoc(m);
      const isLastAssistant =
        m.role === "assistant" && i === uiMessages.length - 1;
      if (
        isLastAssistant &&
        citationsRef.current.length > 0 &&
        (status === "streaming" || status === "submitted")
      ) {
        return { ...base, citations: citationsRef.current };
      }
      return base;
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

  const setMessages: Dispatch<SetStateAction<DocumentChatMessage[]>> =
    useCallback(
      (updater) => {
        setUiMessages((prevUi) => {
          const prev = prevUi.map(uiToDoc);
          const next = typeof updater === "function" ? updater(prev) : updater;
          return next.map(docToUi);
        });
      },
      [setUiMessages],
    );

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> =
    useCallback((e) => {
      setInput(e.target.value);
    }, []);

  const submitQuery = useCallback(
    (trimmed: string) => {
      if (!trimmed || inFlightRef.current) return;
      inFlightRef.current = true;
      setError(null);
      void (async () => {
        try {
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
    [sendMessage],
  );

  const handleSubmit = useCallback(
    (
      event?: { preventDefault?: () => void },
      options?: { experimental_attachments?: FileList },
    ) => {
      void options;
      event?.preventDefault?.();
      if (isSending) return;
      const trimmed = input.trim();
      if (!trimmed) return;
      setInput("");
      submitQuery(trimmed);
    },
    [input, isSending, submitQuery],
  );

  const appendAssistantMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      setUiMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          parts: [{ type: "text", text: trimmed, state: "done" as const }],
        },
      ]);
    },
    [setUiMessages],
  );

  const beginGlobalStatus = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return null;
    globalStatusTokenRef.current += 1;
    const token = globalStatusTokenRef.current;
    setGlobalStatus(trimmed);
    return token;
  }, []);

  const endGlobalStatus = useCallback((token: number | null) => {
    if (token === null) return;
    if (globalStatusTokenRef.current !== token) return;
    setGlobalStatus(null);
  }, []);

  return {
    messages,
    setMessages,
    input,
    isSending,
    error,
    isWaitingForFirstToken,
    loadingPhase,
    globalStatus,
    handleInputChange,
    handleSubmit,
    appendAssistantMessage,
    beginGlobalStatus,
    endGlobalStatus,
  };
}

export type DocumentChatController = ReturnType<typeof useDocumentChat>;
