"use client";

import { Suspense, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { SiriOrb } from "@/components/ui/siri-orb";
import {
  chatEmptyVariants,
  chatThreadVariants,
} from "@/src/components/v2/chat/new-chat-motion";
import NavbarV2 from "@/src/components/v2/NavbarV2";
import PromptInputV2 from "@/src/components/v2/PromptInputV2";
import ChatMessageList from "@/src/components/v2/ChatMessageList";
import { setPendingChatHandoff } from "@/src/lib/chat/handoff";
import { useChatV2 } from "@/src/hooks/useChatV2";
import { useAuth } from "@/src/hooks/useAuth";
import { useChatSessions } from "@/src/hooks/useChatSessions";

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("id");
  const mockParam = searchParams.get("mock");

  const { user } = useAuth();
  const { refetch: refetchSessions } = useChatSessions(user?.id);

  const [mockMode] = useState(
    mockParam === "1" || process.env.NEXT_PUBLIC_MOCK_AI === "true",
  );

  const chat = useChatV2({
    mockMode,
    sessionId: chatId,
    userId: user?.id,
    refetchSessions,
  });

  useLayoutEffect(() => {
    if (searchParams.get("handoff") !== "1" || !chatId) return;
    setPendingChatHandoff(chatId);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("handoff");
    const qs = next.toString();
    router.replace(qs ? `/chat?${qs}` : "/chat");
  }, [chatId, router, searchParams]);

  return (
    <>
      <NavbarV2 />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden">
        {chat.isLoadingHistory && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--v2-primary)]" />
          </div>
        )}

        {!chat.isLoadingHistory && (
          <AnimatePresence mode="wait">
            {!chat.isActive ? (
              <motion.div
                key="chat-empty"
                role="region"
                aria-label="New chat"
                variants={chatEmptyVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-x-hidden px-4"
              >
                <div className="flex items-center justify-center drop-shadow-[0_6px_20px_rgba(3,134,253,0.18)]">
                  <SiriOrb size="96px" animationDuration={22} />
                </div>
                <h2 className="text-xl font-semibold text-black">
                  {chatId ? "Continue your conversation" : "Start a new chat"}
                </h2>
                <p className="text-sm text-[#4f5059]">
                  Ask anything about your datasheets. Your AI assistant is ready.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="chat-thread"
                role="log"
                variants={chatThreadVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex min-h-0 flex-1 flex-col overflow-x-hidden"
              >
                <ChatMessageList
                  messages={chat.messages}
                  isWaitingForFirstToken={chat.isWaitingForFirstToken}
                  loadingPhase={chat.loadingPhase}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <div className="shrink-0 px-4 pb-4 pt-3">
          <motion.div layoutId="prompt-input">
            <PromptInputV2
              value={chat.input}
              onChange={chat.handleInputChange}
              onSubmit={chat.handleSubmit}
              isSending={chat.isSending}
            />
          </motion.div>
        </div>
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--v2-primary)]" />
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
