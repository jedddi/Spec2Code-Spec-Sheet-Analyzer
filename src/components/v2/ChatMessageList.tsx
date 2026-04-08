"use client";

import { useEffect, useRef } from "react";
import ChatMessageBubble from "./ChatMessageBubble";
import type { ChatMessageV2 } from "@/src/hooks/useChatV2";

interface ChatMessageListProps {
  messages: ChatMessageV2[];
  isWaitingForFirstToken: boolean;
}

export default function ChatMessageList({
  messages,
  isWaitingForFirstToken,
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
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
