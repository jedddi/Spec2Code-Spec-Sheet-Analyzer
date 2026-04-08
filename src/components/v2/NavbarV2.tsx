"use client";

import { Forward } from "lucide-react";

export default function NavbarV2() {
  return (
    <header className="sticky top-0 z-10 flex h-[81px] shrink-0 items-center justify-between bg-transparent px-5">
      {/* Left: title */}
      <div className="min-w-0 shrink-0">
        <p className="text-xl font-semibold leading-7 text-[#111]">
          Synthetix
        </p>
        <p className="text-sm capitalize text-[#4f5059]">
          analyze your datasheets
        </p>
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
