"use client";

import { Sparkles } from "lucide-react";

export default function ChatInterfaceV2() {
  return (
    <section className="flex flex-col items-center pt-[150px]">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border-[2.5px] border-[var(--v2-primary)] bg-[var(--v2-primary)]">
        <Sparkles className="h-6 w-6 text-white" />
      </div>

      <p className="mt-[20px] text-center text-2xl font-semibold text-black">
        Hello, How can I help you today?
      </p>
    </section>
  );
}
