"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import NavbarV2 from "@/src/components/v2/NavbarV2";
import ChatInterfaceV2 from "@/src/components/v2/ChatInterfaceV2";
import PromptInputV2 from "@/src/components/v2/PromptInputV2";
import ActionPillsV2 from "@/src/components/v2/ActionPillsV2";
import BentoGridV2 from "@/src/components/v2/BentoGridV2";
import ChatMessageList from "@/src/components/v2/ChatMessageList";
import { useChatV2 } from "@/src/hooks/useChatV2";
import { useAuth } from "@/src/hooks/useAuth";
import { useChatSessions } from "@/src/hooks/useChatSessions";

const DEFAULT_PROMPTS = [
  {
    id: "1",
    text: "How can we improve model performance this week?",
  },
  {
    id: "2",
    text: "Are our data signals aligned with business goals?",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createSession, refetch: refetchSessions } = useChatSessions(user?.id);

  const [mockMode, setMockMode] = useState(
    process.env.NEXT_PUBLIC_MOCK_AI === "true",
  );

  const chat = useChatV2({
    mockMode,
    userId: user?.id,
    router,
    createSession,
    refetchSessions,
    redirectOnly: true,
  });

  return (
    <>
      <NavbarV2 mockMode={mockMode} onToggleMock={setMockMode} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="popLayout">
          {!chat.isActive && (
            <motion.div
              key="static-home"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="flex flex-1 flex-col overflow-y-auto px-4 pb-10"
            >
              <ChatInterfaceV2 />

              <motion.div layoutId="prompt-input" className="mt-11">
                <PromptInputV2
                  value={chat.input}
                  onChange={chat.handleInputChange}
                  onSubmit={chat.handleSubmit}
                  isSending={chat.isSending}
                />
              </motion.div>

              <ActionPillsV2
                onQuickSpecs={() => chat.prefixedSubmit("[QUICK SPECS]")}
                onGenerateCode={() => chat.prefixedSubmit("[GENERATE CODE]")}
              />

              <BentoGridV2
                prompts={DEFAULT_PROMPTS}
                onSelect={(text) => chat.submitQuery(text)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {chat.isActive && (
          <motion.div
            key="active-chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <ChatMessageList
              messages={chat.messages}
              isWaitingForFirstToken={chat.isWaitingForFirstToken}
            />

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
          </motion.div>
        )}
      </div>
    </>
  );
}
