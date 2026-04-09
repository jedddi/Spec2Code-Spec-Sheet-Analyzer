"use client";

import { useEffect, useRef } from "react";
import ChatMessageBubble from "./ChatMessageBubble";
import type {
  ChatLoadingPhase,
  ChatMessageV2,
} from "@/src/hooks/useChatV2";

interface ChatMessageListProps {
  messages: ChatMessageV2[];
  isWaitingForFirstToken: boolean;
  loadingPhase?: ChatLoadingPhase;
}

export default function ChatMessageList({
  messages,
  isWaitingForFirstToken,
  loadingPhase = null,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isWaitingForFirstToken]);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6"
    >
      <div className="mx-auto flex w-full max-w-[824px] flex-col gap-6">
        {messages.map((msg, index) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            loadingPhase={
              msg.role === "assistant" &&
              index === messages.length - 1 &&
              msg.content === ""
                ? loadingPhase
                : null
            }
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
