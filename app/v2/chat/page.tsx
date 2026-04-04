"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import NavbarV2 from "@/src/components/v2/NavbarV2";
import PromptInputV2 from "@/src/components/v2/PromptInputV2";
import ChatMessageList from "@/src/components/v2/ChatMessageList";
import { useChatV2 } from "@/src/hooks/useChatV2";
import { useAuth } from "@/src/hooks/useAuth";
import { useChatSessions } from "@/src/hooks/useChatSessions";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get("id");
  const mockParam = searchParams.get("mock");

  const { user } = useAuth();
  const { refetch: refetchSessions } = useChatSessions(user?.id);

  const [mockMode, setMockMode] = useState(
    mockParam === "1" || process.env.NEXT_PUBLIC_MOCK_AI === "true",
  );

  const chat = useChatV2({
    mockMode,
    sessionId: chatId,
    userId: user?.id,
    refetchSessions,
  });

  return (
    <>
      <NavbarV2 mockMode={mockMode} onToggleMock={setMockMode} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Loading history */}
        {chat.isLoadingHistory && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--v2-primary)]" />
          </div>
        )}

        {/* Lightweight greeting when session is empty and not loading */}
        {!chat.isLoadingHistory && !chat.isActive && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[var(--v2-primary)] bg-[var(--v2-primary)]">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-black">
              {chatId ? "Continue your conversation" : "Start a new chat"}
            </h2>
            <p className="text-sm text-[#4f5059]">
              Ask anything about your datasheets. Your AI assistant is ready.
            </p>
          </div>
        )}

        {!chat.isLoadingHistory && chat.isActive && (
          <ChatMessageList
            messages={chat.messages}
            isWaitingForFirstToken={chat.isWaitingForFirstToken}
          />
        )}

        <div className="shrink-0 border-t border-[#e5e5e5]/50 px-4 pb-4 pt-3">
          <PromptInputV2
            value={chat.input}
            onChange={chat.handleInputChange}
            onSubmit={chat.handleSubmit}
            isSending={chat.isSending}
          />
        </div>
      </div>
    </>
  );
}
