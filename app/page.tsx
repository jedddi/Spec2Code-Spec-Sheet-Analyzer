"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/src/lib/supabase/client";
import SidebarChat from "../src/components/SidebarChat";
import UploadPdf from "../src/components/UploadPdf";
import FileList from "../src/components/FileList";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const supabase = createBrowserSupabase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900">Spec2Code</h1>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          Sign Out
        </button>
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
