"use client";

import { useState } from "react";
import SidebarChat from "../src/components/SidebarChat";
import UploadPdf from "../src/components/UploadPdf";
import FileList from "../src/components/FileList";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white">
      <header className="flex items-center border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900">Spec2Code</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <SidebarChat />

        <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto">
          <div className="flex w-full max-w-xl flex-col gap-10 px-6 -translate-x-6">
            <UploadPdf onUploadComplete={() => setRefreshKey((k) => k + 1)} />
            <FileList refreshKey={refreshKey} />
          </div>
        </main>
      </div>
    </div>
  );
}
