"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MainCanvasV2Props {
  children: ReactNode;
  className?: string;
}

export default function MainCanvasV2({
  children,
  className,
}: MainCanvasV2Props) {
  return (
    <main
      className={cn(
        "my-5 mr-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white",
        className,
      )}
    >
      {children}
    </main>
  );
}
