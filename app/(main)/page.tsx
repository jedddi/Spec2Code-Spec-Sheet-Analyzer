"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Upload } from "lucide-react";
import NavbarV2 from "@/src/components/v2/NavbarV2";
import ChatInterfaceV2 from "@/src/components/v2/ChatInterfaceV2";
import PromptInputV2 from "@/src/components/v2/PromptInputV2";
import BentoGridV2 from "@/src/components/v2/BentoGridV2";
import ChatMessageList from "@/src/components/v2/ChatMessageList";
import UploadPdf from "@/src/components/UploadPdf";
import { useChatV2 } from "@/src/hooks/useChatV2";
import { useAuth } from "@/src/hooks/useAuth";
import { useChatSessions } from "@/src/hooks/useChatSessions";
import { useDocumentsContext } from "@/src/contexts/documents-context";

const DEFAULT_PROMPTS = [
  {
    id: "1",
    text: "Summarize the power requirements and pinout for",
  },
  {
    id: "2",
    text: "What is the default I2C address and register map for",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createSession, refetch: refetchSessions } = useChatSessions(user?.id);
  const { refetch: refetchDocuments } = useDocumentsContext();

  const [mockMode, setMockMode] = useState(
    process.env.NEXT_PUBLIC_MOCK_AI === "true",
  );
  const [showUpload, setShowUpload] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const chat = useChatV2({
    mockMode,
    userId: user?.id,
    router,
    createSession,
    refetchSessions,
    redirectOnly: true,
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setDroppedFiles(Array.from(e.dataTransfer.files));
    }
    setShowUpload(true);
  }, []);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <NavbarV2 />

      {/* Drag overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-[24px] border-2 border-dashed border-[var(--v2-primary)] bg-[var(--v2-primary)]/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-[var(--v2-primary)]" />
            <p className="text-lg font-semibold text-[var(--v2-primary)]">
              Drop PDF datasheets here
            </p>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg">
            <button
              type="button"
              onClick={() => {
                setShowUpload(false);
                setDroppedFiles(null);
              }}
              className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111] shadow-md hover:bg-gray-100"
            >
              &times;
            </button>
            <UploadPdf
              autoIngest
              initialFiles={droppedFiles}
              onUploadComplete={() => {
                refetchDocuments();
                setShowUpload(false);
                setDroppedFiles(null);
              }}
            />
          </div>
        </div>
      )}

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
                  ref={promptTextareaRef}
                  value={chat.input}
                  onChange={chat.handleInputChange}
                  onSubmit={chat.handleSubmit}
                  isSending={chat.isSending}
                />
              </motion.div>

              <BentoGridV2
                prompts={DEFAULT_PROMPTS}
                onSelect={(text) => {
                  chat.applyQuickPrompt(text);
                  queueMicrotask(() => {
                    promptTextareaRef.current?.focus();
                    const len = text.length;
                    promptTextareaRef.current?.setSelectionRange(len, len);
                  });
                }}
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
                  ref={promptTextareaRef}
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
    </div>
  );
}
