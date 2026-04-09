"use client";

import { Sparkles, TriangleAlert } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { CitationsDropdown } from "@/src/components/chat-citations";
import type { ChatLoadingPhase, ChatMessageV2 } from "@/src/hooks/useChatV2";
import LoadingStatus from "./LoadingStatus";

interface ChatMessageBubbleProps {
  message: ChatMessageV2;
  loadingPhase?: ChatLoadingPhase;
}

export default function ChatMessageBubble({
  message,
  loadingPhase = null,
}: ChatMessageBubbleProps) {
  if (message.role === "user") {
    return <UserBubble content={message.content} />;
  }
  return <AssistantBubble message={message} loadingPhase={loadingPhase} />;
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <p className="text-right text-base leading-relaxed text-[#334a4d]/80">
        {content}
      </p>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600">
        <span className="text-xs font-semibold text-white">U</span>
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  loadingPhase,
}: {
  message: ChatMessageV2;
  loadingPhase: ChatLoadingPhase;
}) {
  const { content, citations, lowConfidence } = message;
  const isEmpty = !content;
  const hasSources = citations && citations.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-[#dfe6e6] bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#dfe6e6] bg-[rgba(3,134,253,0.02)] px-4 py-3">
        <div className="flex h-5 w-5 items-center justify-center">
          <Sparkles className="h-4 w-4 text-[var(--v2-primary)]" />
        </div>
        <span className="text-base font-medium text-[#001d21]">Synthetix</span>
      </div>

      {/* Body */}
      <div className="relative px-4 py-4">
        {/* Left timeline bar */}
        <div className="absolute bottom-4 left-4 top-4 w-px rounded-sm bg-[#dfe6e6]" />

        <div className="pl-5">
          {isEmpty ? (
            <div className="space-y-2 py-1">
              <LoadingStatus phase={loadingPhase} />
              <TypingIndicator />
            </div>
          ) : (
            <div className="prose-v2 max-w-none text-base leading-relaxed text-[#4f5059]/80">
              <MarkdownRenderer>{content}</MarkdownRenderer>
            </div>
          )}

          {lowConfidence && !isEmpty ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700">
                Low confidence &mdash; the retrieved sources may not be fully relevant to your query.
              </p>
            </div>
          ) : null}

          {hasSources ? (
            <div className="mt-4 border-t border-[#dfe6e6] pt-3">
              <p className="mb-2 text-xs font-medium text-[#334a4d]/85">Sources</p>
              <CitationsDropdown citations={citations} messageId={message.id} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="animate-typing-dot-bounce h-2 w-2 rounded-full bg-[var(--v2-primary)]" />
      <span
        className="animate-typing-dot-bounce h-2 w-2 rounded-full bg-[var(--v2-primary)]"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="animate-typing-dot-bounce h-2 w-2 rounded-full bg-[var(--v2-primary)]"
        style={{ animationDelay: "0.3s" }}
      />
    </div>
  );
}
