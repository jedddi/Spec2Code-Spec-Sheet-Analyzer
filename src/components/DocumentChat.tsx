"use client";

import {
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";

import { Chat } from "@/components/ui/chat";
import { CopyButton } from "@/components/ui/copy-button";
import type { Message } from "@/components/ui/chat-message";
import { cn } from "@/lib/utils";
import { useDocumentChatContext } from "@/src/contexts/document-chat-context";

import { CitationsDropdown } from "./chat-citations";

export default function DocumentChat({ className }: { className?: string }) {
  const {
    messages,
    setMessages,
    input,
    isSending,
    error,
    isWaitingForFirstToken,
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
      return {
        actions: (
          <div className="relative flex flex-col items-end gap-1">
            <div className="flex flex-wrap items-center justify-end gap-1">
              {message.content ? (
                <CopyButton
                  content={message.content}
                  copyMessage="Copied response to clipboard!"
                />
              ) : null}
            </div>
            {message.role === "assistant" &&
            citations &&
            citations.length > 0 ? (
              <CitationsDropdown
                citations={citations}
                messageId={message.id}
              />
            ) : null}
          </div>
        ),
      };
    },
    [messages],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <Chat
        className="min-h-0 flex-1 overflow-hidden"
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
      {error ? (
        <p className="px-4 pt-2 text-sm text-destructive md:px-6">{error}</p>
      ) : null}
    </div>
  );
}
