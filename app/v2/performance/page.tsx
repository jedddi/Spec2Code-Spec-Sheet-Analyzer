"use client";

import NavbarV2 from "@/src/components/v2/NavbarV2";
import { BarChart3 } from "lucide-react";

export default function PerformancePage() {
  return (
    <>
      <NavbarV2 />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--v2-primary)]/10 border border-[var(--v2-primary)]/20">
          <BarChart3 className="h-7 w-7 text-[var(--v2-primary)]" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[#111]">
          AI Performance
        </h1>
        <p className="mt-2 max-w-sm text-center text-sm text-[#4f5059]">
          Track and analyze your AI model performance metrics. This feature is
          coming soon.
        </p>
      </div>
    </>
  );
}
