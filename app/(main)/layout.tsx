"use client";

import SidebarV2 from "@/src/components/v2/SidebarV2";
import MainCanvasV2 from "@/src/components/v2/MainCanvasV2";
import { SidebarProvider } from "@/src/contexts/sidebar-context";
import type { ReactNode } from "react";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen font-[family-name:var(--font-plus-jakarta)] bg-[var(--v2-sidebar-bg)]">
        <SidebarV2 />
        <MainCanvasV2>{children}</MainCanvasV2>
      </div>
    </SidebarProvider>
  );
}
