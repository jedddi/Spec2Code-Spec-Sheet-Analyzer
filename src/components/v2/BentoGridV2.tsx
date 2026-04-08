"use client";

import { CircleHelp, Plus } from "lucide-react";

interface PromptItem {
  id: string;
  text: string;
}

interface BentoGridV2Props {
  prompts: PromptItem[];
  onSelect: (text: string) => void;
}

export default function BentoGridV2({ prompts, onSelect }: BentoGridV2Props) {
  return (
    <section className="mx-auto mt-10 w-full max-w-[814px]">
      <p className="text-xs uppercase tracking-wide text-[#888]/50">
        Quick Prompts
      </p>

      <div className="mt-3 grid grid-cols-2 gap-4">
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            onClick={() => onSelect(prompt.text)}
            className="flex items-start gap-4 rounded-2xl border border-[#e1e4ea] bg-[#fafbfb] p-5 text-left shadow-[0px_1px_2px_rgba(10,13,20,0.03)] transition-colors hover:bg-gray-50"
          >
            <CircleHelp className="mt-0.5 h-6 w-6 shrink-0 text-[var(--v2-primary)]" />
            <p className="min-w-0 flex-1 text-sm font-medium leading-[1.48] text-[#888]">
              {prompt.text}
            </p>
            <Plus className="mt-0.5 h-5 w-5 shrink-0 text-[#888]" />
          </button>
        ))}
      </div>
    </section>
  );
}
