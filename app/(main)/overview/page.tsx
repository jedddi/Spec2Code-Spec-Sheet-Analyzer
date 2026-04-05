"use client";

import NavbarV2 from "@/src/components/v2/NavbarV2";
import { Archive, BarChart3 } from "lucide-react";

export default function OverviewPage() {
  return (
    <>
      <NavbarV2 />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8">
        <h1 className="text-center text-2xl font-semibold text-[#111]">
          Overview
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-[#4f5059]">
          AI performance insights and your library in one place.
        </p>

        <div className="mx-auto mt-10 grid w-full max-w-3xl gap-8 md:grid-cols-2 md:gap-6">
          <section className="flex flex-col items-center rounded-xl border border-black/[0.06] bg-white/40 px-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--v2-primary)]/20 bg-[var(--v2-primary)]/10">
              <BarChart3 className="h-7 w-7 text-[var(--v2-primary)]" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-[#111]">
              AI Performance
            </h2>
            <p className="mt-2 max-w-sm text-sm text-[#4f5059]">
              Track and analyze your AI model performance metrics. This feature
              is coming soon.
            </p>
          </section>

          <section className="flex flex-col items-center rounded-xl border border-black/[0.06] bg-white/40 px-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--v2-primary)]/20 bg-[var(--v2-primary)]/10">
              <Archive className="h-7 w-7 text-[var(--v2-primary)]" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-[#111]">Library</h2>
            <p className="mt-2 max-w-sm text-sm text-[#4f5059]">
              Manage your uploaded datasheets and generated outputs in one
              place. This feature is coming soon.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
