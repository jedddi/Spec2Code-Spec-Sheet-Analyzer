"use client";

import { FileCode2, WandSparkles } from "lucide-react";

interface ActionPillsV2Props {
  onQuickSpecs: () => void;
  onGenerateCode: () => void;
}

// TODO: Connect to FileList quick-specs and generate-header actions.
export default function ActionPillsV2({
  onQuickSpecs,
  onGenerateCode,
}: ActionPillsV2Props) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-[814px] items-center gap-3">
      <button
        type="button"
        onClick={onQuickSpecs}
        className="flex h-12 items-center gap-2.5 rounded-[50px] border border-[#ededed] bg-[#fafbfb] pl-[5px] pr-5 text-sm font-medium text-[#888] transition-colors hover:bg-gray-100"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#fafafa] bg-[#ebf2ff] shadow-[0px_2px_8px_rgba(138,155,255,0.2),0px_2px_8px_rgba(0,0,0,0.08)]">
          <WandSparkles className="h-4 w-4 text-[#5b7bff]" />
        </span>
        Quick Specs
      </button>

      <button
        type="button"
        onClick={onGenerateCode}
        className="flex h-12 items-center gap-2.5 rounded-[50px] border border-[#ededed] bg-[#fafbfb] pl-[5px] pr-5 text-sm font-medium text-[#888] transition-colors hover:bg-gray-100"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#fafafa] bg-[#ebf2ff] shadow-[0px_2px_8px_rgba(138,155,255,0.2),0px_2px_8px_rgba(0,0,0,0.08)]">
          <FileCode2 className="h-4 w-4 text-[#5b7bff]" />
        </span>
        Generate Code
      </button>
    </div>
  );
}
