"use client";

import { Forward, Sparkles, FlaskConical } from "lucide-react";

interface NavbarV2Props {
  mockMode?: boolean;
  onToggleMock?: (value: boolean) => void;
}

export default function NavbarV2({ mockMode, onToggleMock }: NavbarV2Props) {
  return (
    <header className="sticky top-0 z-10 flex h-[81px] shrink-0 items-center bg-transparent px-5">
      {/* Left: title */}
      <div className="min-w-0 shrink-0">
        <p className="text-xl font-semibold leading-7 text-[#111]">
          Synthetix
        </p>
        <p className="text-sm capitalize text-[#4f5059]">
          analyze your datasheets
        </p>
      </div>

      {/* Center: AI Chat Helper pill */}
      <div className="flex flex-1 items-center justify-center gap-3">
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-[106px] bg-[var(--v2-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0278e0]"
        >
          <Sparkles className="h-5 w-5" />
          AI Chat Helper
        </button>

        {/* Mock AI toggle */}
        {onToggleMock && (
          <button
            type="button"
            onClick={() => onToggleMock(!mockMode)}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
              mockMode
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-[#d9dadb] bg-[#fafbfb] text-[#6d7078] hover:bg-gray-100"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {mockMode ? "Mock ON" : "Mock OFF"}
          </button>
        )}
      </div>

      {/* Right: Share */}
      <button
        type="button"
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#d9dadb] px-3 text-xs font-medium text-[#111] transition-colors hover:bg-gray-50"
      >
        <Forward className="h-4 w-4" />
        Share
      </button>
    </header>
  );
}
