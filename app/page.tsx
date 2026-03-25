"use client";

import { useState } from "react";
import SidebarChat from "../src/components/SidebarChat";
import UploadPdf from "../src/components/UploadPdf";
import FileList from "../src/components/FileList";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <SidebarChat />

      <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto">
        <div className="flex w-full max-w-xl flex-col gap-10 px-6 -translate-x-25">
          <UploadPdf onUploadComplete={() => setRefreshKey((k) => k + 1)} />
          <FileList refreshKey={refreshKey} />
        </div>
      </main>
    </div>
  );
}
