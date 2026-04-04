"use client";

import { Sparkles } from "lucide-react";

interface ChatInterfaceV2Props {
  greeting?: string;
  subtitle?: string;
}

// TODO: Connect to user/session state for personalized greeting.
export default function ChatInterfaceV2({
  greeting = "Good Morning, James",
  subtitle = "Your AI command center is fully optimized. Let\u2019s design smarter systems today.",
}: ChatInterfaceV2Props) {
  return (
    <section className="flex flex-col items-center pt-[150px]">
      {/* Blue icon badge */}
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border-[2.5px] border-[var(--v2-primary)] bg-[var(--v2-primary)]">
        <Sparkles className="h-6 w-6 text-white" />
      </div>

      <h1 className="mt-[20px] text-2xl font-semibold text-black">
        {greeting}
      </h1>

      <p className="mt-2 text-center text-sm text-[#4f5059]">{subtitle}</p>
    </section>
  );
}
