"use client";

import {
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Loader2 } from "lucide-react";

import { Chat } from "@/components/ui/chat";
import { CopyButton } from "@/components/ui/copy-button";
import type { Message } from "@/components/ui/chat-message";
import { cn } from "@/lib/utils";
import { useDocumentChatContext } from "@/src/contexts/document-chat-context";

import { CitationsDropdown } from "./chat-citations";

const CHAT_MAX_WIDTH_CLASS = "max-w-4xl";

export default function DocumentChat({ className }: { className?: string }) {
  const {
    messages,
    setMessages,
    input,
    isSending,
    error,
    isWaitingForFirstToken,
    globalStatus,
    handleInputChange,
    handleSubmit,
  } = useDocumentChatContext();

  const kitMessages: Message[] = useMemo(
    () =>
      messages
        .filter(
          (m) =>
            m.role !== "assistant" ||
            m.content !== "" ||
            !isSending,
        )
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
    [messages, isSending],
  );

  const last = messages.at(-1);
  const isTypingOverride =
    isWaitingForFirstToken ||
    (!!last &&
      last.role === "assistant" &&
      last.content === "" &&
      isSending);

  const messageOptions = useCallback(
    (message: Message) => {
      const full = messages.find((m) => m.id === message.id);
      const citations = full?.citations;
      const showCitations =
        message.role === "assistant" && citations && citations.length > 0;
      return {
        actions: (
          <>
            {message.content ? (
              <CopyButton
                content={message.content}
                copyMessage="Copied response to clipboard!"
              />
            ) : null}
          </>
        ),
        footer: showCitations ? (
          <CitationsDropdown citations={citations!} messageId={message.id} />
        ) : null,
      };
    },
    [messages],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <Chat
        className={cn(
          "mx-auto min-h-0 w-full flex-1 overflow-hidden",
          CHAT_MAX_WIDTH_CLASS,
        )}
        messages={kitMessages}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isGenerating={isSending}
        isTypingOverride={isTypingOverride}
        messageOptions={messageOptions}
        setMessages={
          setMessages as unknown as Dispatch<SetStateAction<Message[]>>
        }
      />
      {globalStatus ? (
        <p className="flex items-center gap-2 px-4 pt-2 text-sm text-muted-foreground md:px-6">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{globalStatus}</span>
        </p>
      ) : null}
      {error ? (
        <p className="px-4 pt-2 text-sm text-destructive md:px-6">{error}</p>
      ) : null}
    </div>
  );
}
