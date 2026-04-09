"use client";

import { Loader2 } from "lucide-react";
import type { ChatLoadingPhase } from "@/src/hooks/useChatV2";

const LABELS: Record<Exclude<ChatLoadingPhase, null>, string> = {
  searching: "Searching…",
  analyzing: "Analyzing…",
  writing: "Writing…",
};

export default function LoadingStatus({
  phase,
  className,
}: {
  phase: ChatLoadingPhase;
  className?: string;
}) {
  if (!phase) return null;
  return (
    <div
      className={
        className ??
        "flex items-center gap-2 text-sm font-medium text-[#334a4d]/85"
      }
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--v2-primary)]" />
      <span>{LABELS[phase]}</span>
    </div>
  );
}
