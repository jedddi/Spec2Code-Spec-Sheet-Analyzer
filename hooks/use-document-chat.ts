"use client";

import { useCallback, useRef, useState } from "react";

export type Citation = {
  document_path: string;
  preview: string;
  similarity: number;
};

export type DocumentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

export function useDocumentChat() {
  const [messages, setMessages] = useState<DocumentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const inFlightRef = useRef(false);

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> =
    useCallback((e) => {
      setInput(e.target.value);
    }, []);

  const submitQuery = useCallback((trimmed: string) => {
    if (!trimmed || inFlightRef.current) return;
    inFlightRef.current = true;

    void (async () => {
      setError(null);
      setIsSending(true);
      setIsWaitingForFirstToken(true);

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: trimmed },
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

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
            const parsed = JSON.parse(
              decodeURIComponent(responseSourcesHeader),
            ) as unknown;
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
            const errorPayload = (await response.json()) as {
              error?: string;
            };
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
                ? {
                    ...msg,
                    content: accumulated,
                    citations: responseCitations,
                  }
                : msg,
            ),
          );
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
  }, []);

  const handleSubmit = useCallback(
    (
      event?: { preventDefault?: () => void },
      _options?: { experimental_attachments?: FileList },
    ) => {
      event?.preventDefault?.();
      if (isSending) return;
      const trimmed = input.trim();
      if (!trimmed) return;
      setInput("");
      submitQuery(trimmed);
    },
    [input, isSending, submitQuery],
  );

  const appendAssistantMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: trimmed,
      },
    ]);
  }, []);

  return {
    messages,
    setMessages,
    input,
    isSending,
    error,
    isWaitingForFirstToken,
    handleInputChange,
    handleSubmit,
    appendAssistantMessage,
  };
}

export type DocumentChatController = ReturnType<typeof useDocumentChat>;
