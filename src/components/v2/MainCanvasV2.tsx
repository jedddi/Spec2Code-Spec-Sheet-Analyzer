"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import type { ReactNode } from "react";

interface MainCanvasV2Props {
  children: ReactNode;
  className?: string;
}

export default function MainCanvasV2({
  children,
  className,
}: MainCanvasV2Props) {
  const pathname = usePathname();
  const isHome = pathname === "/v2";

  return (
    <main
      className={cn(
        "relative my-5 mr-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white",
        className,
      )}
    >
      <BackgroundGradientAnimation
        interactive={false}
        opacity={isHome ? 0.4 : 0.1}
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </main>
  );
}
